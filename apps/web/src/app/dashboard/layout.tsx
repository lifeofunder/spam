import type { ReactNode } from 'react';
import { BillingPastDueBanner } from '../../components/billing-past-due-banner';
import { EmailVerificationBanner } from '../../components/email-verification-banner';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <EmailVerificationBanner />
      <BillingPastDueBanner />
      {children}
    </>
  );
}
