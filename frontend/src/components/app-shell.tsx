'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ApiError, apiJson } from '@/lib/api';
import { redirectToLogin } from '@/lib/auth/redirect';
import { APP_NAME } from '@/lib/brand';
import { ROLE_LABELS, type Role } from '@/lib/auth/permissions';
import type { SessionUser } from '@/lib/auth/types';
import { Breadcrumb, pageCrumbs } from '@/components/breadcrumbs';
import { NotificationBell } from '@/components/notification-bell';
import { ThemeToggle } from '@/components/theme-toggle';

const BASE_NAV: Record<Role, { href: string; label: string }[]> = {
  employee: [
    { href: '/', label: 'Dashboard' },
    { href: '/attendance', label: 'Attendance' },
    { href: '/requests', label: 'Requests' },
    { href: '/salary', label: 'Pay & Benefits' },
  ],
  hr: [
    { href: '/', label: 'Dashboard' },
    { href: '/hr/employees', label: 'Employees' },
    { href: '/hr/attendance', label: 'Attendance' },
    { href: '/hr/requests', label: 'Approvals' },
    { href: '/hr/announcements', label: 'Announcements' },
    { href: '/hr/company', label: 'Company' },
  ],
  super_admin: [
    { href: '/', label: 'Dashboard' },
    { href: '/admin/hr', label: 'HR Accounts' },
    { href: '/admin/logs', label: 'Activity' },
    { href: '/finance/claims', label: 'Claims' },
    { href: '/cameras', label: 'Cameras' },
    { href: '/operations', label: 'Operations' },
  ],
  dataview: [
    { href: '/', label: 'Dashboard' },
    { href: '/attendance', label: 'Attendance' },
    { href: '/cameras', label: 'Cameras' },
    { href: '/operations', label: 'Operations' },
  ],
  finance: [
    { href: '/', label: 'Dashboard' },
    { href: '/finance/claims', label: 'Claims' },
  ],
};

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

const WORKSPACE_CRUMB: Partial<Record<Role, string>> = {
  hr: 'HR',
  employee: 'Employee',
  dataview: 'DataView',
  finance: 'Finance',
  super_admin: 'Administration',
};

export function AppShell({
  title,
  workspaceLabel,
  actions,
  children,
}: {
  title: string;
  description?: string;
  workspaceLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [open, setOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      if (window.localStorage.getItem('nav-open') === '0') setOpen(false);
    });
    apiJson<{ user: SessionUser }>('/api/auth/me', undefined, { silent: true })
      .then((data) => setUser(data.user))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          redirectToLogin();
          return;
        }
        setUser(null);
      });
    apiJson<{ company: { logo_url: string | null } }>('/api/company')
      .then((data) => setLogoUrl(data.company.logo_url))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function close(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  function toggleSidebar() {
    setOpen((current) => {
      const next = !current;
      window.localStorage.setItem('nav-open', next ? '1' : '0');
      return next;
    });
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const links = user ? [...BASE_NAV[user.role], { href: '/policies', label: 'Policies' }] : [];
  const workspace = workspaceLabel ?? (user ? WORKSPACE_CRUMB[user.role] : undefined);
  const crumbs = pageCrumbs(pathname, title, user ? WORKSPACE_CRUMB[user.role] : undefined);

  return (
    <div className="text-ink flex min-h-screen">
      <aside
        className={`border-line bg-paper/98 sticky top-0 flex h-screen shrink-0 flex-col border-r backdrop-blur-md transition-[width] duration-200 ease-out ${
          open ? 'w-[17rem]' : 'w-0 overflow-hidden border-r-0'
        }`}
      >
        <div className="border-line flex h-[3.75rem] items-center gap-2.5 border-b px-3.5">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Close menu"
            className="text-mute hover:bg-surface hover:text-ink rounded-md p-2"
          >
            <MenuIcon />
          </button>
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="border-line ring-line/80 h-9 w-9 rounded-[var(--app-radius-md)] border object-cover ring-1"
              />
            ) : (
              <span className="from-primary to-accent text-primary-on flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--app-radius-md)] bg-gradient-to-br text-sm font-bold shadow-[0_2px_10px_color-mix(in_srgb,var(--app-accent)_35%,transparent)]">
                {APP_NAME.slice(0, 1)}
              </span>
            )}
            <span className="min-w-0">
              <span className="text-display text-ink block truncate text-sm font-bold">
                {APP_NAME}
              </span>
              {workspace ? (
                <span className="text-mute text-caption block truncate text-[10px] font-medium uppercase">
                  {workspace}
                </span>
              ) : null}
            </span>
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2.5 py-3 pb-6">
          {links.map((link) => {
            const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`focus-visible:outline-primary rounded-[var(--app-radius-md)] px-3 py-2.5 text-[13px] font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  active ? 'nav-active font-semibold' : 'text-mute hover:bg-surface hover:text-ink'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-paper/85 shadow-header sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b px-4 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            {open ? null : (
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Open menu"
                className="text-ink hover:bg-surface rounded-md p-2"
              >
                <MenuIcon />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-display truncate text-lg font-bold">{title}</h1>
              {crumbs.length > 0 ? <Breadcrumb crumbs={crumbs} /> : null}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {actions}
            {user ? <NotificationBell /> : null}
            <ThemeToggle />
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  aria-label="Account menu"
                  onClick={() => setMenuOpen((current) => !current)}
                  className="border-line ring-accent/30 hover:ring-accent/50 block h-9 w-9 overflow-hidden rounded-full border ring-2 transition"
                >
                  {user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="from-surface to-bg-accent text-navy dark:text-ink flex h-full w-full items-center justify-center bg-gradient-to-b text-[11px] font-bold">
                      {initials(user.full_name)}
                    </span>
                  )}
                </button>
                {menuOpen ? (
                  <div className="border-line bg-paper absolute right-0 mt-1.5 w-48 rounded-lg border p-1 shadow-[0_8px_24px_var(--app-shadow)]">
                    <p className="text-ink px-2 pt-1.5 text-sm font-medium">{user.full_name}</p>
                    <p className="text-mute px-2 pb-2 text-xs">{ROLE_LABELS[user.role]}</p>
                    <Link
                      href="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="hover:bg-surface block rounded-md px-2 py-1.5 text-sm"
                    >
                      Profile
                    </Link>
                    <button
                      type="button"
                      onClick={logout}
                      className="hover:bg-surface w-full rounded-md px-2 py-1.5 text-left text-sm"
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </header>
        <main className="animate-page-enter mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeWidth={1.75} d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
