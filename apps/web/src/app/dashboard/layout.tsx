import type { ReactNode } from 'react';
import { BillingPastDueBanner } from '../../components/billing-past-due-banner';
import { DashboardShell } from '../../components/dashboard-shell';
import { EmailVerificationBanner } from '../../components/email-verification-banner';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <EmailVerificationBanner />
      <BillingPastDueBanner />
      <DashboardShell>{children}</DashboardShell>
    </>
  );
}
