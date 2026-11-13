'use client';

import { useState } from 'react';

export function usePaged<T>(items: T[], pageSize: number, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const [seen, setSeen] = useState(resetKey);
  if (resetKey !== undefined && !Object.is(resetKey, seen)) {
    setSeen(resetKey);
    setPage(1);
  }
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize) || 1);
  const current = Math.min(page, totalPages);
  const slice = items.slice((current - 1) * pageSize, current * pageSize);
  return {
    slice,
    page: current,
    totalPages,
    total: items.length,
    pageSize,
    setPage,
    showPager: items.length > pageSize,
  };
}
