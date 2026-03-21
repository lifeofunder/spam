'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface TemplateDetail {
  id: string;
  name: string;
  subject: string;
  html: string;
  text: string | null;
}

export default function EditTemplatePageClient() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [token, setToken] = useState<string | null>(null);
  const [row, setRow] = useState<TemplateDetail | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [text, setText] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [sampleJson, setSampleJson] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

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
    if (!t || !id) {
      return;
    }
    setLoading(true);
    fetch(`${API_URL}/templates/${id}`, { headers: { Authorization: `Bearer ${t}` } })
      .then(async (res) => {
        if (res.status === 401) {
          localStorage.removeItem('accessToken');
          router.replace('/login');
          return;
        }
        if (!res.ok) {
          setRow(null);
          return;
        }
        const data: TemplateDetail = await res.json();
        setRow(data);
        setName(data.name);
        setSubject(data.subject);
        setHtml(data.html);
        setText(data.text ?? '');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token && id) {
      load();
    }
  }, [token, id]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      return;
    }
    setError('');
    setMessage('');
    setSaving(true);
    const res = await fetch(`${API_URL}/templates/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        subject,
        html,
        text: text.trim() || null,
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
    setMessage('Saved.');
    load();
  };

  const onTestSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !testEmail.trim()) {
      return;
    }
    let sampleVariables: Record<string, string> | undefined;
    if (sampleJson.trim()) {
      try {
        sampleVariables = JSON.parse(sampleJson) as Record<string, string>;
      } catch {
        setError('Invalid JSON in sample variables');
        return;
      }
    }
    setError('');
    setMessage('');
    setTesting(true);
    const res = await fetch(`${API_URL}/templates/${id}/test-send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: testEmail.trim(), sampleVariables }),
    });
    setTesting(false);
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
    setMessage('Test send dispatched (check API logs or MailHog).');
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
        <p>Template not found.</p>
        <Link href="/dashboard/templates">Back</Link>
      </main>
    );
  }

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/templates">← Templates</Link>
      </p>
      <h1>Edit template</h1>
      {error ? <p className="error">{typeof error === 'string' ? error : JSON.stringify(error)}</p> : null}
      {message ? <p style={{ color: '#15803d' }}>{message}</p> : null}

      <form className="card" onSubmit={onSave} style={{ maxWidth: 640 }}>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" onChange={(e) => setName(e.target.value)} required value={name} />
        </div>
        <div className="field">
          <label htmlFor="subject">Subject</label>
          <input id="subject" onChange={(e) => setSubject(e.target.value)} required value={subject} />
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
          <label htmlFor="text">Plain text</label>
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
          {'{{company}}'}, {'{{phone}}'}, {'{{tags}}'}, {'{{unsubscribeUrl}}'} (при настроенных{' '}
          <code>UNSUBSCRIBE_SECRET</code> + <code>PUBLIC_WEB_URL</code>; иначе пусто; футер с ссылкой
          добавляется, если URL нет в HTML/тексте)
        </p>
        <button className="button" disabled={saving} type="submit">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>

      <section className="card" style={{ maxWidth: 640, marginTop: 24 }}>
        <h2>Test send</h2>
        <form onSubmit={onTestSend}>
          <div className="field">
            <label htmlFor="testEmail">To email</label>
            <input
              id="testEmail"
              onChange={(e) => setTestEmail(e.target.value)}
              required
              type="email"
              value={testEmail}
            />
          </div>
          <div className="field">
            <label htmlFor="sampleJson">Sample variables (JSON, optional)</label>
            <textarea
              id="sampleJson"
              onChange={(e) => setSampleJson(e.target.value)}
              placeholder='{"firstName":"Alex","company":"Demo"}'
              rows={3}
              style={{ width: '100%', fontFamily: 'monospace' }}
              value={sampleJson}
            />
          </div>
          <button className="button secondary" disabled={testing} type="submit">
            {testing ? 'Sending…' : 'Send test'}
          </button>
        </form>
      </section>
    </main>
  );
}
