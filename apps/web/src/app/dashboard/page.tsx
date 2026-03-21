'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface MeResponse {
  id: string;
  name: string;
  email: string;
  workspaceId: string;
  emailVerified?: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.replace('/login');
      return;
    }

    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) {
          localStorage.removeItem('accessToken');
          router.replace('/login');
          return;
        }
        const data: MeResponse = await response.json();
        setUser(data);
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <main>
        <p className="loading-line loading-line--pulse" aria-live="polite">
          Checking session…
        </p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main>
      <PageHeader
        title={`Welcome, ${user.name}`}
        description="Pick a section to manage contacts, templates, campaigns, and billing."
      />

      <Card className="surface-card--wide" style={{ marginBottom: 'var(--space-5)' }}>
        <h2 className="card-title">Account</h2>
        <dl className="dash-dl">
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Workspace</dt>
            <dd>
              <code className="code-inline">{user.workspaceId}</code>
            </dd>
          </div>
        </dl>
        {user.emailVerified === false ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Email not verified — check your inbox or use the banner above.
          </p>
        ) : null}
      </Card>

      <div className="dashboard-quicklinks">
        <Link href="/dashboard/contacts" className="quicklink-card">
          <span className="quicklink-title">Contacts</span>
          <span className="muted quicklink-desc">Import CSV &amp; tags</span>
        </Link>
        <Link href="/dashboard/templates" className="quicklink-card">
          <span className="quicklink-title">Templates</span>
          <span className="muted quicklink-desc">Subjects &amp; HTML</span>
        </Link>
        <Link href="/dashboard/campaigns" className="quicklink-card">
          <span className="quicklink-title">Campaigns</span>
          <span className="muted quicklink-desc">Send &amp; schedule</span>
        </Link>
        <Link href="/dashboard/sequences" className="quicklink-card">
          <span className="quicklink-title">Sequences</span>
          <span className="muted quicklink-desc">Automations</span>
        </Link>
        <Link href="/dashboard/billing" className="quicklink-card">
          <span className="quicklink-title">Billing</span>
          <span className="muted quicklink-desc">Plan &amp; usage</span>
        </Link>
      </div>

      <Card className="surface-card--wide" style={{ marginTop: 'var(--space-5)' }}>
        <Button
          variant="secondary"
          type="button"
          onClick={() => {
            localStorage.removeItem('accessToken');
            router.push('/login');
          }}
        >
          Log out
        </Button>
      </Card>
    </main>
  );
}
