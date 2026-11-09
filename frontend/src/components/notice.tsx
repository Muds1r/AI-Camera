'use client';

import { useEffect, useRef } from 'react';
import { notifySuccess } from '@/components/toast';

/**
 * Inline banner for success copy. API errors toast via `apiJson`; login uses its own toasts.
 */
export function Notice({ error, message }: { error?: string; message?: string }) {
  const lastMessage = useRef('');

  useEffect(() => {
    if (message && message !== lastMessage.current) {
      lastMessage.current = message;
      notifySuccess('Success', message);
    }
    if (!message) lastMessage.current = '';
  }, [message]);

  if (!error && !message) return null;

  const isError = Boolean(error);
  return (
    <div
      className={`animate-fade-up rounded-lg border px-3 py-2.5 text-sm ${
        isError
          ? 'border-danger/30 bg-red-500/10 text-red-800 dark:text-red-200'
          : 'border-success/25 bg-success-soft text-ink'
      }`}
      role="status"
    >
      {error || message}
    </div>
  );
}
