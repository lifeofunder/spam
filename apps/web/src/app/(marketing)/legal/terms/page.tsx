import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <main className="container legal-page">
      <h1>Terms of Service</h1>
      <p className="muted">Last updated: {new Date().toISOString().slice(0, 10)}</p>

      <section>
        <h2>1. Agreement</h2>
        <p>
          These Terms of Service (&quot;Terms&quot;) are a placeholder for your production legal agreement.
          Replace this document with counsel-reviewed terms before public launch.
        </p>
      </section>

      <section>
        <h2>2. Service</h2>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore
          et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
        </p>
      </section>

      <section>
        <h2>3. Accounts</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials. You agree to
          provide accurate information and to keep your email address verified for continued use of sending
          features.
        </p>
      </section>

      <section>
        <h2>4. Acceptable use</h2>
        <p>
          No spam, phishing, or illegal content. You must comply with applicable anti-spam laws (e.g. CAN-SPAM,
          GDPR where relevant) and obtain consent where required.
        </p>
      </section>

      <section>
        <h2>5. Limitation of liability</h2>
        <p>Placeholder limitation of liability clause — replace with jurisdiction-appropriate language.</p>
      </section>
    </main>
  );
}
