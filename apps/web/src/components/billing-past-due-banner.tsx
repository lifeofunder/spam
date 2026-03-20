'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type BillingSummary = {
  subscriptionStatus: string;
};

export function BillingPastDueBanner() {
  const pathname = usePathname();
  const [pastDue, setPastDue] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      return;
    }
    fetch(`${API_URL}/billing`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          return;
        }
        const data: BillingSummary = await res.json();
        setPastDue(data.subscriptionStatus === 'PAST_DUE');
      })
      .catch(() => {});
  }, [pathname]);

  if (!pastDue || pathname?.startsWith('/dashboard/billing')) {
    return null;
  }

  return (
    <div
      style={{
        background: '#7c2d12',
        color: '#fff',
        padding: '10px 16px',
        textAlign: 'center',
        fontSize: '14px',
      }}
    >
      Your subscription is <strong>past due</strong>. Marketing actions are paused until you update billing.{' '}
      <Link href="/dashboard/billing" style={{ color: '#fed7aa', textDecoration: 'underline' }}>
        Open billing
      </Link>
    </div>
  );
}
