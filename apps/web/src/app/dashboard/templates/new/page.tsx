'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function NewTemplatePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('Hello {{firstName}}');
  const [html, setHtml] = useState('<p>Hi {{firstName}},</p><p>Your email: {{email}}</p>');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('accessToken');
    if (!t) {
      router.replace('/login');
      return;
    }
    setToken(t);
  }, [router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      return;
    }
    setError('');
    setSaving(true);
    const res = await fetch(`${API_URL}/templates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        subject,
        html,
        text: text.trim() || undefined,
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
    router.push(`/dashboard/templates/${created.id}`);
  };

  if (!token) {
    return <main className="container">Checking auth...</main>;
  }

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/templates">← Templates</Link>
      </p>
      <h1>New template</h1>
      {error ? <p className="error">{typeof error === 'string' ? error : JSON.stringify(error)}</p> : null}
      <form className="card" onSubmit={onSubmit} style={{ maxWidth: 640 }}>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            onChange={(e) => setName(e.target.value)}
            required
            value={name}
          />
        </div>
        <div className="field">
          <label htmlFor="subject">Subject</label>
          <input
            id="subject"
            onChange={(e) => setSubject(e.target.value)}
            required
            value={subject}
          />
        </div>
        <div className="field">
          <label htmlFor="html">HTML</label>
          <textarea
            id="html"
            onChange={(e) => setHtml(e.target.value)}
            required
            rows={10}
            style={{ width: '100%', fontFamily: 'monospace' }}
            value={html}
          />
        </div>
        <div className="field">
          <label htmlFor="text">Plain text (optional)</label>
          <textarea
            id="text"
            onChange={(e) => setText(e.target.value)}
            rows={6}
            style={{ width: '100%', fontFamily: 'monospace' }}
            value={text}
          />
        </div>
        <p className="muted">
          Placeholders: {'{{email}}'}, {'{{firstName}}'}, {'{{lastName}}'}, {'{{fullName}}'},{' '}
          {'{{company}}'}, {'{{phone}}'}, {'{{tags}}'}, {'{{unsubscribeUrl}}'} (если заданы{' '}
          <code>UNSUBSCRIBE_SECRET</code> и <code>PUBLIC_WEB_URL</code> в API — иначе пусто; при отсутствии
          ссылки в теле письма добавляется футер автоматически)
        </p>
        <button className="button" disabled={saving} type="submit">
          {saving ? 'Saving…' : 'Create'}
        </button>
      </form>
    </main>
  );
}
