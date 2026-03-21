'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Field } from '@/components/ui/field';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body.message === 'string' ? body.message : 'Request failed');
        return;
      }
      setDone(true);
    } catch {
      setError('Could not reach the API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Forgot password</h1>
        {done ? (
          <p className="muted" style={{ marginTop: 0 }}>
            If an account exists for that email, we sent reset instructions.
          </p>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            {error ? (
              <div className="form-error-banner" role="alert">
                {error}
              </div>
            ) : null}
            <Field label="Email" htmlFor="forgot-email">
              <input
                id="forgot-email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="you@company.com"
                required
              />
            </Field>
            <button className="button btn--block" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : 'Send reset link'}
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
