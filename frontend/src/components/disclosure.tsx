'use client';

import { useState, type ReactNode } from 'react';
import { cardClass } from '@/components/page-frame';

export function Disclosure({
  title,
  description,
  children,
  defaultOpen = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`${cardClass} overflow-hidden`}>
      <button
        type="button"
        className="hover:bg-surface/60 flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0">
          <span className="text-ink block text-base font-semibold">{title}</span>
          {description ? (
            <span className="text-mute mt-1 block text-sm leading-relaxed">{description}</span>
          ) : null}
        </span>
        <span className="text-mute shrink-0 pt-0.5 text-sm font-medium">
          {open ? 'Hide' : 'Show'}
        </span>
      </button>
      {open ? <div className="border-line border-t">{children}</div> : null}
    </section>
  );
}
