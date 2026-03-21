'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';

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
        title="New template"
        description="Create a reusable HTML email with merge tags."
        actions={
          <Link className="button ghost small" href="/dashboard/templates">
            ← All templates
          </Link>
        }
      />
      {error ? (
        <div className="form-error-banner" role="alert">
          {typeof error === 'string' ? error : JSON.stringify(error)}
        </div>
      ) : null}
      <form className="surface-card surface-card--wide" onSubmit={onSubmit}>
        <div className="field">
          <label className="field-label" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            className="input"
            onChange={(e) => setName(e.target.value)}
            required
            value={name}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="subject">
            Subject
          </label>
          <input
            id="subject"
            className="input"
            onChange={(e) => setSubject(e.target.value)}
            required
            value={subject}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="html">
            HTML
          </label>
          <textarea
            id="html"
            className="input textarea-code"
            onChange={(e) => setHtml(e.target.value)}
            required
            rows={10}
            value={html}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="text">
            Plain text (optional)
          </label>
          <textarea
            id="text"
            className="input textarea-code"
            onChange={(e) => setText(e.target.value)}
            rows={6}
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
