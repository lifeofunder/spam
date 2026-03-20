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
    <main className="container marketing-section">
      <h1>Verify email</h1>
      {status === 'loading' && <p>Verifying…</p>}
      {status === 'ok' && <p style={{ color: 'green' }}>{message}</p>}
      {status === 'err' && <p className="error">{message}</p>}
      <p className="muted">
        <Link href="/login">Back to login</Link>
      </p>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="container">Loading…</main>}>
      <VerifyEmailInner />
    </Suspense>
  );
}
