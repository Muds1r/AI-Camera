'use client';

import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { cardClass } from '@/components/page-frame';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
  author: { full_name: string } | null;
  images: { id: string; url: string }[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function postedOn(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-');
  const monthName = MONTHS[Number(month) - 1] ?? month;
  return `${Number(day)} ${monthName} ${year}`;
}

export function AnnouncementsPanel() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<Announcement | null>(null);

  useEffect(() => {
    apiJson<{ announcements: Announcement[] }>('/api/announcements', undefined, { silent: true })
      .then((data) => setItems(data.announcements))
      .catch(() => setItems([]))
      .finally(() => setReady(true));
  }, []);

  const latest = items[0];
  const older = items.slice(1);
  const visibleOlder = expanded ? older : older.slice(0, 3);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-display text-ink text-base font-semibold">Announcements</h2>
        {older.length > 3 ? (
          <button
            type="button"
            className="text-primary text-sm font-medium"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? 'Show less' : `Earlier (${older.length})`}
          </button>
        ) : null}
      </div>

      {!ready ? <p className="text-mute text-sm">Loading announcements…</p> : null}

      {ready && !latest ? <p className="text-mute text-sm">No announcements yet.</p> : null}

      {latest ? (
        <button
          type="button"
          onClick={() => setOpen(latest)}
          className={`${cardClass} hover:border-primary/30 focus-visible:outline-primary overflow-hidden text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}
        >
          {latest.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={latest.images[0].url} alt="" className="h-52 w-full object-cover" />
          ) : null}
          <div className="flex flex-col gap-1.5 p-5">
            <p className="text-mute text-xs">
              {postedOn(latest.created_at)}
              {latest.author ? ` · ${latest.author.full_name}` : ''}
            </p>
            <h3 className="text-ink text-lg font-semibold">{latest.title}</h3>
            {latest.body ? (
              <p className="text-mute line-clamp-3 text-sm leading-relaxed">{latest.body}</p>
            ) : (
              <p className="text-mute text-sm">
                {latest.images.length} {latest.images.length === 1 ? 'photo' : 'photos'}
              </p>
            )}
          </div>
        </button>
      ) : null}

      {visibleOlder.length > 0 ? (
        <ul className={`${cardClass} divide-line divide-y overflow-hidden`}>
          {visibleOlder.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setOpen(item)}
                className="hover:bg-surface focus-visible:outline-primary flex w-full items-center gap-3 px-3 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2"
              >
                {item.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.images[0].url}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-[var(--app-radius-md)] object-cover"
                  />
                ) : (
                  <span className="bg-surface text-mute flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--app-radius-md)] text-xs">
                    Note
                  </span>
                )}
                <span className="min-w-0">
                  <span className="text-ink block truncate text-sm font-medium">{item.title}</span>
                  <span className="text-mute block text-xs">{postedOn(item.created_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open ? <AnnouncementDialog item={open} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}

export function AnnouncementDialog({ item, onClose }: { item: Announcement; onClose: () => void }) {
  const [imageIndex, setImageIndex] = useState(0);
  const image = item.images[imageIndex] ?? item.images[0];

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="bg-overlay fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-title"
        className={`${cardClass} max-h-[min(42rem,90vh)] w-full max-w-2xl overflow-y-auto`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div className="min-w-0">
            <p className="text-mute text-xs">
              {postedOn(item.created_at)}
              {item.author ? ` · ${item.author.full_name}` : ''}
            </p>
            <h2 id="announcement-title" className="text-ink mt-1 text-xl font-semibold">
              {item.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-mute hover:bg-surface hover:text-ink rounded-md px-2 py-1 text-sm"
          >
            Close
          </button>
        </div>

        {image ? (
          <div className="mt-4 px-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt=""
              className="max-h-80 w-full rounded-[var(--app-radius-lg)] object-cover"
            />
            {item.images.length > 1 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {item.images.map((photo, index) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setImageIndex(index)}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-[var(--app-radius-md)] border ${
                      index === imageIndex ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {item.body ? (
          <p className="text-ink px-5 py-5 text-sm leading-relaxed whitespace-pre-wrap">
            {item.body}
          </p>
        ) : (
          <div className="h-5" />
        )}
      </div>
    </div>
  );
}
