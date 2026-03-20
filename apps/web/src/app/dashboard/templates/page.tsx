'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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
    return <main className="container">Checking auth...</main>;
  }

  return (
    <main className="container">
      <p>
        <Link href="/dashboard">← Dashboard</Link>
      </p>
      <h1>Email templates</h1>
      <p>
        <Link className="button" href="/dashboard/templates/new" style={{ display: 'inline-block' }}>
          New template
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
                <th>Subject</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.subject}</td>
                  <td>{new Date(row.updatedAt).toLocaleString()}</td>
                  <td>
                    <Link href={`/dashboard/templates/${row.id}`}>Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length ? <p className="muted">No templates yet.</p> : null}
        </div>
      )}
    </main>
  );
}
