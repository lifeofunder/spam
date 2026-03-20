'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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
    return <main className="container">Checking auth...</main>;
  }

  return (
    <main className="container">
      <p>
        <Link href="/dashboard">← Dashboard</Link>
      </p>
      <h1>Sequences</h1>
      <p>
        <Link className="button" href="/dashboard/sequences/new" style={{ display: 'inline-block' }}>
          New sequence
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
                <th>Steps</th>
                <th>Enrollments</th>
                <th />
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
                    <Link href={`/dashboard/sequences/${row.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length ? <p className="muted">No sequences yet.</p> : null}
        </div>
      )}
    </main>
  );
}
