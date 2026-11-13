'use client';

import Link from 'next/link';

const SECTION_LABELS: Record<string, string> = {
  '/hr': 'HR',
  '/admin': 'Administration',
  '/requests': 'Requests',
  '/salary': 'Payslip',
  '/profile': 'Profile',
  '/cameras': 'Cameras',
  '/operations': 'Operations',
  '/hr/employees': 'Employees',
  '/hr/requests': 'Approvals',
  '/hr/company': 'Company',
  '/hr/announcements': 'Announcements',
  '/admin/hr': 'HR accounts',
  '/admin/logs': 'Activity',
  '/finance': 'Finance',
  '/finance/claims': 'Claims',
  '/policies': 'Policies',
};

export type Crumb = {
  href: string;
  label: string;
};

/**
 * Workspace first, then the page. Dashboard is only the current page on home,
 * never the parent of every other screen.
 */
export function pageCrumbs(pathname: string, title: string, workspace?: string): Crumb[] {
  if (!workspace) return [];
  const root: Crumb = { href: '/', label: workspace };
  if (!pathname || pathname === '/') {
    return [root, { href: '/', label: title || 'Dashboard' }];
  }
  const crumbs: Crumb[] = [root];
  const segments = pathname.split('/').filter(Boolean);
  let path = '';
  segments.forEach((segment, index) => {
    path += `/${segment}`;
    const last = index === segments.length - 1;
    const label = last ? title : (SECTION_LABELS[path] ?? humanize(segment));
    if (!last && label.toLowerCase() === workspace.toLowerCase()) return;
    if (last && crumbs[crumbs.length - 1]?.label === label) return;
    crumbs.push({ href: path, label });
  });
  return crumbs;
}

function humanize(segment: string): string {
  return segment
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="mt-0.5 min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-xs">
        {crumbs.map((crumb, index) => {
          const current = index === crumbs.length - 1;
          return (
            <li key={`${index}-${crumb.label}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? <Chevron /> : null}
              {current ? (
                <span className="text-ink truncate font-medium" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-mute hover:text-ink focus-visible:outline-primary shrink-0 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Chevron() {
  return (
    <svg
      className="text-mute/70 h-3 w-3 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 6l6 6-6 6" />
    </svg>
  );
}
