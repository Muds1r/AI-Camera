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
  'w-full rounded-md border border-line bg-paper px-3.5 py-2 text-sm font-medium text-ink placeholder:text-mute focus:border-ink focus:outline-none';

export const buttonClass =
  'rounded-md bg-teal px-4 py-2 text-sm font-bold text-white transition hover:bg-teal/85 disabled:opacity-60';
