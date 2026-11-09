import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canAccessPath, safeNextPath } from '@/lib/auth/guards';
import { parseSessionToken, readAccessTokenFromRequest, REFRESH_COOKIE } from '@/lib/auth/tokens';

/**
 * Route guard: valid access token (cookie or Bearer) required for protected routes.
 * No valid access → try refresh cookie once, else /login.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await parseSessionToken(readAccessTokenFromRequest(request));

  if (pathname === '/login') {
    if (session) {
      return NextResponse.redirect(
        new URL(safeNextPath(request.nextUrl.searchParams.get('next')), request.url),
      );
    }
    return NextResponse.next();
  }

  const decision = canAccessPath(pathname, session?.role ?? null);

  if (decision === 'login') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const returnTo = `${pathname}${search}`;
    const hasRefresh = Boolean(request.cookies.get(REFRESH_COOKIE)?.value?.trim());
    if (hasRefresh && !pathname.startsWith('/api/auth/refresh')) {
      const refreshUrl = new URL('/api/auth/refresh', request.url);
      refreshUrl.searchParams.set('next', returnTo);
      return NextResponse.redirect(refreshUrl);
    }

    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('next', returnTo);
    }
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
