'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

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
    <main className="container marketing-section">
      <div className="card" style={{ maxWidth: 420 }}>
        <h1>Forgot password</h1>
        {done ? (
          <p>If an account exists for that email, we sent reset instructions.</p>
        ) : (
          <form onSubmit={onSubmit}>
            {error ? <div className="error">{error}</div> : null}
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
              />
            </div>
            <button className="button" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : 'Send reset link'}
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
