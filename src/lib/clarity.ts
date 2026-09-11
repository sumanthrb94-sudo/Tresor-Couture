/**
 * Microsoft Clarity — heatmaps + session recordings. Free, no quota.
 *
 * Gated twice, same discipline as GA4 in ./analytics.ts:
 *  - VITE_CLARITY_PROJECT_ID unset → no-op (nothing ships to the page).
 *  - No analytics consent (DPDP banner) → no-op. The script is injected only
 *    AFTER opt-in; it is not "loaded but muted".
 *
 * Localhost and the emulator preview never load it — recordings of test
 * sessions would pollute the real data.
 */

// Same guarded access as business.ts — the project has no vite-env.d.ts, so
// import.meta.env is untyped here.
const env = typeof (import.meta as any).env !== 'undefined' ? (import.meta as any).env : {};

/**
 * The atelier's Clarity project.
 *
 * Committed on purpose: a Clarity project id is NOT a credential. Microsoft's
 * own install snippet puts this exact string into the page source, so it is
 * already public to anyone who opens the network tab — the repository being
 * public changes nothing. Hardcoding it means Clarity works without the build
 * depending on a dashboard setting nobody remembers to check, which is how it
 * sat silently disabled for months.
 *
 * VITE_CLARITY_PROJECT_ID still wins when set, so a second property (a staging
 * project, a replacement account) needs no code change.
 */
const DEFAULT_PROJECT_ID = 'ygmnwxzdl0';
const PROJECT_ID = String(env.VITE_CLARITY_PROJECT_ID || DEFAULT_PROJECT_ID).trim();

let initialised = false;

function enabledHere(): boolean {
  if (!PROJECT_ID) return false;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return false;
  // Preview deployments are us testing the site, not customers shopping it.
  // Before the id was hardcoded this could not happen, because previews had no
  // id either; now it would quietly file our own QA sessions as shopper
  // behaviour in the same recordings the studio reads.
  if (host.endsWith('.vercel.app')) return false;
  return true;
}

export function initClarity(consent = false): void {
  if (initialised || !consent || !enabledHere()) return;
  initialised = true;

  // Official snippet, minus the IIFE wrapper. Clarity queues calls made
  // before the script arrives.
  interface ClarityWindow extends Window {
    clarity?: { (...args: unknown[]): void; q?: unknown[] };
  }
  const w = window as ClarityWindow;
  w.clarity =
    w.clarity ||
    function (...args: unknown[]) {
      (w.clarity!.q = w.clarity!.q || []).push(args);
    };
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.clarity.ms/tag/${encodeURIComponent(PROJECT_ID)}`;
  document.head.appendChild(s);
}
