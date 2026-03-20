import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Free and Pro plans for MailForge — contacts, monthly sends, and sequences.',
};

export default function PricingPage() {
  return (
    <main className="container marketing-section">
      <h1>Pricing</h1>
      <p className="muted">
        Plans are enforced in the app (Free vs Pro). Upgrade anytime from{' '}
        <Link href="/dashboard/billing">Billing</Link> after you log in.
      </p>

      <div className="pricing-grid">
        <article className="pricing-card">
          <h2>Free</h2>
          <p className="pricing-price">$0</p>
          <ul className="muted">
            <li>Up to 500 contacts</li>
            <li>2,000 emails / month (UTC)</li>
            <li>1 active sequence</li>
          </ul>
          <Link href="/register" className="button">
            Start free
          </Link>
        </article>
        <article className="pricing-card pricing-card-pro">
          <h2>Pro</h2>
          <p className="pricing-price">Stripe</p>
          <ul className="muted">
            <li>Up to 50,000 contacts</li>
            <li>200,000 emails / month</li>
            <li>20 active sequences</li>
          </ul>
          <Link href="/register" className="button">
            Create account
          </Link>
          <p className="muted small-print">Subscribe from in-app Billing after signup.</p>
        </article>
      </div>
    </main>
  );
}
