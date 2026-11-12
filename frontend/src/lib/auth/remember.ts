const REMEMBER_EMAIL_KEY = 'truckflow.remember_company_email';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** Loads a previously remembered company email, or empty string. */
export function loadRememberedEmail(): string {
  if (!canUseStorage()) return '';
  try {
    const value = window.localStorage.getItem(REMEMBER_EMAIL_KEY);
    return value?.trim() ?? '';
  } catch {
    return '';
  }
}

/** Persists company email only when remember is on; never stores the password. */
export function persistRememberedEmail(email: string, remember: boolean): void {
  if (!canUseStorage()) return;
  try {
    if (!remember) {
      window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
      return;
    }
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
      return;
    }
    window.localStorage.setItem(REMEMBER_EMAIL_KEY, normalized);
  } catch {
    // Private mode / blocked storage — session cookies still apply.
  }
}

export function clearRememberedEmail(): void {
  persistRememberedEmail('', false);
}
