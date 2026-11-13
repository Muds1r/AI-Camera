'use client';

import { useState } from 'react';
import { cardClass } from '@/components/page-frame';
import { EmptyState, Pagination } from '@/components/widgets';

export interface ActivityItem {
  id: string;
  at: string;
  label: string;
  detail: string | null;
}

const LABELS: Record<string, string> = {
  login_success: 'Signed in',
  'login success': 'Signed in',
  login_failure: 'Sign-in failed',
  'login failure': 'Sign-in failed',
  login_blocked: 'Sign-in blocked',
  'login blocked': 'Sign-in blocked',
  logout: 'Signed out',
  password_reset: 'Password reset',
  'password reset': 'Password reset',
  'salary change': 'Salary updated',
};

function titleFor(label: string) {
  const known = LABELS[label] ?? LABELS[label.toLowerCase()];
  if (known) return known;
  const words = label.replace(/[._]/g, ' ').trim();
  if (!words) return 'Activity';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function when(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 16).replace('T', ' ');
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function ActivityList({
  items,
  pageSize = 6,
  framed = true,
}: {
  items: ActivityItem[];
  pageSize?: number;
  framed?: boolean;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  const visible = items.slice(start, start + pageSize);

  if (items.length === 0) {
    return <EmptyState>No activity yet.</EmptyState>;
  }

  const list = (
    <>
      <ul className="divide-line divide-y">
        {visible.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
            <div className="min-w-0">
              <p className="text-ink text-sm font-medium">{titleFor(item.label)}</p>
              {item.detail ? (
                <p className="text-mute mt-0.5 text-xs leading-relaxed">{item.detail}</p>
              ) : null}
            </div>
            <time className="text-mute shrink-0 text-xs" dateTime={item.at}>
              {when(item.at)}
            </time>
          </li>
        ))}
      </ul>
      {items.length > pageSize ? (
        <Pagination
          page={current}
          totalPages={totalPages}
          total={items.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      ) : null}
    </>
  );

  if (!framed) return list;
  return <div className={`${cardClass} overflow-hidden`}>{list}</div>;
}
