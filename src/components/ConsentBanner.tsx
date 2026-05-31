/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { hasConsentDecision, setConsent, initAnalytics } from '../lib/analytics';

/**
 * Minimal, on-brand cookie/consent banner. Fixed to the bottom; never blocks
 * the page. Shown only until the visitor makes a choice (Accept / Decline),
 * persisted in localStorage. On Accept it loads the trackers immediately.
 */
const ConsentBanner: React.FC = () => {
  // Start hidden; reveal after mount once we know no decision was stored.
  // This avoids a flash on the server-less first paint and respects prior choice.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hasConsentDecision()) setOpen(true);
  }, []);

  const accept = () => {
    setConsent(true);
    initAnalytics();
    setOpen(false);
  };

  const decline = () => {
    setConsent(false);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 pointer-events-none"
    >
      <div className="pointer-events-auto max-w-[1100px] mx-auto rounded-xl border border-[color:var(--color-myntra-bg-soft)] bg-white shadow-2xl px-5 py-4 md:px-6 md:py-5 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <p className="text-[14px] font-semibold text-[color:var(--color-myntra-navy)]">
            We value your privacy
          </p>
          <p className="text-[12px] md:text-[13px] text-[color:var(--color-myntra-ink-mute)] mt-1 leading-relaxed">
            We use cookies to understand how our weaves are discovered and to improve your
            experience. You can accept analytics &amp; marketing cookies, or decline and keep
            browsing with essential cookies only.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={decline}
            className="btn-outline whitespace-nowrap"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="btn-primary whitespace-nowrap"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsentBanner;
