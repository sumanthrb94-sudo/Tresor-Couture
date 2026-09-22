// Analytics via the Firebase Analytics SDK (GA4 measurement id lives in the
// Firebase config — G-RT2P8RC6RN). This is the idiomatic fit for our stack:
// Firebase loads gtag and ties events to the project automatically.
//
// We deliberately DON'T initialise on localhost, so local dev / e2e runs don't
// pollute the production GA4 property. On the real domains (preview + prod) it
// turns on automatically once Analytics reports it's supported.

// Imported dynamically, for the same reason as Sentry: this SDK only does
// anything AFTER the visitor accepts cookies, and never on localhost, yet a
// static import put it in the first chunk every visitor downloads and parses.
// `track()` already no-ops until `instance` exists, so deferring the load
// changes nothing about when events start flowing — consent is still the gate.
import type { Analytics } from 'firebase/analytics';
import { app } from './firebase';

type Params = Record<string, unknown>;

let instance: Analytics | null = null;
let initialised = false;
/** Held from the dynamic import so `track` stays synchronous for callers. */
let logEventFn: typeof import('firebase/analytics').logEvent | null = null;

const enabledHere = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  // Skip localhost / LAN IPs (dev + automated tests).
  return host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('192.168.') && !host.startsWith('169.254.');
};

export function initAnalytics(consent = false): void {
  if (initialised || !enabledHere() || !consent) return;
  initialised = true;
  void import('firebase/analytics')
    .then(async ({ getAnalytics, isSupported, logEvent }) => {
      if (!(await isSupported())) return;
      instance = getAnalytics(app);
      logEventFn = logEvent;
    })
    .catch(() => { /* analytics unavailable (e.g. blocked) — stay silent */ });
}

/** Generic GA4 event. Safe to call anywhere; no-ops until analytics is ready. */
export function track(event: string, params: Params = {}): void {
  if (!instance || !logEventFn) return;
  logEventFn(instance, event, params);
}

/** SPA page_view for the current route. */
export function trackPageView(path: string, title?: string): void {
  track('page_view', {
    page_path: path,
    page_title: title ?? (typeof document !== 'undefined' ? document.title : undefined),
    page_location: typeof location !== 'undefined' ? location.href : undefined,
  });
}

// GA4 recommended ecommerce events.
export const analytics = {
  viewItem: (id: string, name: string, price: number) =>
    track('view_item', { currency: 'INR', value: price, items: [{ item_id: id, item_name: name, price }] }),
  addToCart: (id: string, name: string, price: number, quantity: number) =>
    track('add_to_cart', { currency: 'INR', value: price * quantity, items: [{ item_id: id, item_name: name, price, quantity }] }),
  beginCheckout: (value: number, count: number) =>
    track('begin_checkout', { currency: 'INR', value, item_count: count }),
  addPaymentInfo: (value: number, method: string) =>
    track('add_payment_info', { currency: 'INR', value, payment_type: method }),
  purchase: (orderId: string, value: number) =>
    track('purchase', { transaction_id: orderId, currency: 'INR', value }),
  generateLead: (params: Params) => track('generate_lead', params),
};
