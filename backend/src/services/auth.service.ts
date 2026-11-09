import { randomUUID } from 'crypto';
import { Role, User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/http';
import { verifyPassword, verifyPasswordAgainstDummy } from '../lib/auth/passwords';
import {
  generateRefreshToken,
  hashRefreshToken,
  REFRESH_TTL_SECONDS,
  signAccessToken,
} from '../lib/auth/tokens';
import { assertEmail, PublicUser, toPublicUser } from '../lib/auth/users';

const REUSE_GRACE_MS = 10_000;

export type RefreshFailure = 'invalid' | 'expired' | 'inactive' | 'reused' | 'rotated';

export type SessionResult =
  | { ok: true; accessToken: string; refreshToken: string; user: PublicUser }
  | { ok: false; reason: RefreshFailure };

async function issueSession(user: User): Promise<SessionResult> {
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      user_id: user.id,
      token_hash: hashRefreshToken(refreshToken),
      family_id: randomUUID(),
      expires_at: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
    },
  });

  const accessToken = await signAccessToken(user);
  return { ok: true, accessToken, refreshToken, user: toPublicUser(user) };
}

export async function login(email: unknown, password: unknown): Promise<SessionResult> {
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw new HttpError(400, 'Email and password are required');
  }

  const normalized = assertEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  if (!user) {
    await verifyPasswordAgainstDummy(password);
    return { ok: false, reason: 'invalid' };
  }

  const matches = await verifyPassword(password, user.password_hash);
  if (!matches) return { ok: false, reason: 'invalid' };
  if (!user.is_active) return { ok: false, reason: 'inactive' };

  return issueSession(user);
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
  if (!existing.user.is_active) return { ok: false, reason: 'inactive' };

  const refreshToken = generateRefreshToken();
  const nextId = randomUUID();

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
          expires_at: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
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
  return { ok: true, accessToken, refreshToken, user: toPublicUser(existing.user) };
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
