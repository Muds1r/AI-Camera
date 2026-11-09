export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error || 'Request failed';
}

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
    // Full load so the proxy sees the cleared cookies and leaves the protected page.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- session reset cannot stay on the current client route
    window.location.href = '/login';
    return response;
  }

  return request();
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await api(path, init);
  if (!response.ok) throw new ApiError(await readError(response), response.status);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
