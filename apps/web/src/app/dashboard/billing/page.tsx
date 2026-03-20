'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type BillingResponse = {
  planKey: string;
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  hasStripeCustomer: boolean;
  hasStripeSubscription: boolean;
  limitsPlanKey: string;
  limits: { maxContacts: number; maxEmailsPerMonth: number; maxActiveSequences: number };
  usage: {
    contactsCount: number;
    activeSequencesCount: number;
    emailsSentThisMonth: number;
    usagePeriodKey: string;
  };
};

export default function BillingPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkoutFlash, setCheckoutFlash] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('checkout');
    setCheckoutFlash(q);
  }, []);

  const load = useCallback(() => {
    const t = localStorage.getItem('accessToken');
    if (!t) {
      return;
    }
    setLoading(true);
    fetch(`${API_URL}/billing`, { headers: { Authorization: `Bearer ${t}` } })
      .then(async (res) => {
        if (res.status === 401) {
          localStorage.removeItem('accessToken');
          router.replace('/login');
          return;
        }
        if (!res.ok) {
          setData(null);
          return;
        }
        setData(await res.json());
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    const t = localStorage.getItem('accessToken');
    if (!t) {
      router.replace('/login');
      return;
    }
    setToken(t);
  }, [router]);

  useEffect(() => {
    if (token) {
      load();
    }
  }, [token, load]);

  const postBilling = async (path: string) => {
    const t = localStorage.getItem('accessToken');
    if (!t) {
      return;
    }
    setActionError(null);
    const res = await fetch(`${API_URL}/billing/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setActionError((body as { message?: string }).message ?? `Request failed (${res.status})`);
      return;
    }
    const { url } = (await res.json()) as { url: string };
    if (url) {
      window.location.href = url;
    }
  };

  if (!token) {
    return <main className="container">Checking auth...</main>;
  }

  return (
    <main className="container">
      <p>
        <Link href="/dashboard">← Dashboard</Link>
      </p>
      <h1>Billing</h1>

      {checkoutFlash === 'success' && (
        <p style={{ color: 'green' }}>Checkout completed — refreshing subscription may take a few seconds.</p>
      )}
      {checkoutFlash === 'cancel' && <p>Checkout canceled.</p>}

      {loading && <p>Loading…</p>}
      {!loading && !data && <p>Unable to load billing.</p>}
      {data && (
        <>
          <section style={{ marginBottom: 24 }}>
            <h2>Plan</h2>
            <p>
              <strong>Stored plan:</strong> {data.planKey} · <strong>Effective limits:</strong>{' '}
              {data.limitsPlanKey}
            </p>
            <p>
              <strong>Subscription status:</strong> {data.subscriptionStatus}
            </p>
            <p>
              <strong>Current period ends:</strong>{' '}
              {data.currentPeriodEnd
                ? new Date(data.currentPeriodEnd).toLocaleString(undefined, { timeZone: 'UTC' }) + ' UTC'
                : '—'}
            </p>
          </section>

          <section style={{ marginBottom: 24 }}>
            <h2>Usage ({data.usage.usagePeriodKey} UTC)</h2>
            <ul>
              <li>Contacts: {data.usage.contactsCount} / {data.limits.maxContacts}</li>
              <li>Emails sent this month: {data.usage.emailsSentThisMonth} / {data.limits.maxEmailsPerMonth}</li>
              <li>Active sequences: {data.usage.activeSequencesCount} / {data.limits.maxActiveSequences}</li>
            </ul>
          </section>

          {data.subscriptionStatus === 'PAST_DUE' && (
            <p style={{ color: '#b45309', fontWeight: 600 }}>
              Payment failed — update your card in the customer portal to restore campaigns, sequences, and
              imports.
            </p>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="button" type="button" onClick={() => postBilling('checkout-session')}>
              Upgrade to Pro
            </button>
            <button
              className="button"
              type="button"
              disabled={!data.hasStripeCustomer}
              onClick={() => postBilling('portal-session')}
            >
              Manage billing
            </button>
            <button className="button" type="button" onClick={() => load()}>
              Refresh
            </button>
          </div>
          {actionError && <p style={{ color: 'crimson' }}>{actionError}</p>}
        </>
      )}
    </main>
  );
}
