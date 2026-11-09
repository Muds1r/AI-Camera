/**
 * Theme tokens (source of truth: `src/app/globals.css`).
 * Prefer Tailwind utilities: bg-bg, bg-paper, text-ink, text-mute, border-line, bg-primary, bg-primary-soft.
 */
export const THEME_STORAGE_KEY = 'truckflow-theme';

export type ThemePreference = 'light' | 'dark';

export const THEME_COLORS = {
  light: {
    bg: '#fafafa',
    paper: '#ffffff',
    ink: '#18181b',
    primary: '#2563eb',
  },
  dark: {
    bg: '#09090b',
    paper: '#18181b',
    ink: '#fafafa',
    primary: '#3b82f6',
  },
} as const;
