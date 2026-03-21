'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { Field } from '@/components/ui/field';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Missing token. Open the link from your email.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.message === 'string' ? body.message : 'Reset failed');
        return;
      }
      if (body.accessToken) {
        localStorage.setItem('accessToken', body.accessToken);
      }
      router.replace('/dashboard');
    } catch {
      setError('Could not reach the API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Reset password</h1>
        {!token ? (
          <p className="error" role="alert">
            Missing token in URL.
          </p>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            {error ? (
              <div className="form-error-banner" role="alert">
                {error}
              </div>
            ) : null}
            <Field label="New password" htmlFor="reset-password" hint="At least 8 characters.">
              <input
                id="reset-password"
                className="input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
              />
            </Field>
            <button className="button btn--block" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : 'Save password'}
            </button>
          </form>
        )}
        <div className="auth-card-footer">
          <Link href="/login">Back to login</Link>
        </div>
      </div>
    </main>
  );
}

function ResetLoading() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="loading-line loading-line--pulse" aria-live="polite">
          Loading…
        </p>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetLoading />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
