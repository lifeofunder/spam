'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

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
    return (
      <main>
        <p className="loading-line loading-line--pulse" aria-live="polite">
          Checking session…
        </p>
      </main>
    );
  }

  return (
    <main>
      <PageHeader
        title="Billing"
        description="Plan limits, usage this period, and Stripe checkout or portal."
      />

      {checkoutFlash === 'success' && (
        <p className="billing-flash-success" role="status">
          Checkout completed — refreshing subscription may take a few seconds.
        </p>
      )}
      {checkoutFlash === 'cancel' && (
        <p className="muted" role="status">
          Checkout canceled.
        </p>
      )}

      {loading && (
        <p className="loading-line loading-line--pulse" aria-live="polite">
          Loading billing…
        </p>
      )}
      {!loading && !data && (
        <p className="error" role="alert">
          Unable to load billing.
        </p>
      )}
      {data && (
        <div className="billing-grid">
          <Card className="surface-card--wide">
            <h2 className="card-title">Plan</h2>
            <ul className="billing-facts muted">
              <li>
                <strong className="billing-facts-label">Stored plan:</strong> {data.planKey}
              </li>
              <li>
                <strong className="billing-facts-label">Effective limits:</strong> {data.limitsPlanKey}
              </li>
              <li>
                <strong className="billing-facts-label">Subscription:</strong> {data.subscriptionStatus}
              </li>
              <li>
                <strong className="billing-facts-label">Current period ends:</strong>{' '}
                {data.currentPeriodEnd
                  ? new Date(data.currentPeriodEnd).toLocaleString(undefined, { timeZone: 'UTC' }) + ' UTC'
                  : '—'}
              </li>
            </ul>
          </Card>

          <Card className="surface-card--wide">
            <h2 className="card-title">Usage ({data.usage.usagePeriodKey} UTC)</h2>
            <ul className="billing-facts muted">
              <li>
                Contacts: {data.usage.contactsCount} / {data.limits.maxContacts}
              </li>
              <li>
                Emails sent this month: {data.usage.emailsSentThisMonth} / {data.limits.maxEmailsPerMonth}
              </li>
              <li>
                Active sequences: {data.usage.activeSequencesCount} / {data.limits.maxActiveSequences}
              </li>
            </ul>
          </Card>

          {data.subscriptionStatus === 'PAST_DUE' && (
            <div className="banner-inline banner-inline--warning" role="alert">
              Payment failed — update your card in the customer portal to restore campaigns, sequences, and
              imports.
            </div>
          )}

          <div className="billing-actions">
            <Button type="button" onClick={() => postBilling('checkout-session')}>
              Upgrade to Pro
            </Button>
            <Button
              variant="secondary"
              type="button"
              disabled={!data.hasStripeCustomer}
              onClick={() => postBilling('portal-session')}
            >
              Manage billing
            </Button>
            <Button variant="secondary" type="button" onClick={() => load()}>
              Refresh
            </Button>
          </div>
          {actionError ? (
            <p className="error" role="alert">
              {actionError}
            </p>
          ) : null}
          <p className="muted" style={{ marginTop: 'var(--space-4)' }}>
            Questions about limits? See <Link href="/pricing">pricing</Link> or contact support from your workspace
            settings when available.
          </p>
        </div>
      )}
    </main>
  );
}
