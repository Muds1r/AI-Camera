'use client';

import { useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY, type ThemePreference } from '@/lib/theme';

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function notifyThemeSubscribers() {
  for (const listener of listeners) listener();
}

function themeFromDocument(): ThemePreference {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function applyTheme(theme: ThemePreference) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  notifyThemeSubscribers();
}

function getServerThemeSnapshot(): ThemePreference {
  return 'light';
}

function getThemeSnapshot(): ThemePreference {
  return themeFromDocument();
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, getServerThemeSnapshot);

  function toggle() {
    const next: ThemePreference = theme === 'dark' ? 'light' : 'dark';
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
  }

  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      suppressHydrationWarning
      className="border-line bg-paper text-ink hover:bg-surface focus-visible:ring-primary/40 inline-flex h-9 w-9 items-center justify-center rounded-lg border transition focus-visible:ring-2 focus-visible:outline-none"
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      className="h-[1.125rem] w-[1.125rem]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" strokeWidth="2" />
      <path
        strokeLinecap="round"
        strokeWidth="2"
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="h-[1.125rem] w-[1.125rem]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z"
      />
    </svg>
  );
}
