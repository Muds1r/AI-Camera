import { Request } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../prisma';
import { HttpError } from '../http';
import { ACCESS_COOKIE, parseSessionToken, SessionClaims } from './tokens';
import { readCookie } from './cookies';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  full_name: string;
  is_active: boolean;
}

export function readAccessToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    if (token) return token;
  }
  return readCookie(req.headers.cookie, ACCESS_COOKIE);
}

/**
 * Verifies the access token and loads the account from the database.
 * The database role is what authorization uses, so a role change applies
 * on the next request even if an older access token is still inside its 15 minutes.
 */
export async function authenticateRequest(req: Request): Promise<AuthUser> {
  const claims = await parseSessionToken(readAccessToken(req));
  if (!claims) throw new HttpError(401, 'Unauthorized');
  return loadActiveUser(claims);
}

export async function loadActiveUser(claims: SessionClaims): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, email: true, role: true, full_name: true, is_active: true },
  });

  if (!user || !user.is_active) throw new HttpError(401, 'Unauthorized');
  return user;
}
