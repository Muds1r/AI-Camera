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
import { ThemeToggle } from '@/components/theme-toggle';

const NAV: Record<Role, { href: string; label: string }[]> = {
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
    { href: '/hr/requests', label: 'Requests & Approvals' },
    { href: '/hr/company', label: 'Company Settings' },
  ],
  super_admin: [
    { href: '/', label: 'Dashboard' },
    { href: '/admin/hr', label: 'HR Accounts' },
    { href: '/admin/logs', label: 'Activity Logs' },
  ],
  dataview: [
    { href: '/', label: 'Dashboard' },
    { href: '/attendance', label: 'Attendance' },
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

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
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
    apiJson<{ user: SessionUser }>('/api/auth/me')
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

  const links = user ? NAV[user.role] : [];

  return (
    <div className="bg-bg text-ink flex min-h-screen">
      <aside
        className={`border-line bg-paper sticky top-0 flex h-screen shrink-0 flex-col border-r transition-[width] duration-200 ${
          open ? 'w-[17.5rem]' : 'w-0 overflow-hidden border-r-0'
        }`}
      >
        <div className="border-line flex h-[3.75rem] items-center gap-3 border-b px-4">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Close menu"
            className="text-mute hover:bg-surface hover:text-ink rounded-lg p-2"
          >
            <MenuIcon />
          </button>
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="border-line h-9 w-9 rounded-lg border object-cover"
              />
            ) : (
              <span className="bg-primary text-primary-on flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold shadow-sm">
                {APP_NAME.slice(0, 1)}
              </span>
            )}
            <span className="min-w-0 truncate">
              <span className="block text-base font-bold tracking-tight">{APP_NAME}</span>
              <span className="text-mute block text-[11px] font-medium">Workforce</span>
            </span>
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          {links.map((link) => {
            const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`focus-visible:outline-primary rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  active
                    ? 'bg-primary-soft text-primary'
                    : 'text-mute hover:bg-surface hover:text-ink'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-paper/90 sticky top-0 z-30 flex h-[3.75rem] items-center justify-between gap-4 border-b px-5 backdrop-blur-sm sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {open ? null : (
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Open menu"
                className="text-ink hover:bg-surface rounded-lg p-2"
              >
                <MenuIcon />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight">{title}</h1>
              {description ? (
                <p className="text-mute truncate text-sm font-medium">{description}</p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <ThemeToggle />
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  aria-label="Account menu"
                  onClick={() => setMenuOpen((current) => !current)}
                  className="border-line hover:ring-primary/25 block h-9 w-9 overflow-hidden rounded-full border ring-0 ring-transparent transition hover:ring-2"
                >
                  {user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="bg-primary text-primary-on flex h-full w-full items-center justify-center text-xs font-bold">
                      {initials(user.full_name)}
                    </span>
                  )}
                </button>
                {menuOpen ? (
                  <div className="border-line bg-paper absolute right-0 mt-2 w-52 rounded-xl border p-1.5 shadow-lg">
                    <p className="px-2.5 pt-2 text-sm font-bold">{user.full_name}</p>
                    <p className="text-mute px-2.5 pb-2 text-xs font-medium">
                      {ROLE_LABELS[user.role]}
                    </p>
                    <Link
                      href="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="hover:bg-surface block rounded-lg px-2.5 py-2 text-sm font-medium"
                    >
                      Profile
                    </Link>
                    <button
                      type="button"
                      onClick={logout}
                      className="hover:bg-surface w-full rounded-lg px-2.5 py-2 text-left text-sm font-medium"
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-7 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
