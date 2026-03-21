import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingFaq } from '@/components/marketing-faq';

export const metadata: Metadata = {
  title: 'Home',
};

const FEATURES = [
  {
    title: 'Workspaces',
    body: 'Isolate brands or clients with JWT-scoped data and clear boundaries.',
  },
  {
    title: 'Campaigns',
    body: 'Filter audiences, schedule sends, and track delivery with message events.',
  },
  {
    title: 'Sequences',
    body: 'Multi-step automations with enrollments and background workers.',
  },
  {
    title: 'Compliance',
    body: 'Unsubscribe links and inbound webhook plumbing built into the flow.',
  },
  {
    title: 'Billing',
    body: 'Stripe-ready plans when you outgrow the generous free tier.',
  },
  {
    title: 'Operator-friendly',
    body: 'Templates, CSV import, and dashboards tuned for day-to-day sending.',
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="marketing-hero container">
        <p className="marketing-eyebrow">Email platform for growing teams</p>
        <h1>Launch campaigns &amp; sequences without the chaos</h1>
        <p className="marketing-lead">
          Workspace-scoped contacts, reusable templates, scheduled sends, and automation sequences — with
          billing-ready plans when you scale.
        </p>
        <div className="marketing-hero-actions">
          <Link href="/register" className="button">
            Start free
          </Link>
          <Link href="/pricing" className="button secondary">
            View pricing
          </Link>
        </div>
      </section>

      <section className="container marketing-section">
        <h2>What you get</h2>
        <p className="muted" style={{ maxWidth: '50ch', marginTop: 0 }}>
          Everything you need to run permission-based email from one workspace — without juggling spreadsheets
          and one-off scripts.
        </p>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="feature-card">
              <div className="feature-card-icon" aria-hidden />
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container marketing-section">
        <div className="marketing-trust">
          <h2>Built for operators</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            Opinionated MVP stack: Next.js, NestJS, Prisma, and Redis queues — ready to extend with your ESP
            and policies.
          </p>
          <ul className="stack-list" style={{ marginTop: 'var(--space-4)' }}>
            <li>Next.js App Router frontend</li>
            <li>NestJS API with JWT auth</li>
            <li>PostgreSQL + Prisma ORM</li>
            <li>Redis / BullMQ for sends &amp; sequences</li>
          </ul>
        </div>
      </section>

      <section className="container marketing-section">
        <h2>FAQ</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Quick answers before you create an account.
        </p>
        <MarketingFaq />
      </section>
    </>
  );
}
