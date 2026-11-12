'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { APP_NAME } from '@/lib/brand';
import { safeNextPath } from '@/lib/auth/guards';
import { loginErrorMessage } from '@/lib/api';
import { PasswordField } from '@/components/password-field';
import { buttonClass, cardClass, fieldClass, labelClass } from '@/components/page-frame';
import { ThemeToggle } from '@/components/theme-toggle';
import { notifyError, notifySuccess } from '@/components/toast';

type LoginErrorBody = {
  error?: string;
  code?: string;
  hr_email?: string | null;
};

type ResetChannel = 'phone' | 'secondary_email';

export function LoginForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'sign-in' | 'forgot'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [channel, setChannel] = useState<ResetChannel>('secondary_email');
  const [otp, setOtp] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [error, setError] = useState('');
  const [resetNote, setResetNote] = useState('');
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

    const companyEmail = email.trim().toLowerCase();

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: companyEmail,
          password,
          rememberMe,
        }),
      });
      const data = (await response.json().catch(() => null)) as LoginErrorBody | null;
      if (!response.ok) {
        const msg = loginErrorMessage(data);
        const title = data?.code === 'account_inactive' ? 'Account deactivated' : 'Sign in failed';
        setError(msg);
        notifyError(title, msg);
        setPending(false);
        return;
      }
      notifySuccess('Welcome back', 'Redirecting to your workspace…');
      window.location.href = safeNextPath(searchParams.get('next'));
    } catch {
      const msg = 'Could not reach the server';
      setError(msg);
      notifyError('Connection error', msg);
      setPending(false);
    }
  }

  function onForgot(event: FormEvent) {
    event.preventDefault();
    setResetNote(
      'Reset codes are not sent yet. The phone number and secondary email saved on the account are ready for this once mail and SMS are connected.',
    );
  }

  return (
    <div className="bg-bg text-ink relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      {mode === 'sign-in' ? (
        <form onSubmit={onSubmit} className={`${cardClass} shadow-elevated w-full max-w-sm p-8`}>
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-3">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt=""
                  className="border-line h-10 w-10 rounded-lg border object-cover"
                />
              ) : (
                <div className="bg-primary text-primary-on flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold">
                  {APP_NAME.slice(0, 1)}
                </div>
              )}
              <div>
                <h1 className="text-ink text-lg font-semibold tracking-tight">{APP_NAME}</h1>
                <p className="text-mute text-sm">Sign in to continue</p>
              </div>
            </div>
          </div>

          <label className={labelClass}>Email</label>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={`${fieldClass} mb-4`}
          />

          <label className={labelClass}>Password</label>
          <div className="mb-3">
            <PasswordField
              required
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
            />
          </div>
          <button
            type="button"
            className="text-mute hover:text-ink mb-5 text-sm font-medium"
            onClick={() => {
              setError('');
              setResetEmail(email);
              setMode('forgot');
            }}
          >
            Forgot password?
          </button>

          {error ? (
            <p
              className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      ) : (
        <form onSubmit={onForgot} className={`${cardClass} shadow-elevated w-full max-w-sm p-8`}>
          <div className="mb-6">
            <h1 className="text-ink text-lg font-semibold tracking-tight">Reset password</h1>
            <p className="text-mute mt-1 text-sm">
              A code will go to the phone number or secondary email on the account.
            </p>
          </div>

          <label className={labelClass}>Login email</label>
          <input
            type="email"
            required
            autoComplete="username"
            value={resetEmail}
            onChange={(event) => setResetEmail(event.target.value)}
            className={`${fieldClass} mb-4`}
          />

          <fieldset className="mb-4">
            <legend className={labelClass}>Send the code to</legend>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="reset-channel"
                checked={channel === 'secondary_email'}
                onChange={() => setChannel('secondary_email')}
              />
              Secondary email
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="reset-channel"
                checked={channel === 'phone'}
                onChange={() => setChannel('phone')}
              />
              Phone number
            </label>
          </fieldset>

          <label className={labelClass}>Code</label>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            placeholder="One-time code"
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            className={`${fieldClass} mb-4`}
          />

          <label className={labelClass}>New password</label>
          <div className="mb-5">
            <PasswordField
              autoComplete="new-password"
              placeholder="New password"
              value={nextPassword}
              onChange={setNextPassword}
            />
          </div>

          {resetNote ? (
            <p className="border-line bg-surface text-ink mb-4 rounded-lg border px-3 py-2 text-sm">
              {resetNote}
            </p>
          ) : null}

          <button type="submit" className={`${buttonClass} w-full`}>
            Reset password
          </button>
          <button
            type="button"
            className="text-mute hover:text-ink mt-4 w-full text-sm font-medium"
            onClick={() => {
              setResetNote('');
              setMode('sign-in');
            }}
          >
            Back to sign in
          </button>
        </form>
      )}
    </div>
  );
}
