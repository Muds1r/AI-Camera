import type { ReactNode } from 'react';

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="border-line bg-paper rounded-xl border p-5 shadow-sm">
      {title ? <h2 className="mb-3 text-base font-extrabold">{title}</h2> : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="border-line bg-paper rounded-xl border p-4 shadow-sm">
      <p className="text-mute text-xs font-bold tracking-wide uppercase">{label}</p>
      <p className="mt-2 text-2xl font-extrabold">{value}</p>
      {hint ? <p className="text-mute mt-1 text-sm">{hint}</p> : null}
    </div>
  );
}

export function Badge({ status }: { status: string }) {
  const tone =
    status === 'approved' || status === 'present'
      ? 'bg-success/10 text-success'
      : status === 'rejected' || status === 'absent'
        ? 'bg-danger/10 text-danger'
        : status === 'late' || status === 'pending'
          ? 'bg-warning/15 text-warning'
          : 'bg-canvas text-mute';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${tone}`}>{status}</span>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#142B4A]/40 p-4">
      <div className="border-line bg-paper w-full max-w-md rounded-xl border p-5 shadow-xl">
        <h2 className="text-lg font-extrabold">{title}</h2>
        {detail ? <p className="text-mute mt-2 text-sm">{detail}</p> : null}
        {children}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="border-line rounded-md border px-3 py-1.5 text-sm font-bold"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${tone === 'teal' ? 'bg-teal' : 'bg-danger'} rounded-md px-3 py-1.5 text-sm font-bold text-white`}
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
  return (
    <p className={`mb-4 text-sm font-bold ${error ? 'text-danger' : 'text-success'}`}>
      {error || message}
    </p>
  );
}
