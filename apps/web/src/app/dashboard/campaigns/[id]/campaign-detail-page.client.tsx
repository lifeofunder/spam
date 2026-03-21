'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function isoToDatetimeLocalValue(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(local: string): string {
  const d = new Date(local);
  return d.toISOString();
}

interface MessageStats {
  queued: number;
  sent: number;
  failed: number;
}

interface CampaignDetail {
  id: string;
  name: string;
  status: string;
  templateId: string;
  query: string | null;
  tag: string | null;
  sendJobId: string | null;
  scheduleJobId: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  template: { id: string; name: string; subject: string };
  messageStats: MessageStats;
  subscribedAudienceCount: number;
}

interface SendStatusResponse {
  campaignId: string;
  campaignStatus: string;
  jobId: string | null;
  jobState: string | null;
  progress: { processed: number; total: number } | null;
  scheduledAt: string | null;
  scheduleJobId: string | null;
  scheduleJobState: string | null;
  messageStats: MessageStats;
  subscribedAudienceCount: number;
  sentAt: string | null;
}

export default function CampaignDetailPageClient() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [token, setToken] = useState<string | null>(null);
  const [row, setRow] = useState<CampaignDetail | null>(null);
  const [sendStatus, setSendStatus] = useState<SendStatusResponse | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [scheduledLocal, setScheduledLocal] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [cancelScheduleLoading, setCancelScheduleLoading] = useState(false);
  const [resyncScheduleLoading, setResyncScheduleLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    fetch(`${API_URL}/campaigns/${id}`, { headers: { Authorization: `Bearer ${t}` } })
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
        const data: CampaignDetail = await res.json();
        setRow(data);
        setScheduledLocal(isoToDatetimeLocalValue(data.scheduledAt));
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  const fetchSendStatus = useCallback(() => {
    const t = localStorage.getItem('accessToken');
    if (!t || !id) {
      return;
    }
    fetch(`${API_URL}/campaigns/${id}/send-status`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          return;
        }
        setSendStatus(await res.json());
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (token && id) {
      load();
    }
  }, [token, id, load]);

  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    const status = sendStatus?.campaignStatus ?? row?.status;
    if (!token || !id || status !== 'SENDING') {
      return;
    }

    void fetchSendStatus();
    pollRef.current = setInterval(() => void fetchSendStatus(), 2000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [token, id, row?.status, sendStatus?.campaignStatus, fetchSendStatus]);

  useEffect(() => {
    const st = sendStatus?.campaignStatus;
    if (st === 'SENT' || st === 'FAILED') {
      void load();
    }
  }, [sendStatus?.campaignStatus, load]);

  useEffect(() => {
    const st = row?.status;
    if (!token || !id || st !== 'DRAFT' || !row?.scheduledAt) {
      return;
    }
    void fetchSendStatus();
    const tmr = setInterval(() => void fetchSendStatus(), 8000);
    return () => clearInterval(tmr);
  }, [token, id, row?.status, row?.scheduledAt, fetchSendStatus]);

  const sendNow = async () => {
    const t = localStorage.getItem('accessToken');
    if (!t) {
      return;
    }
    setError('');
    setMessage('');
    setSending(true);
    const res = await fetch(`${API_URL}/campaigns/${id}/send-now`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
    });
    setSending(false);
    if (res.status === 401) {
      localStorage.removeItem('accessToken');
      router.replace('/login');
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? JSON.stringify(body) ?? `Error ${res.status}`);
      return;
    }
    const result = await res.json();
    setMessage(`Queued (job ${result.jobId}). Worker will send in the background.`);
    void load();
    void fetchSendStatus();
  };

  const saveSchedule = async () => {
    const t = localStorage.getItem('accessToken');
    if (!t || !scheduledLocal.trim()) {
      setError('Pick a date/time for the schedule.');
      return;
    }
    setError('');
    setMessage('');
    setScheduleSaving(true);
    const res = await fetch(`${API_URL}/campaigns/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${t}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scheduledAt: datetimeLocalToIso(scheduledLocal) }),
    });
    setScheduleSaving(false);
    if (res.status === 401) {
      localStorage.removeItem('accessToken');
      router.replace('/login');
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? JSON.stringify(body) ?? `Error ${res.status}`);
      return;
    }
    setMessage('Schedule saved. Worker must be running for the send to fire at the chosen time.');
    void load();
    void fetchSendStatus();
  };

  const cancelSchedule = async () => {
    const t = localStorage.getItem('accessToken');
    if (!t) {
      return;
    }
    setError('');
    setMessage('');
    setCancelScheduleLoading(true);
    const res = await fetch(`${API_URL}/campaigns/${id}/cancel-schedule`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
    });
    setCancelScheduleLoading(false);
    if (res.status === 401) {
      localStorage.removeItem('accessToken');
      router.replace('/login');
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? JSON.stringify(body) ?? `Error ${res.status}`);
      return;
    }
    setMessage('Schedule cancelled.');
    setScheduledLocal('');
    void load();
    void fetchSendStatus();
  };

  const resyncScheduleJob = async () => {
    const t = localStorage.getItem('accessToken');
    if (!t) {
      return;
    }
    setError('');
    setMessage('');
    setResyncScheduleLoading(true);
    const res = await fetch(`${API_URL}/campaigns/${id}/schedule`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${t}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    setResyncScheduleLoading(false);
    if (res.status === 401) {
      localStorage.removeItem('accessToken');
      router.replace('/login');
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.message ?? JSON.stringify(body) ?? `Error ${res.status}`);
      return;
    }
    setMessage('Delayed job (re)registered in BullMQ.');
    void load();
    void fetchSendStatus();
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
        <p>Campaign not found.</p>
        <Link href="/dashboard/campaigns">Back</Link>
      </main>
    );
  }

  const displayStats = sendStatus?.messageStats ?? row.messageStats;
  const displayStatus = sendStatus?.campaignStatus ?? row.status;
  const progress = sendStatus?.progress;
  const jobState = sendStatus?.jobState;

  return (
    <main className="container">
      <p>
        <Link href="/dashboard/campaigns">← Campaigns</Link>
      </p>
      <h1>{row.name}</h1>
      {error ? <p className="error">{typeof error === 'string' ? error : JSON.stringify(error)}</p> : null}
      {message ? <p style={{ color: '#15803d' }}>{message}</p> : null}

      <div className="card" style={{ maxWidth: 640 }}>
        <p>
          <strong>Status:</strong> {displayStatus}
          {displayStatus === 'DRAFT' && row.scheduledAt ? (
            <span
              style={{
                marginLeft: 8,
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#1d4ed8',
                background: '#dbeafe',
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              SCHEDULED
            </span>
          ) : null}
          {displayStatus === 'SENDING' ? (
            <span className="muted"> — job: {jobState ?? '…'}</span>
          ) : null}
        </p>
        {displayStatus === 'DRAFT' && (row.scheduledAt || sendStatus?.scheduledAt) ? (
          <p className="muted">
            Scheduled (UTC):{' '}
            {new Date((sendStatus?.scheduledAt ?? row.scheduledAt) as string).toISOString()}
            {sendStatus?.scheduleJobState ? ` — queue: ${sendStatus.scheduleJobState}` : ''}
          </p>
        ) : null}
        {progress && displayStatus === 'SENDING' ? (
          <p>
            <strong>Progress:</strong> {progress.processed} / {progress.total}
          </p>
        ) : null}
        <p>
          <strong>Template:</strong> {row.template.name} ({row.template.subject})
        </p>
        <p>
          <strong>Audience filter:</strong>{' '}
          <span className="muted">
            {row.query ? `search “${row.query}” ` : ''}
            {row.tag ? `tag “${row.tag}”` : !row.query ? 'none' : ''}
          </span>
        </p>
        <p>
          <strong>Subscribed contacts matching filter:</strong>{' '}
          {sendStatus?.subscribedAudienceCount ?? row.subscribedAudienceCount}
        </p>
        <p>
          <strong>Message events:</strong> queued {displayStats.queued}, sent {displayStats.sent}, failed{' '}
          {displayStats.failed}
        </p>
        {(row.sentAt || sendStatus?.sentAt) ? (
          <p className="muted">
            Sent at: {new Date((sendStatus?.sentAt ?? row.sentAt) as string).toLocaleString()}
          </p>
        ) : null}
        {row.sendJobId ? (
          <p className="muted">
            Last job id: {row.sendJobId}
          </p>
        ) : null}
      </div>

      <section style={{ marginTop: 24 }}>
        {displayStatus === 'DRAFT' ? (
          <div className="card" style={{ maxWidth: 640, marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}>Scheduled send</h2>
            <div className="field">
              <label htmlFor="schedLocal">Send at (local time)</label>
              <input
                id="schedLocal"
                onChange={(e) => setScheduledLocal(e.target.value)}
                type="datetime-local"
                value={scheduledLocal}
              />
            </div>
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              Stored and validated in UTC on the API (≥15s in the future). The campaign worker must be running.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                className="button secondary"
                disabled={scheduleSaving || !scheduledLocal.trim()}
                onClick={() => void saveSchedule()}
                type="button"
              >
                {scheduleSaving ? 'Saving…' : 'Save schedule'}
              </button>
              <button
                className="button secondary"
                disabled={resyncScheduleLoading || !row.scheduledAt}
                onClick={() => void resyncScheduleJob()}
                type="button"
                title="Re-add delayed job in Redis (same scheduledAt)"
              >
                {resyncScheduleLoading ? '…' : 'Re-queue job'}
              </button>
              <button
                className="button secondary"
                disabled={cancelScheduleLoading || !row.scheduledAt}
                onClick={() => void cancelSchedule()}
                type="button"
              >
                {cancelScheduleLoading ? '…' : 'Cancel schedule'}
              </button>
            </div>
          </div>
        ) : null}
        {displayStatus === 'DRAFT' ? (
          <button
            className="button"
            disabled={sending || row.subscribedAudienceCount === 0}
            onClick={() => void sendNow()}
            type="button"
          >
            {sending ? 'Queueing…' : 'Send now'}
          </button>
        ) : null}
        {displayStatus === 'SENDING' ? (
          <p className="muted">Sending in background… this page refreshes stats automatically.</p>
        ) : null}
        {displayStatus === 'SENT' ? (
          <p className="muted">Campaign finished (SENT).</p>
        ) : null}
        {displayStatus === 'FAILED' ? (
          <p className="error">Send failed — check API/worker logs. Create a new draft campaign to retry.</p>
        ) : null}
        {displayStatus === 'DRAFT' && row.subscribedAudienceCount === 0 ? (
          <p className="error">No subscribed contacts match — import contacts or adjust filters.</p>
        ) : null}
      </section>
    </main>
  );
}
