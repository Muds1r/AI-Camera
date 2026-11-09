import type { NextRequest } from 'next/server';
import { ACCESS_COOKIE, readAccessTokenFromRequest } from '@/lib/auth/access-token';

function mockRequest(parts: { cookie?: string; authorization?: string }): NextRequest {
  return {
    cookies: {
      get: (name: string) =>
        name === ACCESS_COOKIE && parts.cookie ? { value: parts.cookie } : undefined,
    },
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'authorization' ? (parts.authorization ?? null) : null,
    },
  } as unknown as NextRequest;
}

describe('readAccessTokenFromRequest', () => {
  it('prefers the access cookie over the Authorization header', () => {
    const req = mockRequest({
      cookie: 'cookie-token',
      authorization: 'Bearer header-token',
    });
    expect(readAccessTokenFromRequest(req)).toBe('cookie-token');
  });

  it('falls back to Bearer when the cookie is missing', () => {
    const req = mockRequest({ authorization: 'Bearer header-token' });
    expect(readAccessTokenFromRequest(req)).toBe('header-token');
  });

  it('returns undefined when neither cookie nor bearer is present', () => {
    expect(readAccessTokenFromRequest(mockRequest({}))).toBeUndefined();
  });
});
