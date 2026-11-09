import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canAccessPath, safeNextPath } from '@/lib/auth/guards';
import { ACCESS_COOKIE, parseSessionToken, REFRESH_COOKIE } from '@/lib/auth/tokens';

/**
 * Next.js 16 renamed middleware.ts to proxy.ts. This is the route guard:
 * it verifies the access token and sends people without a session to login,
 * or through the refresh endpoint when the refresh cookie is still valid.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await parseSessionToken(request.cookies.get(ACCESS_COOKIE)?.value);
  const hasRefresh = Boolean(request.cookies.get(REFRESH_COOKIE)?.value);

  if (pathname === '/login' && session) {
    return NextResponse.redirect(
      new URL(safeNextPath(request.nextUrl.searchParams.get('next')), request.url),
    );
  }

  if (pathname === '/login' && !session && hasRefresh) {
    const refreshUrl = new URL('/api/auth/refresh', request.url);
    refreshUrl.searchParams.set('next', safeNextPath(request.nextUrl.searchParams.get('next')));
    return NextResponse.redirect(refreshUrl);
  }

  const decision = canAccessPath(pathname, session?.role ?? null);

  if (decision === 'login') {
    if (!pathname.startsWith('/api/') && hasRefresh) {
      const refreshUrl = new URL('/api/auth/refresh', request.url);
      refreshUrl.searchParams.set('next', `${pathname}${search}`);
      return NextResponse.redirect(refreshUrl);
    }

    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (decision === 'deny') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const headers = new Headers(request.headers);
  headers.delete('x-user-id');
  headers.delete('x-user-role');
  headers.delete('x-user-email');
  if (session) {
    headers.set('x-user-id', session.sub);
    headers.set('x-user-role', session.role);
    headers.set('x-user-email', session.email);
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
