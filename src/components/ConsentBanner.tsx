import React, { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { consentsApi } from '../lib/firebase';

/**
 * Cookie / marketing consent banner (DPDP). Shows on first visit; the choice is
 * stored in localStorage so it doesn't reappear. When the visitor is signed in
 * we also persist a consents/{uid} record (read by the admin Compliance
 * register). Strictly-necessary cookies are always on — this gates the
 * analytics/marketing opt-in only.
 */

const STORAGE_KEY = 'tresor.consent.v1';
const POLICY_VERSION = '2026-06-02';

const ConsentBanner: React.FC = () => {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch { /* private mode — show it, harmless */ setVisible(true); }
  }, []);

  const record = (analytics: boolean, marketing: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics, marketing, policyVersion: POLICY_VERSION, at: new Date().toISOString() }));
    } catch { /* ignore */ }
    // Best-effort server record for signed-in users (no-op for guests / on failure).
    if (user) {
      consentsApi.setMine({ analytics, marketing, policyVersion: POLICY_VERSION }).catch(() => {});
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[140] lg:bottom-4 lg:inset-x-auto lg:right-4 lg:max-w-md">
      <div className="m-3 lg:m-0 bg-white border border-[color:var(--color-myntra-border)] rounded-md shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-full bg-[color:var(--color-myntra-bg-soft)] flex items-center justify-center shrink-0">
            <Cookie className="w-5 h-5 text-[color:var(--color-myntra-pink)]" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[color:var(--color-myntra-navy)]">Your privacy</p>
            <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mt-0.5 leading-relaxed">
              We use essential cookies to run the store, and optional analytics/marketing only with your consent.{' '}
              <button onClick={() => navigate({ name: 'policy', policy: 'cookies' })} className="underline font-semibold hover:text-[color:var(--color-myntra-pink)]">Cookie Policy</button>.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => record(true, true)} className="btn-primary !py-2 !px-3 text-[12px]">Accept all</button>
              <button onClick={() => record(false, false)} className="btn-outline !py-2 !px-3 text-[12px]">Essential only</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsentBanner;
