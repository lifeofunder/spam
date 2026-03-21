'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'already' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token?.trim()) {
      setState('error');
      setMessage('Ссылка недействительна: отсутствует токен.');
      return;
    }

    setState('loading');
    fetch(`${API_URL}/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (res.ok) {
          if (body.alreadyUnsubscribed) {
            setState('already');
            setMessage('Вы уже отписаны от этой рассылки.');
          } else {
            setState('ok');
            setMessage('Вы отписались. Спасибо.');
          }
          return;
        }
        setState('error');
        setMessage(
          typeof body.message === 'string' ? body.message : 'Ссылка недействительна или устарела.',
        );
      })
      .catch(() => {
        setState('error');
        setMessage('Не удалось связаться с сервером.');
      });
  }, [token]);

  return (
    <main className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <h1>Отписка</h1>
        {state === 'loading' ? (
          <p className="loading-line loading-line--pulse" aria-live="polite">
            Обработка…
          </p>
        ) : null}
        {state === 'ok' || state === 'already' ? (
          <p className="success-text" role="status">
            {message}
          </p>
        ) : null}
        {state === 'error' ? (
          <p className="error" role="alert">
            {message}
          </p>
        ) : null}
        <div className="auth-card-footer" style={{ marginTop: 'var(--space-5)' }}>
          <Link href="/">На главную</Link>
        </div>
      </div>
    </main>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <main className="auth-page">
          <div className="auth-card">
            <p className="loading-line loading-line--pulse">Загрузка…</p>
          </div>
        </main>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}
