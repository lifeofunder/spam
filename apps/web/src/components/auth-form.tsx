'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Field } from '@/components/ui/field';

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
  const [termsError, setTermsError] = useState('');
  const [loading, setLoading] = useState(false);

  const title = mode === 'login' ? 'Log in' : 'Create account';

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setTermsError('');
    if (mode === 'register' && !acceptTerms) {
      setTermsError('You must accept the Terms and Privacy Policy');
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
    <main className="auth-page">
      <div className="auth-card">
        <h1>{title}</h1>
        {error ? (
          <div className="form-error-banner" role="alert">
            {error}
          </div>
        ) : null}
        <form onSubmit={onSubmit} noValidate>
          {mode === 'register' ? (
            <Field label="Full name" htmlFor="name">
              <input
                id="name"
                className="input"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Jane Cooper"
                required
              />
            </Field>
          ) : null}

          <Field label="Email" htmlFor="email">
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              required
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            hint={mode === 'register' ? 'At least 8 characters.' : undefined}
          >
            <input
              id="password"
              className="input"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              minLength={8}
              required
            />
          </Field>

          {mode === 'register' ? (
            <div className="field checkbox-field">
              <input
                id="acceptTerms"
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => {
                  setAcceptTerms(e.target.checked);
                  if (e.target.checked) {
                    setTermsError('');
                  }
                }}
                aria-invalid={!!termsError}
                aria-describedby={termsError ? 'acceptTerms-error' : undefined}
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
          {termsError ? (
            <p className="field-error" id="acceptTerms-error" role="alert">
              {termsError}
            </p>
          ) : null}

          <button className="button btn--block" disabled={loading} type="submit">
            {loading ? 'Please wait…' : title}
          </button>
        </form>

        <div className="auth-card-footer">
          {mode === 'login' ? (
            <>
              No account? <Link href="/register">Register</Link>
              <span className="muted"> · </span>
              <Link href="/forgot-password">Forgot password?</Link>
            </>
          ) : (
            <>
              Already have an account? <Link href="/login">Log in</Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
