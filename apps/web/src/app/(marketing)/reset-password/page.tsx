'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';

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
    <main className="container marketing-section">
      <div className="card" style={{ maxWidth: 420 }}>
        <h1>Reset password</h1>
        {!token ? (
          <p className="error">Missing token in URL.</p>
        ) : (
          <form onSubmit={onSubmit}>
            {error ? <div className="error">{error}</div> : null}
            <div className="field">
              <label htmlFor="password">New password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                minLength={8}
                required
              />
            </div>
            <button className="button" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : 'Save password'}
            </button>
          </form>
        )}
        <p className="muted">
          <Link href="/login">Back to login</Link>
        </p>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="container">Loading…</main>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
