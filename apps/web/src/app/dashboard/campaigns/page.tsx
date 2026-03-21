'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface MessageStats {
  queued: number;
  sent: number;
  failed: number;
}

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  templateId: string;
  query: string | null;
  tag: string | null;
  sendJobId: string | null;
  scheduleJobId: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  messageStats: MessageStats;
}

export default function CampaignsListPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('accessToken');
    if (!t) {
      router.replace('/login');
      return;
    }
    setToken(t);
  }, [router]);

  const load = () => {
    const t = localStorage.getItem('accessToken');
    if (!t) {
      return;
    }
    setLoading(true);
    fetch(`${API_URL}/campaigns`, { headers: { Authorization: `Bearer ${t}` } })
      .then(async (res) => {
        if (res.status === 401) {
          localStorage.removeItem('accessToken');
          router.replace('/login');
          return;
        }
        if (!res.ok) {
          return;
        }
        setItems(await res.json());
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) {
      load();
    }
  }, [token]);

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
        title="Campaigns"
        description="Draft, schedule, and send to filtered audiences."
        actions={
          <Link className="button" href="/dashboard/campaigns/new">
            New campaign
          </Link>
        }
      />

      {loading ? (
        <p className="loading-line loading-line--pulse" aria-live="polite">
          Loading campaigns…
        </p>
      ) : (
        <Card className="surface-card--wide">
          <CardHeader title="All campaigns" />
          {!items.length ? (
            <EmptyState
              title="No campaigns yet"
              description="Create a campaign, pick a template, and send when your audience is ready."
              action={
                <Link className="button" href="/dashboard/campaigns/new">
                  New campaign
                </Link>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Status</th>
                    <th scope="col">Filter</th>
                    <th scope="col">Events (Q/S/F)</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>
                        {row.status}
                        {row.status === 'DRAFT' && row.scheduledAt ? (
                          <span className="badge badge--info">SCHEDULED</span>
                        ) : null}
                      </td>
                      <td className="muted">
                        {row.query ? `q:${row.query} ` : ''}
                        {row.tag ? `tag:${row.tag}` : '—'}
                      </td>
                      <td>
                        {row.messageStats.queued}/{row.messageStats.sent}/{row.messageStats.failed}
                      </td>
                      <td>
                        <Link className="button ghost small" href={`/dashboard/campaigns/${row.id}`}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </main>
  );
}
