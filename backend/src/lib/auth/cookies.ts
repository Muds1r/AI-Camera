import { Response } from 'express';
import { ACCESS_COOKIE, ACCESS_TTL_SECONDS, REFRESH_COOKIE, refreshTtlSeconds } from './tokens';

type CookieBase = {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge?: number;
};

function cookieBase(maxAgeSeconds?: number): CookieBase {
  const options: CookieBase = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
  if (typeof maxAgeSeconds === 'number') {
    options.maxAge = maxAgeSeconds * 1000;
  }
  return options;
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  rememberMe = false,
): void {
  // Access stays short-lived either way; refresh persistence follows Remember me.
  res.cookie(ACCESS_COOKIE, accessToken, cookieBase(ACCESS_TTL_SECONDS));
  if (rememberMe) {
    res.cookie(REFRESH_COOKIE, refreshToken, cookieBase(refreshTtlSeconds(true)));
  } else {
    // Session cookie: cleared when the browser closes.
    res.cookie(REFRESH_COOKIE, refreshToken, cookieBase());
  }
}

export function clearAuthCookies(res: Response): void {
  const options = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };
  res.clearCookie(ACCESS_COOKIE, options);
  res.clearCookie(REFRESH_COOKIE, options);
}

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;

  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const raw = part.slice(index + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(raw);
    } catch {
      cookies[name] = raw;
    }
  }

  return cookies;
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  const value = parseCookieHeader(header)[name];
  return value || undefined;
}

/** Accepts boolean or common form/JSON truthy strings; everything else is false. */
export function parseRememberMe(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return (
      normalized === 'true' || normalized === '1' || normalized === 'on' || normalized === 'yes'
    );
  }
  return false;
}
