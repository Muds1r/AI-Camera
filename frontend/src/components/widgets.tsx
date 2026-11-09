import type { ReactNode } from 'react';
import {
  buttonDangerClass,
  buttonSecondaryClass,
  buttonSuccessClass,
  cardClass,
} from './page-frame';

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className={`${cardClass} p-5 sm:p-6`}>
      {title ? <h2 className="text-ink mb-4 text-sm font-bold">{title}</h2> : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className={`${cardClass} p-4`}>
      <p className="text-mute text-[11px] font-semibold tracking-wide uppercase">{label}</p>
      <p className="text-ink mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
      {hint ? <p className="text-mute mt-1 text-xs font-medium">{hint}</p> : null}
    </div>
  );
}

export function Badge({ status }: { status: string }) {
  const tone =
    status === 'approved' || status === 'present'
      ? 'bg-success-soft text-success ring-1 ring-success/30'
      : status === 'rejected' || status === 'absent'
        ? 'bg-red-50 text-red-800 ring-1 ring-red-200/80 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900/60'
        : status === 'late' || status === 'pending'
          ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900/50'
          : 'bg-surface text-mute ring-1 ring-line';
  return (
    <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase ${tone}`}>
      {status}
    </span>
  );
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
      className={`focus-visible:ring-primary/40 relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 ${
        checked ? 'bg-primary' : 'bg-line'
      }`}
    >
      <span
        className={`bg-paper inline-block h-4 w-4 transform rounded-full shadow-sm transition ${
          checked ? 'translate-x-6' : 'translate-x-1'
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
    <div className="bg-overlay fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
      <div className={`${cardClass} w-full max-w-md shadow-xl`}>
        <h2 className="text-ink text-base font-bold">{title}</h2>
        {detail ? <p className="text-mute mt-2 text-sm font-medium">{detail}</p> : null}
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

export function Notice({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  const isError = Boolean(error);
  return (
    <div
      className={`mb-5 rounded-xl border px-4 py-3 text-sm font-medium ${
        isError
          ? 'border-red-200/80 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200'
          : 'border-primary/30 bg-primary-soft text-ink'
      }`}
      role="alert"
    >
      {error || message}
    </div>
  );
}

export const tableWrapClass = `${cardClass} overflow-x-auto p-0`;
export const tableClass = 'w-full min-w-[640px] text-left text-sm';
export const tableHeadClass =
  'bg-surface text-mute text-[11px] font-semibold tracking-wide uppercase';
export const tableRowClass = 'border-line border-t transition-colors hover:bg-primary-soft/40';
