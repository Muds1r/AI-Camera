import { randomInt, randomUUID } from 'crypto';
import { Role, User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/http';
import { hashPassword, verifyPassword, verifyPasswordAgainstDummy } from '../lib/auth/passwords';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTtlSeconds,
  signAccessToken,
} from '../lib/auth/tokens';
import { parseRememberMe } from '../lib/auth/cookies';
import { writeAudit } from '../lib/audit';
import { assertEmail, assertPassword, PublicUser, toPublicUser } from '../lib/auth/users';
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

async function recordLogin(email: string, event: string, userId?: string | null) {
  try {
    await prisma.loginEvent.create({
      data: { email, event, user_id: userId ?? null },
    });
  } catch (err) {
    console.error('Could not record login event', err);
  }
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
    await recordLogin(normalized, 'login_failure');
    return { ok: false, reason: 'invalid' };
  }

  const matches = await verifyPassword(password, user.password_hash);
  if (!matches) {
    await recordLogin(normalized, 'login_failure', user.id);
    return { ok: false, reason: 'invalid' };
  }
  if (!user.is_active || user.login_enabled === false) {
    await recordLogin(normalized, 'login_blocked', user.id);
    return { ok: false, reason: 'inactive' };
  }

  await recordLogin(normalized, 'login_success', user.id);
  return issueSession(user, remember);
}

/** First active HR email for deactivated-account messaging (public on login). */
export async function hrContactEmail(): Promise<string | null> {
  const hr = await prisma.user.findFirst({
    where: { role: Role.hr, is_active: true },
    orderBy: { created_at: 'asc' },
    select: { email: true },
  });
  if (hr) return hr.email;
  const admin = await prisma.user.findFirst({
    where: { role: Role.super_admin, is_active: true },
    orderBy: { created_at: 'asc' },
    select: { email: true },
  });
  return admin?.email ?? null;
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
  if (!existing.user.is_active || existing.user.login_enabled === false) {
    return { ok: false, reason: 'inactive' };
  }

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
  } else if (!existing.revoked_at) {
    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revoked_at: new Date() },
    });
  }
  const owner = await prisma.user.findUnique({
    where: { id: existing.user_id },
    select: { email: true },
  });
  await recordLogin(owner?.email ?? 'unknown', 'logout', existing.user_id);
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

const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function resetCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
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
      login_enabled: true,
      secondary_email: true,
    },
  });

  if (!user?.is_active || user.login_enabled === false || !user.secondary_email) {
    return { message: FORGOT_PASSWORD_SUCCESS_MESSAGE };
  }

  const recoveryTo = assertEmail(user.secondary_email);
  const code = resetCode();
  await prisma.passwordReset.updateMany({
    where: { user_id: user.id, used_at: null },
    data: { used_at: new Date() },
  });
  const created = await prisma.passwordReset.create({
    data: {
      user_id: user.id,
      code_hash: hashRefreshToken(code),
      expires_at: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  try {
    await sendPasswordResetEmail({
      to: recoveryTo,
      loginEmail: user.email,
      code,
      idempotencyKey: `password-reset/${user.id}/${randomUUID()}`,
    });
  } catch (err) {
    console.error('Password reset email failed:', err);
    await prisma.passwordReset.update({
      where: { id: created.id },
      data: { used_at: new Date() },
    });
    return { message: FORGOT_PASSWORD_SUCCESS_MESSAGE };
  }

  await writeAudit(null, 'auth.forgot_password', 'user', user.id);
  return { message: FORGOT_PASSWORD_SUCCESS_MESSAGE };
}

export async function verifyPasswordResetCode(
  email: unknown,
  code: unknown,
): Promise<{ resetToken: string }> {
  const invalid = new HttpError(400, 'That code is not valid or has expired');
  if (typeof email !== 'string' || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    throw invalid;
  }

  const normalized = assertEmail(email);
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, is_active: true, login_enabled: true },
  });
  if (!user?.is_active || user.login_enabled === false) throw invalid;

  const reset = await prisma.passwordReset.findFirst({
    where: {
      user_id: user.id,
      used_at: null,
      token_hash: null,
      expires_at: { gt: new Date() },
    },
    orderBy: { created_at: 'desc' },
  });
  if (!reset || reset.attempts >= MAX_OTP_ATTEMPTS) throw invalid;

  if (hashRefreshToken(code.trim()) !== reset.code_hash) {
    await prisma.passwordReset.update({
      where: { id: reset.id },
      data: { attempts: { increment: 1 } },
    });
    throw invalid;
  }

  const resetToken = generateRefreshToken();
  await prisma.passwordReset.update({
    where: { id: reset.id },
    data: {
      token_hash: hashRefreshToken(resetToken),
      expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });
  return { resetToken };
}

export async function completePasswordReset(
  token: unknown,
  password: unknown,
): Promise<{ message: string }> {
  if (typeof token !== 'string' || !token) {
    throw new HttpError(400, 'Reset session expired. Request a new code.');
  }
  if (typeof password !== 'string') throw new HttpError(400, 'Password is required');
  assertPassword(password);

  const reset = await prisma.passwordReset.findFirst({
    where: { token_hash: hashRefreshToken(token), used_at: null, expires_at: { gt: new Date() } },
  });
  if (!reset) throw new HttpError(400, 'Reset session expired. Request a new code.');

  const password_hash = await hashPassword(password);
  await prisma.user.update({
    where: { id: reset.user_id },
    data: { password_hash, password_changed_at: new Date() },
  });
  await prisma.passwordReset.update({
    where: { id: reset.id },
    data: { used_at: new Date() },
  });
  await revokeAllRefreshTokens(reset.user_id);

  const owner = await prisma.user.findUnique({
    where: { id: reset.user_id },
    select: { email: true },
  });
  await writeAudit(null, 'auth.password_reset', 'user', reset.user_id);
  await recordLogin(owner?.email ?? 'unknown', 'password_reset', reset.user_id);
  return { message: 'Password saved. Sign in with your new password.' };
}

export async function listSessions(userId: string, currentToken: string | undefined) {
  const currentHash = currentToken ? hashRefreshToken(currentToken) : '';
  const rows = await prisma.refreshToken.findMany({
    where: { user_id: userId, revoked_at: null, expires_at: { gt: new Date() } },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      created_at: true,
      remember_me: true,
      expires_at: true,
      token_hash: true,
    },
  });
  return rows.map(({ token_hash, ...row }) => ({ ...row, current: token_hash === currentHash }));
}

export async function revokeOtherSessions(userId: string, currentToken: string | undefined) {
  const currentHash = currentToken ? hashRefreshToken(currentToken) : '';
  await prisma.refreshToken.updateMany({
    where: { user_id: userId, revoked_at: null, NOT: { token_hash: currentHash } },
    data: { revoked_at: new Date() },
  });
}

export async function revokeSession(userId: string, sessionId: string) {
  const result = await prisma.refreshToken.updateMany({
    where: { id: sessionId, user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() },
  });
  if (result.count === 0) throw new HttpError(404, 'Session not found');
}

export async function personActivity(userId: string) {
  const [events, audits, pay] = await Promise.all([
    prisma.loginEvent.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 20,
    }),
    prisma.auditLog.findMany({
      where: { OR: [{ actor_id: userId }, { target_id: userId }] },
      orderBy: { created_at: 'desc' },
      take: 20,
    }),
    prisma.salaryChange.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 8,
    }),
  ]);
  const items = [
    ...events.map((event) => ({
      id: event.id,
      at: event.created_at,
      label: event.event.replace(/_/g, ' '),
      detail: event.email,
    })),
    ...audits.map((entry) => ({
      id: entry.id,
      at: entry.created_at,
      label: entry.action,
      detail: entry.detail,
    })),
    ...pay.map((change) => ({
      id: change.id,
      at: change.created_at,
      label: 'salary change',
      detail: `Basic ${change.salary_basic}, allowance ${change.salary_allowance}, deduction ${change.salary_deduction}`,
    })),
  ];
  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items.slice(0, 30);
}
