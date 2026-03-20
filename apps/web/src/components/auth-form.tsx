'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface AuthFormProps {
  mode: 'login' | 'register';
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const title = mode === 'login' ? 'Login' : 'Register';

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (mode === 'register' && !acceptTerms) {
      setError('You must accept the Terms and Privacy Policy');
      return;
    }
    setLoading(true);

    try {
      const body =
        mode === 'login'
          ? { email, password }
          : {
              name,
              email,
              password,
              acceptTerms: true,
              // Optional: pass Turnstile token when NEXT_PUBLIC_TURNSTILE_SITE_KEY + widget are wired (see README).
            };

      const response = await fetch(`${API_URL}/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const msg = data.message;
        if (Array.isArray(msg)) {
          setError(msg.join(', '));
        } else if (typeof msg === 'string') {
          setError(msg);
        } else {
          setError('Invalid data or credentials');
        }
        return;
      }

      const data = await response.json();
      localStorage.setItem('accessToken', data.accessToken);
      router.push('/dashboard');
    } catch {
      setError('Failed to connect to API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container marketing-section">
      <div className="card">
        <h1>{title}</h1>
        {error ? <div className="error">{error}</div> : null}
        <form onSubmit={onSubmit}>
          {mode === 'register' ? (
            <div className="field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          {mode === 'register' ? (
            <div className="field checkbox-field">
              <input
                id="acceptTerms"
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
              />
              <label htmlFor="acceptTerms">
                I agree to the{' '}
                <Link href="/legal/terms" target="_blank" rel="noopener noreferrer">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/legal/privacy" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </Link>
                .
              </label>
            </div>
          ) : null}

          <button className="button" disabled={loading} type="submit">
            {loading ? 'Please wait...' : title}
          </button>
        </form>

        <p>
          {mode === 'login' ? (
            <>
              No account? <Link href="/register">Register</Link>
              <span className="muted"> · </span>
              <Link href="/forgot-password">Forgot password?</Link>
            </>
          ) : (
            <>
              Already have account? <Link href="/login">Login</Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
