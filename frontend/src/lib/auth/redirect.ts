import { safeNextPath } from './guards';

/** Sends the browser to sign-in, preserving the current path when safe. */
export function redirectToLogin(nextPath?: string): void {
  if (typeof window === 'undefined') return;

  const next =
    nextPath ?? `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const safe = safeNextPath(next);
  const url = safe === '/' ? '/login' : `/login?next=${encodeURIComponent(safe)}`;

  if (window.location.pathname.startsWith('/login')) return;
  window.location.replace(url);
}
