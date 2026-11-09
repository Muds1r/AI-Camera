import { NextRequest, NextResponse } from 'next/server';
import { applySetCookies, backendUrl } from '@/lib/auth/backend';

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const target = backendUrl(`/api/${path.join('/')}`, request.nextUrl.search);
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const cookie = request.headers.get('cookie');
  const authorization = request.headers.get('authorization');

  if (contentType) headers.set('content-type', contentType);
  if (cookie) headers.set('cookie', cookie);
  if (authorization) headers.set('authorization', authorization);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const backend = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: 'no-store',
  });

  const empty = backend.status === 204 || backend.status === 205 || backend.status === 304;
  const response = new NextResponse(empty ? null : await backend.arrayBuffer(), {
    status: backend.status,
    headers: {
      ...(empty
        ? {}
        : { 'content-type': backend.headers.get('content-type') ?? 'application/json' }),
      'cache-control': 'no-store',
    },
  });
  applySetCookies(response, backend);
  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
