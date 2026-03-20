'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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
    return <main className="container">Checking auth...</main>;
  }

  return (
    <main className="container">
      <p>
        <Link href="/dashboard">← Dashboard</Link>
      </p>
      <h1>Campaigns</h1>
      <p>
        <Link className="button" href="/dashboard/campaigns/new" style={{ display: 'inline-block' }}>
          New campaign
        </Link>
      </p>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="card" style={{ maxWidth: '100%' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Filter</th>
                <th>Events (Q/S/F)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>
                    {row.status}
                    {row.status === 'DRAFT' && row.scheduledAt ? (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#1d4ed8',
                          background: '#dbeafe',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}
                      >
                        SCHEDULED
                      </span>
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
                    <Link href={`/dashboard/campaigns/${row.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length ? <p className="muted">No campaigns yet.</p> : null}
        </div>
      )}
    </main>
  );
}
