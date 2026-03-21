'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('err');
      setMessage('Missing token in URL.');
      return;
    }

    setStatus('loading');
    fetch(`${API_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus('err');
          setMessage(
            typeof body.message === 'string'
              ? body.message
              : Array.isArray(body.message)
                ? body.message.join(', ')
                : 'Verification failed',
          );
          return;
        }
        if (body.accessToken) {
          localStorage.setItem('accessToken', body.accessToken);
        }
        setStatus('ok');
        setMessage('Your email is verified. Redirecting to the dashboard…');
        setTimeout(() => router.replace('/dashboard'), 1500);
      })
      .catch(() => {
        setStatus('err');
        setMessage('Could not reach the API.');
      });
  }, [router, searchParams]);

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Verify email</h1>
        {status === 'loading' && (
          <p className="loading-line loading-line--pulse" aria-live="polite">
            Verifying…
          </p>
        )}
        {status === 'ok' && (
          <p className="success-text" role="status">
            {message}
          </p>
        )}
        {status === 'err' && (
          <p className="error" role="alert">
            {message}
          </p>
        )}
        <div className="auth-card-footer">
          <Link href="/login">Back to login</Link>
        </div>
      </div>
    </main>
  );
}

function VerifyLoading() {
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

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyLoading />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
