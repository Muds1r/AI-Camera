import { isRole, Role } from './permissions';

const PUBLIC_PATHS = new Set([
  '/login',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/company/branding',
]);

const ROLE_PREFIXES: { prefix: string; roles: readonly Role[] }[] = [
  { prefix: '/admin', roles: ['super_admin'] },
  { prefix: '/hr', roles: ['hr', 'super_admin'] },
  { prefix: '/cameras', roles: ['dataview', 'super_admin'] },
  { prefix: '/operations', roles: ['dataview', 'super_admin'] },
  { prefix: '/requests', roles: ['employee', 'hr', 'super_admin'] },
  { prefix: '/salary', roles: ['employee', 'hr', 'super_admin'] },
  { prefix: '/medical', roles: ['employee', 'hr', 'super_admin'] },
  { prefix: '/leave', roles: ['employee', 'hr', 'super_admin'] },
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export type AccessDecision = 'allow' | 'login' | 'deny';

/**
 * Page and API gate used by the Next.js proxy.
 * API permission checks still happen on the backend with the database role.
 */
export function canAccessPath(pathname: string, role: Role | null): AccessDecision {
  if (PUBLIC_PATHS.has(pathname)) return 'allow';
  if (pathname.startsWith('/api/')) return role ? 'allow' : 'login';
  if (!role || !isRole(role)) return 'login';

  const restricted = ROLE_PREFIXES.find((entry) => matchesPrefix(pathname, entry.prefix));
  if (restricted && !restricted.roles.includes(role)) return 'deny';
  return 'allow';
}

/** Allows only same-site relative paths, so a refresh redirect cannot leave the app. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/';
  }
  if (value.includes('://') || value.includes('\\')) return '/';
  return value;
}
