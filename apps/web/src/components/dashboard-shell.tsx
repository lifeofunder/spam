'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const NAV = [
  { href: '/dashboard', label: 'Overview', short: 'Home' },
  { href: '/dashboard/contacts', label: 'Contacts', short: 'Contacts' },
  { href: '/dashboard/templates', label: 'Templates', short: 'Templates' },
  { href: '/dashboard/campaigns', label: 'Campaigns', short: 'Campaigns' },
  { href: '/dashboard/sequences', label: 'Sequences', short: 'Flows' },
  { href: '/dashboard/billing', label: 'Billing', short: 'Billing' },
] as const;

function navActive(pathname: string | null, href: string) {
  if (!pathname) {
    return false;
  }
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar" aria-label="Workspace navigation">
        <div className="dashboard-sidebar-brand">
          <Link href="/dashboard" className="dashboard-brand-link">
            MailForge
          </Link>
        </div>
        <nav className="dashboard-sidebar-nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`dashboard-nav-item ${navActive(pathname, item.href) ? 'is-active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="dashboard-main">
        <div className="dashboard-main-inner container container--app">{children}</div>
      </div>

      <nav className="dashboard-nav-mobile" aria-label="Workspace">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`dashboard-nav-pill ${navActive(pathname, item.href) ? 'is-active' : ''}`}
          >
            {item.short}
          </Link>
        ))}
      </nav>
    </div>
  );
}
