import type { NextRequest } from 'next/server';

export const ACCESS_COOKIE = 'access_token';

/** Cookie first, then `Authorization: Bearer` (matches the Express API). */
export function readAccessTokenFromRequest(request: NextRequest): string | undefined {
  const cookie = request.cookies.get(ACCESS_COOKIE)?.value?.trim();
  if (cookie) return cookie;

  const header = request.headers.get('authorization');
  if (header?.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    if (token) return token;
  }

  return undefined;
}
