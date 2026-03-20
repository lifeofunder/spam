import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Home',
};

export default function LandingPage() {
  return (
    <>
      <section className="marketing-hero container">
        <p className="marketing-eyebrow">Email SaaS for growing teams</p>
        <h1>Launch campaigns & sequences without the chaos</h1>
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
        <ul className="marketing-features">
          <li>
            <strong>Workspaces</strong> — isolate brands or clients with JWT-scoped data.
          </li>
          <li>
            <strong>Campaigns</strong> — filter audiences, schedule sends, track message events.
          </li>
          <li>
            <strong>Sequences</strong> — multi-step automations with enrollments and workers.
          </li>
          <li>
            <strong>Compliance hooks</strong> — unsubscribe links and inbound webhook plumbing.
          </li>
          <li>
            <strong>Stripe billing</strong> — upgrade when you outgrow the free tier.
          </li>
        </ul>
      </section>

      <section className="container marketing-section marketing-trust">
        <h2>Built for operators</h2>
        <p className="muted">
          Opinionated MVP stack: Next.js + NestJS + Prisma + Redis queues — ready to extend with your ESP
          and policies.
        </p>
      </section>

      <section className="container marketing-section">
        <h2>FAQ</h2>
        <dl className="marketing-faq">
          <dt>Is there a free plan?</dt>
          <dd className="muted">
            Yes — generous free limits for contacts, monthly sends, and active sequences. See{' '}
            <Link href="/pricing">Pricing</Link>.
          </dd>
          <dt>Do I need to verify my email?</dt>
          <dd className="muted">
            Yes — we require email verification before importing contacts or sending campaigns to reduce abuse.
          </dd>
          <dt>Can I use my own SMTP?</dt>
          <dd className="muted">Configure SMTP in the API for real delivery; console mode is fine for local dev.</dd>
        </dl>
      </section>
    </>
  );
}
