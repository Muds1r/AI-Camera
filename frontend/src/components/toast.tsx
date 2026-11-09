'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export type ToastItem = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
};

type Listener = (item: ToastItem) => void;

const listeners = new Set<Listener>();
let idSeq = 0;

function emit(item: ToastItem) {
  for (const listener of listeners) listener(item);
}

export function notifySuccess(title: string, description?: string) {
  emit({
    id: String(++idSeq),
    tone: 'success',
    title,
    description,
  });
}

export function notifyError(title: string, description?: string) {
  emit({
    id: String(++idSeq),
    tone: 'error',
    title,
    description,
  });
}

export function notifyInfo(title: string, description?: string) {
  emit({
    id: String(++idSeq),
    tone: 'info',
    title,
    description,
  });
}

const AUTO_DISMISS_MS = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    function onPush(item: ToastItem) {
      setItems((current) => [...current.slice(-4), item]);
      window.setTimeout(() => dismiss(item.id), AUTO_DISMISS_MS);
    }
    listeners.add(onPush);
    return () => {
      listeners.delete(onPush);
    };
  }, [dismiss]);

  return (
    <>
      {children}
      <div
        className="pointer-events-none fixed top-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 sm:top-5 sm:right-5"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const tone = TONE_STYLES[item.tone];
  return (
    <button
      type="button"
      onClick={onDismiss}
      className={`animate-toast-in shadow-elevated bg-paper pointer-events-auto flex w-full gap-3 rounded-lg border p-3.5 text-left transition hover:brightness-[0.98] ${tone.border}`}
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${tone.iconBg}`}
        aria-hidden
      >
        {tone.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-semibold tracking-tight ${tone.title}`}>
          {item.title}
        </span>
        {item.description ? (
          <span className="text-mute mt-0.5 block text-xs leading-relaxed">{item.description}</span>
        ) : null}
      </span>
    </button>
  );
}

const TONE_STYLES = {
  success: {
    border: 'border-success/25',
    iconBg: 'bg-success-soft text-success',
    title: 'text-ink',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  error: {
    border: 'border-danger/30',
    iconBg: 'bg-red-500/10 text-danger',
    title: 'text-ink',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
      </svg>
    ),
  },
  info: {
    border: 'border-primary/25',
    iconBg: 'bg-primary-soft text-primary',
    title: 'text-ink',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
      </svg>
    ),
  },
} as const;
