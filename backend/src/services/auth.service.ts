import { randomUUID } from 'crypto';
import { User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/http';
import { verifyPassword, verifyPasswordAgainstDummy } from '../lib/auth/passwords';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTtlSeconds,
  signAccessToken,
} from '../lib/auth/tokens';
import { parseRememberMe } from '../lib/auth/cookies';
import { writeAudit } from '../lib/audit';
import { generateCompliantPassword } from '../lib/auth/generate-password';
import { hashPassword } from '../lib/auth/passwords';
import { assertEmail, PublicUser, toPublicUser } from '../lib/auth/users';
import { sendPasswordResetEmail } from '../lib/mail';
import { FORGOT_PASSWORD_SUCCESS_MESSAGE } from '../lib/auth/forgot-password-rate-limit';

const REUSE_GRACE_MS = 10_000;

export type RefreshFailure = 'invalid' | 'expired' | 'inactive' | 'reused' | 'rotated';

export type SessionResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string;
      user: PublicUser;
      rememberMe: boolean;
    }
  | { ok: false; reason: RefreshFailure };

async function issueSession(user: User, rememberMe = false): Promise<SessionResult> {
  const refreshToken = generateRefreshToken();
  const ttl = refreshTtlSeconds(rememberMe);
  await prisma.refreshToken.create({
    data: {
      user_id: user.id,
      token_hash: hashRefreshToken(refreshToken),
      family_id: randomUUID(),
      remember_me: rememberMe,
      expires_at: new Date(Date.now() + ttl * 1000),
    },
  });

  const accessToken = await signAccessToken(user);
  return { ok: true, accessToken, refreshToken, user: toPublicUser(user), rememberMe };
}

export async function login(
  email: unknown,
  password: unknown,
  rememberMe: unknown = false,
): Promise<SessionResult> {
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw new HttpError(400, 'Email and password are required');
  }

  const remember = parseRememberMe(rememberMe);
  const normalized = assertEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  if (!user) {
    await verifyPasswordAgainstDummy(password);
    return { ok: false, reason: 'invalid' };
  }

  const matches = await verifyPassword(password, user.password_hash);
  if (!matches || !user.is_active) return { ok: false, reason: 'invalid' };

  return issueSession(user, remember);
}

export async function refreshSession(rawToken: string | undefined): Promise<SessionResult> {
  if (!rawToken) return { ok: false, reason: 'invalid' };

  const existing = await prisma.refreshToken.findUnique({
    where: { token_hash: hashRefreshToken(rawToken) },
    include: { user: true },
  });

  if (!existing) return { ok: false, reason: 'invalid' };

  if (existing.revoked_at) {
    const age = Date.now() - existing.revoked_at.getTime();
    if (age <= REUSE_GRACE_MS) return { ok: false, reason: 'rotated' };

    await prisma.refreshToken.updateMany({
      where: { family_id: existing.family_id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    return { ok: false, reason: 'reused' };
  }

  if (existing.expires_at.getTime() <= Date.now()) return { ok: false, reason: 'expired' };
  if (!existing.user.is_active) return { ok: false, reason: 'inactive' };

  const refreshToken = generateRefreshToken();
  const nextId = randomUUID();
  const rememberMe = existing.remember_me === true;
  const ttl = refreshTtlSeconds(rememberMe);

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshToken.updateMany({
        where: { id: existing.id, revoked_at: null },
        data: { revoked_at: new Date(), replaced_by: nextId },
      });
      if (claimed.count !== 1) throw new HttpError(401, 'REFRESH_RACE');

      await tx.refreshToken.create({
        data: {
          id: nextId,
          user_id: existing.user_id,
          token_hash: hashRefreshToken(refreshToken),
          family_id: existing.family_id,
          remember_me: rememberMe,
          expires_at: new Date(Date.now() + ttl * 1000),
        },
      });
    });
  } catch (err) {
    if (err instanceof HttpError && err.message === 'REFRESH_RACE') {
      return { ok: false, reason: 'rotated' };
    }
    throw err;
  }

  const accessToken = await signAccessToken(existing.user);
  return {
    ok: true,
    accessToken,
    refreshToken,
    user: toPublicUser(existing.user),
    rememberMe,
  };
}

export async function logout(rawToken: string | undefined, allDevices: boolean): Promise<void> {
  if (!rawToken) return;

  const existing = await prisma.refreshToken.findUnique({
    where: { token_hash: hashRefreshToken(rawToken) },
  });
  if (!existing) return;

  if (allDevices) {
    await revokeAllRefreshTokens(existing.user_id);
    return;
  }

  if (!existing.revoked_at) {
    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revoked_at: new Date() },
    });
  }
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() },
  });
}

export async function replaceSessionAfterPasswordChange(userId: string): Promise<SessionResult> {
  await revokeAllRefreshTokens(userId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.is_active) throw new HttpError(401, 'Unauthorized');
  return issueSession(user);
}

export async function forgotPassword(email: unknown): Promise<{ message: string }> {
  if (typeof email !== 'string' || !email.trim()) {
    throw new HttpError(400, 'Email is required');
  }

  const normalized = assertEmail(email);
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: {
      id: true,
      email: true,
      is_active: true,
      secondary_email: true,
    },
  });

  if (!user?.is_active || !user.secondary_email) {
    return { message: FORGOT_PASSWORD_SUCCESS_MESSAGE };
  }

  const recoveryTo = assertEmail(user.secondary_email);
  const newPassword = generateCompliantPassword();

  const idempotencyKey = `password-reset/${user.id}/${randomUUID()}`;

  try {
    await sendPasswordResetEmail({
      to: recoveryTo,
      loginEmail: user.email,
      newPassword,
      idempotencyKey,
    });
  } catch (err) {
    console.error('Password reset email failed:', err);
    return { message: FORGOT_PASSWORD_SUCCESS_MESSAGE };
  }

  const password_hash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { password_hash },
  });
  await revokeAllRefreshTokens(user.id);
  await writeAudit(null, 'auth.forgot_password', 'user', user.id);

  return { message: FORGOT_PASSWORD_SUCCESS_MESSAGE };
}
