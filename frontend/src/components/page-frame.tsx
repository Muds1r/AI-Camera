'use client';

import type { ReactNode } from 'react';
import { AppShell } from './app-shell';

const radiusMd = 'rounded-[var(--app-radius-md)]';
const radiusLg = 'rounded-[var(--app-radius-lg)]';
const radiusXl = 'rounded-[var(--app-radius-xl)]';

export function PageFrame({
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
  return (
    <AppShell title={title} actions={actions}>
      <div className="flex flex-col gap-10">
        {description ? (
          <p className="text-mute text-caption -mt-2 max-w-2xl text-[15px] leading-relaxed">
            {description}
          </p>
        ) : null}
        {children}
      </div>
    </AppShell>
  );
}

export function PageSection({
  title,
  description,
  children,
  id,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="flex flex-col gap-4">
      {title ? (
        <header className="border-line border-b pb-3">
          <h2 className="text-display text-ink text-base font-semibold">{title}</h2>
          {description ? (
            <p className="text-mute mt-1 text-sm leading-relaxed">{description}</p>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function PageToolbar({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${radiusLg} border-line bg-surface/80 flex flex-wrap items-center gap-2 border p-2`}
    >
      {children}
    </div>
  );
}

export function DataPanel({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className={`${cardClass} overflow-hidden`}>
      {children}
      {footer}
    </div>
  );
}

export const fieldClass = `w-full ${radiusMd} border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-mute focus:border-primary/50 focus:ring-2 focus:ring-primary/15`;

export const labelClass = 'text-caption text-mute mb-1.5 block text-xs font-medium';

export const buttonClass = `inline-flex items-center justify-center ${radiusMd} bg-primary px-4 py-2.5 text-sm font-semibold text-primary-on shadow-[0_1px_2px_var(--app-shadow),0_4px_14px_color-mix(in_srgb,var(--app-navy)_18%,transparent)] transition hover:bg-primary-hover active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-45`;

export const buttonSecondaryClass = `inline-flex items-center justify-center ${radiusMd} border border-line bg-paper px-4 py-2.5 text-sm font-medium text-ink shadow-[0_1px_2px_var(--app-shadow)] transition hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-45`;

export const buttonGhostClass = `inline-flex h-9 min-w-9 items-center justify-center ${radiusMd} text-mute text-sm font-medium transition hover:bg-paper hover:text-ink disabled:pointer-events-none disabled:opacity-35`;

export const buttonSuccessClass = `inline-flex items-center justify-center ${radiusMd} bg-success px-4 py-2.5 text-sm font-semibold text-primary-on transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success disabled:pointer-events-none disabled:opacity-45`;

export const buttonDangerClass = `inline-flex items-center justify-center ${radiusMd} bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:pointer-events-none disabled:opacity-45`;

export const sectionTitleClass = 'text-ink mb-2 text-sm font-semibold';

export const tabActiveClass = `${radiusMd} bg-paper text-ink px-3.5 py-2 text-sm font-semibold shadow-[0_1px_3px_var(--app-shadow)] ring-1 ring-line`;

export const tabIdleClass = `${radiusMd} text-mute px-3.5 py-2 text-sm font-medium transition hover:bg-paper/60 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`;

export const tabBarClass = `inline-flex flex-wrap gap-1 ${radiusLg} border border-line bg-surface p-1`;

export const cardClass = `${radiusXl} border border-line bg-paper shadow-card`;

export const formPanelClass = `${cardClass} grid gap-3 p-6`;

export const linkMutedClass =
  'text-sm font-semibold text-primary transition hover:text-primary-hover';

export const pageSectionClass = 'flex flex-col gap-4';
