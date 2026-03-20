'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function datetimeLocalToIso(local: string): string {
  const d = new Date(local);
  return d.toISOString();
}

interface TemplateRow {
  id: string;
  name: string;
  subject: string;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [scheduledAtLocal, setScheduledAtLocal] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('accessToken');
    if (!t) {
      router.replace('/login');
      return;
    }
    setToken(t);
    fetch(`${API_URL}/templates`, { headers: { Authorization: `Bearer ${t}` } })
      .then(async (res) => {
        if (res.ok) {
          const list: TemplateRow[] = await res.json();
          setTemplates(list);
          if (list[0]) {
            setTemplateId(list[0].id);
          }
        }
      })
      .catch(() => {});
  }, [router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !templateId) {
      return;
    }
    setError('');
    setSaving(true);
    const res = await fetch(`${API_URL}/campaigns`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        templateId,
        query: query.trim() || undefined,
        tag: tag.trim() || undefined,
        ...(scheduledAtLocal.trim()
          ? { scheduledAt: datetimeLocalToIso(scheduledAtLocal) }
          : {}),
      }),
    });
    setSaving(false);
    if (res.status === 401) {
      localStorage.removeItem('accessToken');
      router.replace('/login');
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? `Error ${res.status}`);
      return;
    }
    const created = await res.json();
    router.push(`/dashboard/campaigns/${created.id}`);
  };

  if (!token) {
    return <main className="container">Checking auth...</main>;
  }

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/campaigns">← Campaigns</Link>
      </p>
      <h1>New campaign (draft)</h1>
      {error ? <p className="error">{typeof error === 'string' ? error : JSON.stringify(error)}</p> : null}
      <form className="card" onSubmit={onSubmit} style={{ maxWidth: 520 }}>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" onChange={(e) => setName(e.target.value)} required value={name} />
        </div>
        <div className="field">
          <label htmlFor="templateId">Template</label>
          <select
            id="templateId"
            onChange={(e) => setTemplateId(e.target.value)}
            required
            value={templateId}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.subject}
              </option>
            ))}
          </select>
        </div>
        {!templates.length ? (
          <p className="error">
            Create a template first. <Link href="/dashboard/templates/new">New template</Link>
          </p>
        ) : null}
        <div className="field">
          <label htmlFor="query">Audience search (optional, same as contacts)</label>
          <input
            id="query"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in email, name, company…"
            value={query}
          />
        </div>
        <div className="field">
          <label htmlFor="tag">Tag filter (optional, exact)</label>
          <input id="tag" onChange={(e) => setTag(e.target.value)} value={tag} />
        </div>
        <div className="field">
          <label htmlFor="scheduledAt">Scheduled send (optional, your local time)</label>
          <input
            id="scheduledAt"
            onChange={(e) => setScheduledAtLocal(e.target.value)}
            type="datetime-local"
            value={scheduledAtLocal}
          />
        </div>
        <p className="muted">
          Only contacts with status SUBSCRIBED are included. Schedule uses UTC on the server (value is converted from
          your browser local time).
        </p>
        <button className="button" disabled={saving || !templates.length} type="submit">
          {saving ? 'Creating…' : 'Create draft'}
        </button>
      </form>
    </main>
  );
}
