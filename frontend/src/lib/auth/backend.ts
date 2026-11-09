import { NextResponse } from 'next/server';

export function backendUrl(path: string, search = ''): string {
  const base = process.env.BACKEND_URL || 'http://localhost:5000';
  return `${base}${path}${search}`;
}

export function applySetCookies(response: NextResponse, backend: Response): void {
  const cookies =
    typeof backend.headers.getSetCookie === 'function' ? backend.headers.getSetCookie() : [];

  for (const raw of cookies) {
    const [pair, ...attributes] = raw.split(';').map((part) => part.trim());
    const separator = pair.indexOf('=');
    if (separator === -1) continue;

    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    const options: {
      path: string;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: 'lax' | 'strict' | 'none';
      maxAge?: number;
    } = { path: '/' };

    for (const attribute of attributes) {
      const [rawKey, rawValue] = attribute.split('=');
      const key = rawKey.toLowerCase();
      if (key === 'httponly') options.httpOnly = true;
      else if (key === 'secure') options.secure = true;
      else if (key === 'path' && rawValue) options.path = rawValue;
      else if (key === 'max-age' && rawValue) options.maxAge = Number(rawValue);
      else if (key === 'expires' && rawValue) {
        const expiresAt = new Date(rawValue).getTime();
        if (!Number.isNaN(expiresAt) && expiresAt <= Date.now()) options.maxAge = 0;
      } else if (key === 'samesite' && rawValue) {
        const sameSite = rawValue.toLowerCase();
        if (sameSite === 'lax' || sameSite === 'strict' || sameSite === 'none') {
          options.sameSite = sameSite;
        }
      }
    }

    response.cookies.set(name, value, options);
  }
}
