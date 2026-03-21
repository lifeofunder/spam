'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useState } from 'react';

const siteName = 'MailForge';

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, close]);

  return (
    <header className="marketing-header">
      <div className="container marketing-header-inner">
        <Link href="/" className="marketing-logo" onClick={close}>
          {siteName}
        </Link>

        <button
          type="button"
          className="marketing-burger"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="marketing-burger-bar" aria-hidden />
          <span className="marketing-burger-bar" aria-hidden />
          <span className="marketing-burger-bar" aria-hidden />
        </button>

        <nav className="marketing-nav marketing-nav--desktop" aria-label="Main">
          <Link href="/pricing" className="marketing-nav-link">
            Pricing
          </Link>
          <Link href="/login" className="marketing-nav-link">
            Log in
          </Link>
          <Link href="/register" className="button marketing-cta">
            Start free
          </Link>
        </nav>
      </div>

      <div
        id={menuId}
        className={`marketing-drawer-backdrop ${open ? 'is-open' : ''}`}
        aria-hidden={!open}
        onClick={close}
      />
      <nav
        id={`${menuId}-panel`}
        className={`marketing-drawer ${open ? 'is-open' : ''}`}
        aria-label="Mobile main"
        aria-hidden={!open}
      >
        <Link href="/pricing" className="marketing-drawer-link" onClick={close}>
          Pricing
        </Link>
        <Link href="/login" className="marketing-drawer-link" onClick={close}>
          Log in
        </Link>
        <Link href="/register" className="button marketing-cta marketing-drawer-cta" onClick={close}>
          Start free
        </Link>
      </nav>
    </header>
  );
}
