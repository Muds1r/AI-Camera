'use client';

import type { ReactNode } from 'react';
import {
  buttonDangerClass,
  buttonGhostClass,
  buttonSecondaryClass,
  buttonSuccessClass,
  cardClass,
  linkMutedClass,
} from './page-frame';

export function Card({
  title,
  children,
  action,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={`${cardClass} hover:shadow-card-hover p-5 transition-shadow duration-200`}>
      {title ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-ink text-sm font-medium">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className={`${cardClass} px-4 py-3`}>
      <p className="text-mute text-xs font-medium">{label}</p>
      <p className="text-ink mt-0.5 text-lg font-semibold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="text-mute mt-0.5 text-xs">{hint}</p> : null}
    </div>
  );
}

export function MetricStrip({
  items,
}: {
  items: { label: string; value: ReactNode; hint?: string }[];
}) {
  return (
    <div
      className={`${cardClass} shadow-card divide-line grid sm:grid-cols-2 lg:divide-x lg:divide-y-0 ${items.length === 3 ? 'lg:grid-cols-3' : ''} ${items.length === 4 ? 'lg:grid-cols-4' : ''} ${items.length >= 5 ? 'lg:grid-cols-3 xl:grid-cols-6' : ''}`}
    >
      {items.map((item) => (
        <div key={item.label} className="px-4 py-3 lg:py-3.5">
          <p className="text-mute text-xs font-medium">{item.label}</p>
          <p className="text-ink mt-0.5 text-base font-semibold tabular-nums">{item.value}</p>
          {item.hint ? <p className="text-mute mt-0.5 text-xs">{item.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function Badge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone =
    normalized === 'approved' || normalized === 'present'
      ? 'bg-success-soft text-success'
      : normalized === 'rejected' || normalized === 'absent'
        ? 'text-danger bg-red-500/10 dark:bg-red-500/15'
        : normalized === 'late' || normalized === 'pending'
          ? 'text-warning bg-amber-500/10 dark:bg-amber-500/15'
          : normalized === 'high'
            ? 'text-danger bg-red-500/10'
            : normalized === 'medium'
              ? 'text-warning bg-amber-500/10'
              : normalized === 'low'
                ? 'bg-surface text-mute'
                : 'bg-surface text-mute';
  const label = status.replace(/_/g, ' ');
  return (
    <span
      className={`inline-flex rounded-[var(--app-radius-pill)] px-2.5 py-0.5 text-xs font-semibold capitalize ${tone}`}
    >
      {label}
    </span>
  );
}

export function ListRow({
  title,
  detail,
  status,
  href,
  trailing,
}: {
  title: ReactNode;
  detail?: ReactNode;
  status?: string;
  href?: string | null;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={`${cardClass} shadow-card hover:shadow-card-hover flex items-start justify-between gap-4 px-4 py-3 text-sm transition-all duration-200 hover:-translate-y-px`}
    >
      <div className="min-w-0">
        <p className="text-ink font-medium">{title}</p>
        {detail ? <p className="text-mute mt-0.5 text-xs leading-relaxed">{detail}</p> : null}
        {href ? (
          <a className={`${linkMutedClass} mt-1 inline-block text-xs`} href={href}>
            View document
          </a>
        ) : null}
      </div>
      {trailing ?? (status ? <Badge status={status} /> : null)}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-mute py-6 text-center text-sm">{children}</p>;
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <p className="text-mute text-sm">{label}</p>;
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`focus-visible:ring-primary/30 relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 ${
        checked ? 'bg-primary' : 'bg-line'
      }`}
    >
      <span
        className={`bg-paper inline-block h-3.5 w-3.5 transform rounded-full transition ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export function ConfirmDialog({
  open,
  title,
  detail,
  confirmLabel,
  tone = 'danger',
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  detail?: string;
  confirmLabel: string;
  tone?: 'danger' | 'teal';
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="bg-overlay fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-[1px]">
      <div className={`${cardClass} w-full max-w-md p-5`}>
        <h2 className="text-ink text-sm font-semibold">{title}</h2>
        {detail ? <p className="text-mute mt-1.5 text-sm">{detail}</p> : null}
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={buttonSecondaryClass} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={tone === 'teal' ? buttonSuccessClass : buttonDangerClass}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export { Notice } from '@/components/notice';

export function Pagination({
  page,
  totalPages,
  total,
  pageSize = 20,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="border-line bg-surface/50 flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-mute text-caption text-xs font-medium tabular-nums">
        {total === 0 ? (
          'No results'
        ) : (
          <>
            Showing <span className="text-ink font-semibold">{start}</span>
            {' – '}
            <span className="text-ink font-semibold">{end}</span> of{' '}
            <span className="text-ink font-semibold">{total}</span>
          </>
        )}
      </p>
      <nav
        className="border-line bg-paper inline-flex items-center gap-0.5 self-start rounded-[var(--app-radius-lg)] border p-1 shadow-[0_1px_2px_var(--app-shadow)] sm:self-auto"
        aria-label="Pagination"
      >
        <button
          type="button"
          className={buttonGhostClass}
          disabled={page <= 1}
          aria-label="Previous page"
          onClick={() => onPageChange(page - 1)}
        >
          ‹
        </button>
        <div className="flex items-center gap-1 px-1">
          <span
            className="bg-primary-soft text-primary min-w-[2.25rem] rounded-[var(--app-radius-md)] px-2.5 py-1.5 text-center text-xs font-bold tabular-nums"
            aria-current="page"
          >
            {page}
          </span>
          <span className="text-mute px-0.5 text-xs font-medium">of</span>
          <span className="text-mute min-w-[1.5rem] text-center text-xs font-semibold tabular-nums">
            {totalPages}
          </span>
        </div>
        <button
          type="button"
          className={buttonGhostClass}
          disabled={page >= totalPages}
          aria-label="Next page"
          onClick={() => onPageChange(page + 1)}
        >
          ›
        </button>
      </nav>
    </div>
  );
}

export const tableWrapClass = 'overflow-x-auto';
export const tableClass = 'w-full min-w-[640px] text-left text-sm';
export const tableHeadClass =
  'bg-surface/90 text-mute text-caption border-line border-b text-[11px] font-semibold uppercase tracking-wide';
export const tableRowClass = 'border-line border-t transition-colors hover:bg-primary-soft/25';
