import { NextRequest, NextResponse } from 'next/server';
import { applySetCookies, backendUrl } from '@/lib/auth/backend';
import { safeNextPath } from '@/lib/auth/guards';

async function refresh(request: NextRequest): Promise<Response> {
  return fetch(backendUrl('/api/auth/refresh'), {
    method: 'POST',
    headers: { cookie: request.headers.get('cookie') ?? '' },
    cache: 'no-store',
  });
}

export async function GET(request: NextRequest) {
  const backend = await refresh(request);
  const nextPath = safeNextPath(request.nextUrl.searchParams.get('next'));

  if (!backend.ok) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    applySetCookies(response, backend);
    return response;
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  applySetCookies(response, backend);
  return response;
}

export async function POST(request: NextRequest) {
  const backend = await refresh(request);
  const response = new NextResponse(await backend.arrayBuffer(), {
    status: backend.status,
    headers: {
      'content-type': backend.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    },
  });
  applySetCookies(response, backend);
  return response;
}
