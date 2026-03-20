'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface StepDetail {
  id: string;
  order: number;
  delayMinutes: number;
  template: { id: string; name: string; subject: string };
}

interface SequenceDetail {
  id: string;
  name: string;
  status: string;
  steps: StepDetail[];
}

interface EnrollmentItem {
  id: string;
  status: string;
  currentStepOrder: number;
  pendingJobId: string | null;
  nextRunAt: string | null;
  createdAt: string;
  contact: { id: string; email: string; firstName: string | null; lastName: string | null; status: string };
  recentMessageEvents: {
    sequenceStepOrder: number | null;
    status: string;
    createdAt: string;
    email: string;
  }[];
}

export default function SequenceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [token, setToken] = useState<string | null>(null);
  const [row, setRow] = useState<SequenceDetail | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [enrollTotal, setEnrollTotal] = useState(0);
  const [contactIdsText, setContactIdsText] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('accessToken');
    if (!t) {
      router.replace('/login');
      return;
    }
    setToken(t);
  }, [router]);

  const load = useCallback(() => {
    const t = localStorage.getItem('accessToken');
    if (!t || !id) {
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/sequences/${id}`, { headers: { Authorization: `Bearer ${t}` } }),
      fetch(`${API_URL}/sequences/${id}/enrollments?pageSize=50`, {
        headers: { Authorization: `Bearer ${t}` },
      }),
    ])
      .then(async ([rSeq, rEnr]) => {
        if (rSeq.status === 401) {
          localStorage.removeItem('accessToken');
          router.replace('/login');
          return;
        }
        if (rSeq.ok) {
          setRow(await rSeq.json());
        } else {
          setRow(null);
        }
        if (rEnr.ok) {
          const body = await rEnr.json();
          setEnrollments(body.items ?? []);
          setEnrollTotal(body.total ?? 0);
        }
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    if (token && id) {
      load();
    }
  }, [token, id, load]);

  const activate = async () => {
    const t = localStorage.getItem('accessToken');
    if (!t) {
      return;
    }
    setBusy(true);
    setError('');
    const res = await fetch(`${API_URL}/sequences/${id}/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? `Error ${res.status}`);
      return;
    }
    setMessage('Sequence activated.');
    load();
  };

  const archive = async () => {
    const t = localStorage.getItem('accessToken');
    if (!t) {
      return;
    }
    setBusy(true);
    setError('');
    const res = await fetch(`${API_URL}/sequences/${id}/archive`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? `Error ${res.status}`);
      return;
    }
    setMessage('Sequence archived; active enrollments cancelled.');
    load();
  };

  const enroll = async (e: FormEvent) => {
    e.preventDefault();
    const t = localStorage.getItem('accessToken');
    if (!t) {
      return;
    }
    const ids = contactIdsText
      .split(/[\s,;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!ids.length) {
      setError('Enter at least one contact id');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    const res = await fetch(`${API_URL}/sequences/${id}/enroll`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${t}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contactIds: ids }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? `Error ${res.status}`);
      return;
    }
    const body = await res.json();
    setMessage(`Enrolled ${body.enrolled} contact(s). Worker must be running.`);
    setContactIdsText('');
    load();
  };

  if (!token) {
    return <main className="container">Checking auth...</main>;
  }

  if (loading) {
    return <main className="container">Loading…</main>;
  }

  if (!row) {
    return (
      <main className="container">
        <p>Not found.</p>
        <Link href="/dashboard/sequences">Back</Link>
      </main>
    );
  }

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/sequences">← Sequences</Link>
      </p>
      <h1>{row.name}</h1>
      <p>
        <strong>Status:</strong> {row.status}
      </p>
      {error ? <p className="error">{typeof error === 'string' ? error : JSON.stringify(error)}</p> : null}
      {message ? <p style={{ color: '#15803d' }}>{message}</p> : null}

      <div className="card" style={{ maxWidth: 720 }}>
        <h2 style={{ marginTop: 0 }}>Steps</h2>
        <ol>
          {row.steps.map((s) => (
            <li key={s.id}>
              Order {s.order}: {s.template.name} — delay after previous: {s.delayMinutes} min
            </li>
          ))}
        </ol>
      </div>

      <section style={{ marginTop: 16 }}>
        {row.status === 'DRAFT' ? (
          <button className="button" disabled={busy} onClick={() => void activate()} type="button">
            Activate
          </button>
        ) : null}
        {row.status !== 'ARCHIVED' ? (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void archive()}
            style={{ marginLeft: 8 }}
            type="button"
          >
            Archive
          </button>
        ) : null}
      </section>

      {row.status === 'ACTIVE' ? (
        <section className="card" style={{ maxWidth: 720, marginTop: 24 }}>
          <h2>Enroll contacts</h2>
          <p className="muted">
            Paste contact IDs (cuid), separated by comma or newline. Only <strong>SUBSCRIBED</strong> contacts in
            this workspace are accepted. Requires the <strong>worker</strong> process.
          </p>
          <form onSubmit={(e) => void enroll(e)}>
            <div className="field">
              <label htmlFor="ids">Contact IDs</label>
              <textarea
                id="ids"
                onChange={(e) => setContactIdsText(e.target.value)}
                placeholder="clxxxxxxxx…"
                rows={4}
                style={{ width: '100%', fontFamily: 'monospace' }}
                value={contactIdsText}
              />
            </div>
            <button className="button" disabled={busy} type="submit">
              Enroll
            </button>
          </form>
        </section>
      ) : null}

      <section className="card" style={{ maxWidth: 720, marginTop: 24 }}>
        <h2>
          Enrollments <span className="muted">({enrollTotal})</span>
        </h2>
        {!enrollments.length ? (
          <p className="muted">None yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Status</th>
                <th>Step</th>
                <th>Recent events</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className="muted" style={{ fontSize: '0.75rem' }}>
                      {e.contact.id.slice(0, 8)}…
                    </span>
                    <br />
                    {e.contact.email}
                  </td>
                  <td>{e.status}</td>
                  <td>{e.currentStepOrder}</td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {e.recentMessageEvents.length ? (
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {e.recentMessageEvents.map((ev, i) => (
                          <li key={i}>
                            step {ev.sequenceStepOrder ?? '?'} {ev.status}{' '}
                            {new Date(ev.createdAt).toLocaleString()}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
