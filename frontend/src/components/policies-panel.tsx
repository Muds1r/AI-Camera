'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiJson } from '@/lib/api';
import { cardClass, linkMutedClass } from '@/components/page-frame';
import { Pagination } from '@/components/widgets';
import { postedOn } from '@/components/announcements';

interface Policy {
  id: string;
  title: string;
  body: string;
  updated_at: string;
  author: { full_name: string } | null;
}

export function PoliciesPanel() {
  const [items, setItems] = useState<Policy[]>([]);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const pageSize = 4;

  useEffect(() => {
    apiJson<{ policies: Policy[] }>('/api/policies', undefined, { silent: true })
      .then((data) => setItems(data.policies))
      .catch(() => setItems([]))
      .finally(() => setReady(true));
  }, []);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, totalPages);
  const visible = items.slice((current - 1) * pageSize, current * pageSize);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 className="text-display text-ink text-base font-semibold">Policies</h2>
        <Link href="/policies" className={linkMutedClass}>
          All policies
        </Link>
      </div>
      <div className={`${cardClass} overflow-hidden`}>
        {!ready ? <p className="text-mute px-4 py-4 text-sm">Loading policies…</p> : null}
        {ready && items.length === 0 ? (
          <p className="text-mute px-4 py-4 text-sm">No policies yet.</p>
        ) : null}
        {visible.length > 0 ? (
          <ul className="divide-line divide-y">
            {visible.map((item) => {
              const open = openId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : item.id)}
                    className="hover:bg-surface focus-visible:outline-primary flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2"
                  >
                    <span className="min-w-0">
                      <span className="text-ink block truncate text-sm font-medium">
                        {item.title}
                      </span>
                      <span className="text-mute block truncate text-xs">
                        {postedOn(item.updated_at)}
                        {item.author ? ` · ${item.author.full_name}` : ''}
                      </span>
                    </span>
                    <span className="text-mute shrink-0 text-xs font-medium">
                      {open ? 'Hide' : 'Show'}
                    </span>
                  </button>
                  {open ? (
                    <p className="text-ink px-4 pb-3 text-sm leading-relaxed whitespace-pre-wrap">
                      {item.body}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
        {items.length > pageSize ? (
          <Pagination
            page={current}
            totalPages={totalPages}
            total={items.length}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        ) : null}
      </div>
    </section>
  );
}
