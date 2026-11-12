import { createHmac, randomBytes } from 'crypto';
import { Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { isRole } from './permissions';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const ACCESS_TTL_SECONDS = 15 * 60;
/** Browser-session login: refresh lives until the tab/browser closes (DB cap). */
export const SESSION_REFRESH_TTL_SECONDS = 12 * 60 * 60;
/** Remember-me login: persistent refresh cookie and matching DB expiry. */
export const REMEMBER_REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
/** @deprecated Prefer SESSION_REFRESH_TTL_SECONDS / REMEMBER_REFRESH_TTL_SECONDS */
export const REFRESH_TTL_SECONDS = SESSION_REFRESH_TTL_SECONDS;

export function refreshTtlSeconds(rememberMe: boolean): number {
  return rememberMe ? REMEMBER_REFRESH_TTL_SECONDS : SESSION_REFRESH_TTL_SECONDS;
}
export const JWT_ISSUER = 'ai-camera';
export const JWT_AUDIENCE = 'ai-camera-web';

export interface SessionClaims {
  sub: string;
  email: string;
  role: Role;
}

export function assertAuthConfig(): void {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be set and at least 32 characters');
  }
}

function accessSecret(): string {
  assertAuthConfig();
  return process.env.JWT_ACCESS_SECRET!;
}

function refreshKey(): string {
  assertAuthConfig();
  return process.env.REFRESH_TOKEN_SECRET || process.env.JWT_ACCESS_SECRET!;
}

export async function signAccessToken(user: {
  id: string;
  email: string;
  role: Role;
}): Promise<string> {
  return jwt.sign({ email: user.email, role: user.role, typ: 'access' }, accessSecret(), {
    algorithm: 'HS256',
    subject: user.id,
    expiresIn: ACCESS_TTL_SECONDS,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

/** Returns the session inside a valid access token, or null when it is missing or rejected. */
export async function parseSessionToken(
  token: string | undefined | null,
): Promise<SessionClaims | null> {
  if (!token) return null;

  try {
    const payload = jwt.verify(token, accessSecret(), {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      clockTolerance: 5,
    });

    if (typeof payload === 'string' || payload.typ !== 'access') return null;
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null;
    if (!isRole(payload.role)) return null;

    return { sub: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHmac('sha256', refreshKey()).update(token).digest('hex');
}
