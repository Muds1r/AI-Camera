'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { ApiError, apiJson } from '@/lib/api';
import { redirectToLogin } from '@/lib/auth/redirect';

const PUBLIC_PATHS = new Set(['/login']);

/**
 * Client safety net when cookies are cleared while a protected page is still open.
 */
export function SessionGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (PUBLIC_PATHS.has(pathname)) return;

    let cancelled = false;
    apiJson<{ user: { id: string } }>('/api/auth/me')
      .then(() => {
        if (cancelled) return;
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          redirectToLogin(pathname);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
