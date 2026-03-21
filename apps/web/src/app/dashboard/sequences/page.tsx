'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface SequenceRow {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count: { steps: number; enrollments: number };
}

export default function SequencesListPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<SequenceRow[]>([]);
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
    fetch(`${API_URL}/sequences`, { headers: { Authorization: `Bearer ${t}` } })
      .then(async (res) => {
        if (res.status === 401) {
          localStorage.removeItem('accessToken');
          router.replace('/login');
          return;
        }
        if (res.ok) {
          setItems(await res.json());
        }
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
        title="Sequences"
        description="Multi-step automations with enrollments and timed sends."
        actions={
          <Link className="button" href="/dashboard/sequences/new">
            New sequence
          </Link>
        }
      />

      {loading ? (
        <p className="loading-line loading-line--pulse" aria-live="polite">
          Loading sequences…
        </p>
      ) : (
        <Card className="surface-card--wide">
          <CardHeader title="All sequences" />
          {!items.length ? (
            <EmptyState
              title="No sequences yet"
              description="Define steps with templates and delays, then enroll subscribed contacts."
              action={
                <Link className="button" href="/dashboard/sequences/new">
                  New sequence
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
                    <th scope="col">Steps</th>
                    <th scope="col">Enrollments</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.status}</td>
                      <td>{row._count.steps}</td>
                      <td>{row._count.enrollments}</td>
                      <td>
                        <Link className="button ghost small" href={`/dashboard/sequences/${row.id}`}>
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
