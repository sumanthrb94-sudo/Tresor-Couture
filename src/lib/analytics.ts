// Lightweight, privacy-conscious analytics wrapper.
//
// No-ops entirely unless VITE_GA4_ID is set (so dev/test/preview stay clean and
// no script loads). When configured, it lazy-injects the GA4 gtag snippet and
// exposes track() for the standard ecommerce funnel. Keeping this behind one
// env var means the business can turn measurement on per-environment in Vercel
// without code changes — and we were previously launching blind.

type Params = Record<string, unknown>;

// Read defensively — this project's tsconfig doesn't pull in vite/client types.
const GA_ID: string | undefined =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_GA4_ID;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let ready = false;

export function initAnalytics(): void {
  if (ready || !GA_ID || typeof window === 'undefined') return;
  ready = true;

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  // SPA: we send page_view manually on route change, not automatically.
  window.gtag('config', GA_ID, { send_page_view: false });
}

/** Generic event. Safe to call anywhere; no-ops when analytics is off. */
export function track(event: string, params: Params = {}): void {
  if (!GA_ID || typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', event, params);
}

/** Fire a page_view for the current SPA route. */
export function trackPageView(path: string, title?: string): void {
  track('page_view', { page_path: path, page_title: title ?? document.title, page_location: location.href });
}

// Convenience funnel helpers (GA4 recommended ecommerce event names).
export const analytics = {
  viewItem: (id: string, name: string, price: number) =>
    track('view_item', { currency: 'INR', value: price, items: [{ item_id: id, item_name: name, price }] }),
  addToCart: (id: string, name: string, price: number, meters: number) =>
    track('add_to_cart', { currency: 'INR', value: price * meters, items: [{ item_id: id, item_name: name, price, quantity: meters }] }),
  beginCheckout: (value: number, count: number) =>
    track('begin_checkout', { currency: 'INR', value, item_count: count }),
  addPaymentInfo: (value: number, method: string) =>
    track('add_payment_info', { currency: 'INR', value, payment_type: method }),
  purchase: (orderId: string, value: number) =>
    track('purchase', { transaction_id: orderId, currency: 'INR', value }),
  generateLead: (params: Params) => track('generate_lead', params),
};
