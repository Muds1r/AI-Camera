'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { APP_NAME } from '@/lib/brand';
import { safeNextPath } from '@/lib/auth/guards';
import { PasswordField } from '@/components/password-field';
import { buttonClass, cardClass, fieldClass } from '@/components/page-frame';
import { ThemeToggle } from '@/components/theme-toggle';

export function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/company/branding')
      .then((response) => response.json())
      .then((data: { company?: { logo_url: string | null } }) => {
        if (data.company?.logo_url) setLogo(data.company.logo_url);
      })
      .catch(() => undefined);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setPending(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(data?.error || 'Could not sign in');
        setPending(false);
        return;
      }
      window.location.href = safeNextPath(searchParams.get('next'));
    } catch {
      setError('Could not reach the server');
      setPending(false);
    }
  }

  return (
    <div className="bg-bg text-ink relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <form onSubmit={onSubmit} className={`${cardClass} w-full max-w-[22rem] p-8`}>
        <div className="mb-8 text-center">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt=""
              className="border-line mx-auto mb-4 h-14 w-14 rounded-xl border object-cover"
            />
          ) : (
            <div className="bg-primary text-primary-on mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl text-xl font-bold shadow-sm">
              {APP_NAME.slice(0, 1)}
            </div>
          )}
          <h1 className="text-ink text-xl font-bold tracking-tight">{APP_NAME}</h1>
          <p className="text-mute mt-1 text-sm font-medium">Sign in to your workspace</p>
        </div>

        <label className="text-mute mb-1.5 block text-xs font-semibold">Email</label>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={`${fieldClass} mb-4`}
        />

        <label className="text-mute mb-1.5 block text-xs font-semibold">Password</label>
        <div className="mb-5">
          <PasswordField
            required
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-200/80 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
          {pending ? 'Signing in…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
