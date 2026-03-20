'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface TemplateRow {
  id: string;
  name: string;
}

type StepRow = { order: number; templateId: string; delayMinutes: number };

export default function NewSequencePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<StepRow[]>([
    { order: 1, templateId: '', delayMinutes: 0 },
    { order: 2, templateId: '', delayMinutes: 1440 },
    { order: 3, templateId: '', delayMinutes: 2880 },
  ]);
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
            setSteps((prev) =>
              prev.map((s) => ({ ...s, templateId: s.templateId || list[0]!.id })),
            );
          }
        }
      })
      .catch(() => {});
  }, [router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      return;
    }
    setError('');
    setSaving(true);
    const res = await fetch(`${API_URL}/sequences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        steps: steps.map((s) => ({
          order: s.order,
          templateId: s.templateId,
          delayMinutes: Number(s.delayMinutes) || 0,
        })),
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
    router.push(`/dashboard/sequences/${created.id}`);
  };

  if (!token) {
    return <main className="container">Checking auth...</main>;
  }

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/sequences">← Sequences</Link>
      </p>
      <h1>New sequence</h1>
      {error ? <p className="error">{typeof error === 'string' ? error : JSON.stringify(error)}</p> : null}
      <form className="card" onSubmit={onSubmit} style={{ maxWidth: 640 }}>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" onChange={(e) => setName(e.target.value)} required value={name} />
        </div>
        <p className="muted">
          Steps run in <code>order</code>. <code>delayMinutes</code> is the wait <strong>after the previous</strong>{' '}
          email before this step (step 1 often 0).
        </p>
        {steps.map((s, idx) => (
          <div
            key={s.order}
            className="card"
            style={{ marginBottom: 12, padding: 12, background: '#f9fafb' }}
          >
            <strong>Step {s.order}</strong>
            <div className="field">
              <label>Template</label>
              <select
                onChange={(e) => {
                  const v = e.target.value;
                  setSteps((prev) => prev.map((x, i) => (i === idx ? { ...x, templateId: v } : x)));
                }}
                required
                value={s.templateId}
              >
                <option value="">—</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Delay (minutes after previous)</label>
              <input
                min={0}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setSteps((prev) => prev.map((x, i) => (i === idx ? { ...x, delayMinutes: v } : x)));
                }}
                type="number"
                value={s.delayMinutes}
              />
            </div>
          </div>
        ))}
        {!templates.length ? (
          <p className="error">
            Create templates first. <Link href="/dashboard/templates/new">New template</Link>
          </p>
        ) : null}
        <button className="button" disabled={saving || !templates.length} type="submit">
          {saving ? 'Saving…' : 'Create draft'}
        </button>
      </form>
    </main>
  );
}
