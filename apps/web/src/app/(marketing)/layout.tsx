import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

const siteUrl =
  (typeof process.env.NEXT_PUBLIC_WEB_URL === 'string' && process.env.NEXT_PUBLIC_WEB_URL) ||
  'http://localhost:3000';

const siteName = 'MailForge';
const description =
  'Send campaigns and automations with a workspace-first email platform — templates, sequences, and deliverability-friendly sending.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} — Email campaigns & automations`,
    template: `%s | ${siteName}`,
  },
  description,
  openGraph: {
    title: `${siteName} — Email campaigns & automations`,
    description,
    type: 'website',
    siteName,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteName} — Email campaigns & automations`,
    description,
  },
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-root">
      <header className="marketing-header">
        <div className="container marketing-header-inner">
          <Link href="/" className="marketing-logo">
            {siteName}
          </Link>
          <nav className="marketing-nav">
            <Link href="/pricing">Pricing</Link>
            <Link href="/login">Log in</Link>
            <Link href="/register" className="button marketing-cta">
              Start free
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="marketing-footer">
        <div className="container marketing-footer-inner">
          <p className="muted">
            © {new Date().getFullYear()} {siteName}
          </p>
          <nav className="marketing-footer-links">
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/privacy">Privacy</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
