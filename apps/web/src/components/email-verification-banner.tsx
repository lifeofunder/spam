'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Me = {
  emailVerified?: boolean;
};

export function EmailVerificationBanner() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      return;
    }
    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          return;
        }
        const data: Me = await res.json();
        setShow(data.emailVerified === false);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [pathname, load]);

  const resend = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      return;
    }
    setBusy(true);
    setMsg(null);
    fetch(`${API_URL}/auth/resend-verification`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.ok) {
          setMsg('Check your inbox for a new link.');
        } else {
          const body = await res.json().catch(() => ({}));
          setMsg(typeof body.message === 'string' ? body.message : 'Could not resend');
        }
      })
      .catch(() => setMsg('Network error'))
      .finally(() => setBusy(false));
  };

  if (!show) {
    return null;
  }

  return (
    <div className="verify-banner" role="status">
      <span>Please verify your email to import contacts and send campaigns.</span>
      <button type="button" disabled={busy} onClick={resend}>
        {busy ? 'Sending…' : 'Resend link'}
      </button>
      {msg ? <span className="verify-banner-msg">{msg}</span> : null}
    </div>
  );
}
