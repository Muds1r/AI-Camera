import { redirectToLogin } from '@/lib/auth/redirect';
import { notifyError } from '@/components/toast';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ErrorBody = {
  error?: string;
  code?: string;
  hr_email?: string | null;
};

async function readError(response: Response): Promise<{
  message: string;
  code?: string;
  hr_email?: string | null;
}> {
  const data = (await response.json().catch(() => null)) as ErrorBody | null;
  return {
    message: data?.error || 'Request failed',
    code: data?.code,
    hr_email: data?.hr_email,
  };
}

export type ApiJsonOptions = {
  /** Skip the global error toast (caller handles feedback). */
  silent?: boolean;
};

/** Calls the app API and retries once after the refresh cookie rotates a new access token. */
export async function api(path: string, init?: RequestInit): Promise<Response> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const request = () =>
    fetch(path, {
      ...init,
      headers: {
        ...(init?.body && !isFormData ? { 'content-type': 'application/json' } : {}),
        ...init?.headers,
      },
    });

  const response = await request();
  if (response.status !== 401 || path.startsWith('/api/auth/')) return response;

  const refreshed = await fetch('/api/auth/refresh', { method: 'POST' });
  if (!refreshed.ok) {
    redirectToLogin();
    return response;
  }

  const retry = await request();
  if (retry.status === 401) {
    redirectToLogin();
  }
  return retry;
}

export async function apiJson<T>(
  path: string,
  init?: RequestInit,
  options?: ApiJsonOptions,
): Promise<T> {
  const response = await api(path, init);
  if (!response.ok) {
    const body = await readError(response);
    if (!options?.silent) {
      const title = body.code === 'account_inactive' ? 'Account deactivated' : 'Request failed';
      const detail =
        body.code === 'account_inactive' && body.hr_email
          ? `${body.message} Contact HR at ${body.hr_email}.`
          : body.message;
      notifyError(title, detail);
    }
    throw new ApiError(body.message, response.status, body.code);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function loginErrorMessage(data: ErrorBody | null): string {
  if (data?.code === 'account_inactive') {
    if (data.hr_email) {
      return `Your account has been deactivated. Please contact HR at ${data.hr_email}.`;
    }
    return 'Your account has been deactivated. Please contact your HR department.';
  }
  return data?.error || 'Could not sign in';
}
