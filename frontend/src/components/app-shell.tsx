'use client';

import { type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiJson } from '@/lib/api';
import { ROLE_LABELS, type Role } from '@/lib/auth/permissions';
import type { SessionUser } from '@/lib/auth/types';

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
    { href: '/admin/settings', label: 'System Settings' },
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
  const [companyName, setCompanyName] = useState('TruckFlow');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('TruckFlow');

  useEffect(() => {
    queueMicrotask(() => {
      if (window.localStorage.getItem('nav-open') === '0') setOpen(false);
    });
    apiJson<{ user: SessionUser }>('/api/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null));
    apiJson<{ company: { name: string; logo_url: string | null } }>('/api/company')
      .then((data) => {
        setCompanyName(data.company.name);
        setLogoUrl(data.company.logo_url);
      })
      .catch(() => setCompanyName('Camera'));
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

  async function saveCompanyName(event?: FormEvent) {
    event?.preventDefault();
    const name = nameDraft.trim();
    setEditingName(false);
    if (!name || name === companyName) return;
    const data = await apiJson<{ company: { name: string } }>('/api/company', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
    setCompanyName(data.company.name);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const links = user ? NAV[user.role] : [];

  return (
    <div className="bg-canvas text-ink flex min-h-screen">
      <aside
        className={`bg-accent sticky top-0 flex h-screen shrink-0 flex-col text-white transition-[width] duration-200 ${
          open ? 'w-64' : 'w-0 overflow-hidden'
        }`}
      >
        <div className="flex h-16 items-center gap-3 px-4">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Close menu"
            className="rounded-md p-1.5 hover:bg-white/10"
          >
            <MenuIcon />
          </button>
          {editingName ? (
            <form onSubmit={saveCompanyName} className="flex min-w-0 flex-1 items-center gap-2">
              <input
                autoFocus
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                className="text-ink w-full rounded-md bg-white px-2 py-1 text-base font-extrabold"
              />
              <button type="submit" className="text-warm shrink-0 text-xs font-extrabold">
                Save
              </button>
            </form>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {logoUrl ? (
                // Company logos are uploaded files served by our API.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
              ) : null}
              <Link href="/" className="truncate text-xl font-extrabold tracking-tight">
                {companyName}
              </Link>
              {user?.role === 'super_admin' || user?.role === 'hr' ? (
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(companyName);
                    setEditingName(true);
                  }}
                  className="shrink-0 text-xs font-bold text-white/80 hover:text-white"
                >
                  Edit
                </button>
              ) : null}
            </div>
          )}
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {links.map((link) => {
            const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-base font-extrabold ${
                  active ? 'bg-teal text-white' : 'text-white/90 hover:bg-white/10'
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${active ? 'bg-white' : 'bg-teal'}`}
                />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-paper sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b px-6">
          <div className="flex min-w-0 items-center gap-3">
            {open ? null : (
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Open menu"
                className="text-ink hover:bg-canvas rounded-md p-1.5"
              >
                <MenuIcon />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-lg font-extrabold tracking-tight">{title}</h1>
              {description ? <p className="text-mute truncate text-sm">{description}</p> : null}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {actions}
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  aria-label="Account menu"
                  onClick={() => setMenuOpen((current) => !current)}
                  className="border-line block h-9 w-9 overflow-hidden rounded-full border"
                >
                  {user.avatar_url ? (
                    // User uploads are served from our own API, including a preview of the saved file.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="bg-accent flex h-full w-full items-center justify-center text-xs font-extrabold text-white">
                      {initials(user.full_name)}
                    </span>
                  )}
                </button>
                {menuOpen ? (
                  <div className="border-line bg-paper absolute right-0 mt-2 w-56 rounded-md border p-2 shadow-sm">
                    <p className="px-2 pt-1 font-extrabold">{user.full_name}</p>
                    <p className="text-mute px-2 pb-2 text-sm">{ROLE_LABELS[user.role]}</p>
                    <Link
                      href="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="hover:bg-canvas block rounded-md px-2 py-2 text-sm font-bold"
                    >
                      Edit profile
                    </Link>
                    <button
                      type="button"
                      onClick={logout}
                      className="hover:bg-canvas w-full rounded-md px-2 py-2 text-left text-sm font-bold"
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </header>
        <div className="flex-1 px-6 py-8">{children}</div>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeWidth={2.4} d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
