'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useId, useState } from 'react';

type Item = { q: string; a: ReactNode };

const ITEMS: Item[] = [
  {
    q: 'Is there a free plan?',
    a: (
      <>
        Yes — generous free limits for contacts, monthly sends, and active sequences. See{' '}
        <Link href="/pricing">Pricing</Link>.
      </>
    ),
  },
  {
    q: 'Do I need to verify my email?',
    a: 'Yes — we require email verification before importing contacts or sending campaigns to reduce abuse.',
  },
  {
    q: 'Can I use my own SMTP?',
    a: 'Configure SMTP in the API for real delivery; console mode is fine for local development.',
  },
];

export function MarketingFaq() {
  const baseId = useId();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="faq">
      {ITEMS.map((item, i) => {
        const isOpen = open === i;
        const panelId = `${baseId}-panel-${i}`;
        const headerId = `${baseId}-header-${i}`;
        return (
          <div key={item.q} className={`faq-item ${isOpen ? 'is-open' : ''}`}>
            <h3 className="faq-question">
              <button
                type="button"
                id={headerId}
                className="faq-trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span>{item.q}</span>
                <span className="faq-chevron" aria-hidden />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={headerId}
              className="faq-panel"
              hidden={!isOpen}
            >
              <p className="faq-answer muted">{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
