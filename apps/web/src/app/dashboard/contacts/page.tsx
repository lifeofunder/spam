'use client';

import type { ContactsListResponseDto, CsvImportResultDto } from '@email-saas/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function ContactsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [data, setData] = useState<ContactsListResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [importResult, setImportResult] = useState<CsvImportResultDto | null>(null);
  const [importing, setImporting] = useState(false);
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('accessToken');
    if (!t) {
      router.replace('/login');
      return;
    }
    setToken(t);
  }, [router]);

  const loadContacts = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set('query', query.trim());
    }
    if (tagFilter.trim()) {
      params.set('tag', tagFilter.trim());
    }
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));

    const response = await fetch(`${API_URL}/contacts?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('accessToken');
        router.replace('/login');
        return;
      }
      setData(null);
      setLoading(false);
      return;
    }

    const payload: ContactsListResponseDto = await response.json();
    setData(payload);
    setTagDrafts((prev) => {
      const next = { ...prev };
      for (const item of payload.items) {
        if (next[item.id] === undefined) {
          next[item.id] = item.tags.join(', ');
        }
      }
      return next;
    });
    setLoading(false);
  }, [token, query, tagFilter, page, router]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const onImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      return;
    }
    const form = event.currentTarget;
    const input = form.elements.namedItem('file') as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    setImporting(true);
    setImportResult(null);

    const body = new FormData();
    body.append('file', file);

    const response = await fetch(`${API_URL}/contacts/import-csv`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setImportResult({
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [{ line: 0, message: err.message ?? `Import failed (${response.status})` }],
      });
      setImporting(false);
      return;
    }

    const result: CsvImportResultDto = await response.json();
    setImportResult(result);
    setImporting(false);
    input.value = '';
    void loadContacts();
  };

  const saveTags = async (id: string) => {
    if (!token) {
      return;
    }
    const raw = tagDrafts[id] ?? '';
    const tags = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    setSavingId(id);
    const response = await fetch(`${API_URL}/contacts/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags }),
    });
    setSavingId(null);

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('accessToken');
        router.replace('/login');
        return;
      }
      return;
    }

    void loadContacts();
  };

  const unsubscribe = async (id: string) => {
    if (!token) {
      return;
    }
    const response = await fetch(`${API_URL}/contacts/${id}/unsubscribe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('accessToken');
        router.replace('/login');
      }
      return;
    }
    void loadContacts();
  };

  if (!token) {
    return <main className="container">Checking auth...</main>;
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <main className="container">
      <p>
        <Link href="/dashboard">← Back to dashboard</Link>
      </p>
      <h1>Contacts</h1>

      <section className="card" style={{ maxWidth: 640, marginBottom: 24 }}>
        <h2>Import CSV</h2>
        <p className="muted">Multipart field name must be <code>file</code>.</p>
        <form onSubmit={onImport}>
          <input accept=".csv,text/csv" name="file" required type="file" />
          <button className="button" disabled={importing} style={{ marginLeft: 12 }} type="submit">
            {importing ? 'Uploading...' : 'Upload'}
          </button>
        </form>
        {importResult ? (
          <div style={{ marginTop: 16 }}>
            <p>
              Inserted: {importResult.inserted}, updated: {importResult.updated}, skipped:{' '}
              {importResult.skipped}
            </p>
            {importResult.errors.length ? (
              <div>
                <strong>Row issues</strong>
                <ul>
                  {importResult.errors.map((e) => (
                    <li key={`${e.line}-${e.message}`}>
                      Line {e.line}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="card" style={{ maxWidth: '100%' }}>
        <h2>Directory</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <input
            onChange={(e) => {
              setPage(1);
              setQuery(e.target.value);
            }}
            placeholder="Search email, name, company..."
            style={{ flex: '1 1 220px', padding: 8 }}
            type="search"
            value={query}
          />
          <input
            onChange={(e) => {
              setPage(1);
              setTagFilter(e.target.value);
            }}
            placeholder="Filter by tag (exact)"
            style={{ flex: '0 1 200px', padding: 8 }}
            type="text"
            value={tagFilter}
          />
          <button className="button secondary" onClick={() => void loadContacts()} type="button">
            Refresh
          </button>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : !data ? (
          <p>Failed to load contacts.</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Status</th>
                    <th>Tags</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((c) => (
                    <tr key={c.id}>
                      <td>{c.email}</td>
                      <td>
                        {[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td>{c.company ?? '—'}</td>
                      <td>{c.status}</td>
                      <td style={{ minWidth: 220 }}>
                        <input
                          onChange={(e) =>
                            setTagDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                          }
                          style={{ width: '100%', padding: 6 }}
                          type="text"
                          value={tagDrafts[c.id] ?? ''}
                        />
                        <button
                          className="button small"
                          disabled={savingId === c.id}
                          onClick={() => void saveTags(c.id)}
                          style={{ marginTop: 6 }}
                          type="button"
                        >
                          {savingId === c.id ? 'Saving...' : 'Save tags'}
                        </button>
                      </td>
                      <td>
                        <button
                          className="button danger"
                          disabled={c.status === 'UNSUBSCRIBED'}
                          onClick={() => void unsubscribe(c.id)}
                          type="button"
                        >
                          Unsubscribe
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
              <button
                className="button secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                type="button"
              >
                Prev
              </button>
              <span>
                Page {page} / {totalPages} ({data.total} total)
              </span>
              <button
                className="button secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
