'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { safeNextPath } from '@/lib/auth/guards';
import { PasswordField } from '@/components/password-field';

export function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [company, setCompany] = useState('TruckFlow');
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/company/branding')
      .then((response) => response.json())
      .then((data: { company?: { name: string; logo_url: string | null } }) => {
        if (data.company) {
          setCompany(data.company.name);
          setLogo(data.company.logo_url);
        }
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
    <div className="bg-canvas text-mute flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="border-mute/25 bg-paper w-full max-w-md rounded-2xl border p-8 shadow-xl"
      >
        <div className="mb-8">
          {logo ? (
            // Company logo is a public uploaded file.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="mb-3 h-12 w-12 rounded-md object-cover" />
          ) : null}
          <p className="text-teal text-xs font-bold tracking-wide uppercase">TruckFlow</p>
          <p className="text-ink mt-1 text-2xl font-extrabold tracking-tight">{company}</p>
          <h1 className="text-ink mt-6 text-xl font-extrabold">Sign in</h1>
        </div>

        <label className="text-mute mb-1 block text-xs font-medium tracking-wider uppercase">
          Email
        </label>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="border-line bg-paper text-ink focus:border-ink mb-4 w-full rounded-md border px-3.5 py-2 text-sm font-medium focus:outline-none"
        />

        <label className="text-mute mb-1 block text-xs font-medium tracking-wider uppercase">
          Password
        </label>
        <div className="mb-4">
          <PasswordField
            required
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />
        </div>

        {error ? <p className="text-brand mb-4 text-sm font-medium">{error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="bg-teal hover:bg-teal/85 w-full rounded-md py-2.5 text-sm font-bold text-white transition disabled:opacity-60"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
