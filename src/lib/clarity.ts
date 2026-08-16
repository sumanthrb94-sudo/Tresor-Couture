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
const PROJECT_ID = String(env.VITE_CLARITY_PROJECT_ID || '').trim();

let initialised = false;

function enabledHere(): boolean {
  if (!PROJECT_ID) return false;
  const host = window.location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
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
