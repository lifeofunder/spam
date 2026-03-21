'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface TemplateRow {
  id: string;
  name: string;
  subject: string;
  createdAt: string;
  updatedAt: string;
}

export default function TemplatesListPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<TemplateRow[]>([]);
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
    fetch(`${API_URL}/templates`, { headers: { Authorization: `Bearer ${t}` } })
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
        title="Email templates"
        description="Reusable subjects and HTML for campaigns and sequences."
        actions={
          <Link className="button" href="/dashboard/templates/new">
            New template
          </Link>
        }
      />

      {loading ? (
        <p className="loading-line loading-line--pulse" aria-live="polite">
          Loading templates…
        </p>
      ) : (
        <Card className="surface-card--wide">
          <CardHeader title="All templates" />
          {!items.length ? (
            <EmptyState
              title="No templates yet"
              description="Create a template to use in campaigns and sequence steps."
              action={
                <Link className="button" href="/dashboard/templates/new">
                  New template
                </Link>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Subject</th>
                    <th scope="col">Updated</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.subject}</td>
                      <td>{new Date(row.updatedAt).toLocaleString()}</td>
                      <td>
                        <Link className="button ghost small" href={`/dashboard/templates/${row.id}`}>
                          Edit
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
