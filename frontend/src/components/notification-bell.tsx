'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { apiJson } from '@/lib/api';
import { notifyError, notifyInfo, notifySuccess } from '@/components/toast';

type Kind = 'request_submitted' | 'request_approved' | 'request_rejected';

type Item = {
  id: string;
  kind: Kind;
  title: string;
  body: string;
  href: string;
  is_read: boolean;
  created_at: string;
};

type Payload = {
  notifications: Item[];
  unread: number;
};

const EMPTY: Payload = { notifications: [], unread: 0 };
const POLL_MS = 20_000;

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function dotClass(kind: Kind): string {
  if (kind === 'request_approved') return 'bg-success';
  if (kind === 'request_rejected') return 'bg-danger';
  return 'bg-accent';
}

function announce(item: Item) {
  if (item.kind === 'request_approved') notifySuccess(item.title, item.body);
  else if (item.kind === 'request_rejected') notifyError(item.title, item.body);
  else notifyInfo(item.title, item.body);
}

export function NotificationBell() {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const seenRef = useRef<Set<string> | null>(null);
  const locallyRead = useRef<Set<string>>(new Set());
  const refreshRef = useRef<() => void>(() => undefined);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Payload>(EMPTY);

  useEffect(() => {
    let active = true;

    async function load(announceNew: boolean) {
      try {
        const next = await apiJson<Payload>('/api/notifications', undefined, { silent: true });
        if (!active) return;
        for (const item of next.notifications) {
          if (item.is_read) locallyRead.current.delete(item.id);
        }
        const notifications = next.notifications.map((item) =>
          locallyRead.current.has(item.id) ? { ...item, is_read: true } : item,
        );
        const hiddenUnread = next.notifications.filter(
          (item) => !item.is_read && locallyRead.current.has(item.id),
        ).length;
        const merged = { notifications, unread: Math.max(0, next.unread - hiddenUnread) };
        if (announceNew && seenRef.current) {
          const fresh = merged.notifications.find(
            (item) => !item.is_read && !seenRef.current?.has(item.id),
          );
          if (fresh) announce(fresh);
        }
        seenRef.current = new Set(merged.notifications.map((item) => item.id));
        setData(merged);
      } catch {
        // The badge stays on the last successful list. A later poll retries.
      }
    }

    refreshRef.current = () => void load(false);

    void load(false);
    const timer = window.setInterval(() => void load(true), POLL_MS);
    function onFocus() {
      void load(true);
    }
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  async function markRead(item: Item) {
    if (item.is_read) return;
    locallyRead.current.add(item.id);
    setData((current) => ({
      unread: Math.max(0, current.unread - 1),
      notifications: current.notifications.map((row) =>
        row.id === item.id ? { ...row, is_read: true } : row,
      ),
    }));
    try {
      await apiJson(`/api/notifications/${item.id}/read`, { method: 'PATCH' }, { silent: true });
    } catch {
      locallyRead.current.delete(item.id);
      setData((current) => ({
        unread: current.unread + 1,
        notifications: current.notifications.map((row) =>
          row.id === item.id ? { ...row, is_read: false } : row,
        ),
      }));
    }
  }

  async function markAll() {
    const previous = data;
    for (const row of data.notifications) locallyRead.current.add(row.id);
    setData({
      unread: 0,
      notifications: data.notifications.map((row) => ({ ...row, is_read: true })),
    });
    try {
      await apiJson('/api/notifications/read', { method: 'POST' }, { silent: true });
    } catch {
      for (const row of previous.notifications) locallyRead.current.delete(row.id);
      setData(previous);
    }
  }

  const label = data.unread > 0 ? `Notifications, ${data.unread} unread` : 'Notifications';

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => {
            if (!current) refreshRef.current();
            return !current;
          });
        }}
        className="text-ink hover:bg-surface relative rounded-md p-2"
      >
        <BellIcon />
        {data.unread > 0 ? (
          <span className="bg-danger absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white">
            {data.unread > 9 ? '9+' : data.unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className="border-line bg-paper absolute right-0 z-40 mt-1.5 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border shadow-[0_8px_24px_var(--app-shadow)]"
        >
          <div className="border-line flex items-center justify-between gap-3 border-b px-3 py-2.5">
            <p className="text-ink text-sm font-semibold">Notifications</p>
            {data.unread > 0 ? (
              <button
                type="button"
                onClick={() => void markAll()}
                className="text-primary hover:text-primary-hover text-xs font-medium"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          {data.notifications.length === 0 ? (
            <p className="text-mute px-3 py-8 text-center text-sm">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {data.notifications.map((item) => (
                <li key={item.id} className="border-line border-b last:border-b-0">
                  <Link
                    href={item.href}
                    onClick={() => {
                      setOpen(false);
                      void markRead(item);
                    }}
                    className={`hover:bg-surface flex gap-2.5 px-3 py-2.5 ${item.is_read ? '' : 'bg-primary-soft'}`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.is_read ? 'bg-line' : dotClass(item.kind)}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-ink truncate text-sm font-medium">{item.title}</span>
                        <span className="text-mute shrink-0 text-[11px]">
                          {timeAgo(item.created_at)}
                        </span>
                      </span>
                      <span className="text-mute mt-0.5 block text-xs leading-relaxed">
                        {item.body}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0"
      />
    </svg>
  );
}
