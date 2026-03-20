import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="container legal-page">
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: {new Date().toISOString().slice(0, 10)}</p>

      <section>
        <h2>1. Introduction</h2>
        <p>
          This Privacy Policy is a template. Replace it with a policy appropriate for your jurisdictions and
          data practices before going live.
        </p>
      </section>

      <section>
        <h2>2. Data we process</h2>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. We may process account data (name, email),
          workspace content you upload (contacts, templates), and technical logs required to operate the
          service.
        </p>
      </section>

      <section>
        <h2>3. Purposes</h2>
        <p>To provide the email platform, authenticate users, send transactional emails, and improve security.</p>
      </section>

      <section>
        <h2>4. Retention</h2>
        <p>Placeholder retention description — define periods for marketing data, logs, and backups.</p>
      </section>

      <section>
        <h2>5. Your rights</h2>
        <p>
          Depending on your region, you may have rights to access, rectify, or delete personal data. Contact
          information: <em>legal@example.com</em> (replace).
        </p>
      </section>
    </main>
  );
}
