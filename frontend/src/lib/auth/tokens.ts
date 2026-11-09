import { jwtVerify } from 'jose';
import { isRole, Role } from './permissions';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const JWT_ISSUER = 'ai-camera';
export const JWT_AUDIENCE = 'ai-camera-web';

export interface SessionClaims {
  sub: string;
  email: string;
  role: Role;
}

function accessSecret(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be set and at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

/** Reads a short-lived access token. Invalid or expired tokens become null. */
export async function parseSessionToken(
  token: string | undefined | null,
): Promise<SessionClaims | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, accessSecret(), {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      clockTolerance: 5,
    });

    if (payload.typ !== 'access') return null;
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null;
    if (!isRole(payload.role)) return null;

    return { sub: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}
