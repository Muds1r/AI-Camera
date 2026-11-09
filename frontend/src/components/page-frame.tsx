'use client';

import type { ReactNode } from 'react';
import { AppShell } from './app-shell';

export function PageFrame({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <AppShell title={title} description={description}>
      {children}
    </AppShell>
  );
}

export const fieldClass =
  'w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-medium text-ink outline-none transition placeholder:text-mute focus:border-primary focus:ring-2 focus:ring-primary/25';

export const buttonClass =
  'inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-on shadow-sm transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50';

export const buttonSecondaryClass =
  'inline-flex items-center justify-center rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50';

export const buttonSuccessClass =
  'inline-flex items-center justify-center rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-primary-on shadow-sm transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success disabled:pointer-events-none disabled:opacity-50';

export const buttonDangerClass =
  'inline-flex items-center justify-center rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:pointer-events-none disabled:opacity-50';

export const sectionTitleClass = 'mb-1.5 block text-sm font-medium text-ink';

export const tabActiveClass =
  'rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-on shadow-sm';

export const tabIdleClass =
  'rounded-lg px-3 py-1.5 text-sm font-semibold text-mute transition hover:bg-primary-soft hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export const tabBarClass =
  'mb-5 inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1';

export const cardClass = 'rounded-2xl border border-line bg-paper p-6 shadow-sm';

export const linkMutedClass =
  'text-sm font-semibold text-primary transition hover:text-primary-hover hover:underline';
