/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Provider-agnostic, consent-gated, env-gated analytics layer.
 *
 * Nothing loads or fires unless BOTH conditions hold:
 *   1. The relevant measurement ID is configured at build time
 *      (VITE_GA4_MEASUREMENT_ID and/or VITE_META_PIXEL_ID).
 *   2. The visitor has granted consent (persisted in localStorage).
 *
 * With no env vars set this module is a pure no-op — every public function
 * runs without throwing, simply doing nothing. That keeps the app launchable
 * before the CEO has created the GA4 property / Meta Pixel.
 */

// Vite injects env vars into import.meta.env at build time. Cast defensively so
// this compiles without a vite-env.d.ts and never throws if `env` is absent.
const env =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

const GA4_ID = (env.VITE_GA4_MEASUREMENT_ID || '').trim();
const META_PIXEL_ID = (env.VITE_META_PIXEL_ID || '').trim();

export const CONSENT_STORAGE_KEY = 'tc_consent_v1';

// --- Window globals injected by the trackers ---------------------------------
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
    _fbq?: unknown;
  }
}

// Module-level guards so repeated calls never inject scripts twice.
let ga4Loaded = false;
let pixelLoaded = false;
let initialised = false;

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined';

// --- Consent -----------------------------------------------------------------

/** True only if the visitor has explicitly accepted. */
export const hasConsent = (): boolean => {
  if (!isBrowser()) return false;
  try {
    return window.localStorage.getItem(CONSENT_STORAGE_KEY) === 'granted';
  } catch {
    return false;
  }
};

/** True if the visitor has made any choice (accept OR decline). */
export const hasConsentDecision = (): boolean => {
  if (!isBrowser()) return false;
  try {
    const v = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return v === 'granted' || v === 'denied';
  } catch {
    return false;
  }
};

/** Persist the visitor's choice. Pass true for Accept, false for Decline. */
export const setConsent = (granted: boolean): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, granted ? 'granted' : 'denied');
  } catch {
    /* storage unavailable (private mode / quota) — fail silent */
  }
};

// --- Script injection --------------------------------------------------------

const injectGA4 = (): void => {
  if (ga4Loaded || !GA4_ID || !isBrowser()) return;
  ga4Loaded = true;

  window.dataLayer = window.dataLayer || [];
  // gtag pushes raw arguments onto the dataLayer.
  const gtag: (...args: unknown[]) => void = function (...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag = gtag;
  gtag('js', new Date());
  // SPA: we fire page_view manually on each route change instead.
  gtag('config', GA4_ID, { send_page_view: false });

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`;
  document.head.appendChild(s);
};

const injectMetaPixel = (): void => {
  if (pixelLoaded || !META_PIXEL_ID || !isBrowser()) return;
  pixelLoaded = true;

  /* Standard Meta Pixel bootstrap (typed/linted variant of the official snippet). */
  const w = window;
  if (!w.fbq) {
    const fbq = function (...args: unknown[]) {
      const f = fbq as unknown as { callMethod?: (...a: unknown[]) => void; queue: unknown[] };
      if (f.callMethod) f.callMethod(...args);
      else f.queue.push(args);
    } as Window['fbq'];
    (fbq as unknown as { queue: unknown[] }).queue = [];
    (fbq as unknown as { loaded: boolean }).loaded = true;
    (fbq as unknown as { version: string }).version = '2.0';
    w.fbq = fbq;
    w._fbq = w._fbq || fbq;

    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
  }

  w.fbq!('init', META_PIXEL_ID);
  w.fbq!('track', 'PageView');
};

/**
 * Load the configured trackers — but only if consent has been granted.
 * Idempotent: safe to call on every mount and again right after Accept.
 */
export const initAnalytics = (): void => {
  if (!isBrowser() || !hasConsent()) return;
  if (initialised) {
    // Already initialised in this page load; nothing more to do.
    return;
  }
  initialised = true;
  injectGA4();
  injectMetaPixel();
};

// --- Safe forwarders ---------------------------------------------------------

const ga4 = (...args: unknown[]): void => {
  if (GA4_ID && typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag(...args);
  }
};

const pixel = (event: string, params?: Record<string, unknown>): void => {
  if (META_PIXEL_ID && typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', event, params);
  }
};

// --- Public events -----------------------------------------------------------

export const trackPageView = (path: string): void => {
  if (!hasConsent()) return;
  ga4('event', 'page_view', { page_path: path, page_location: typeof window !== 'undefined' ? window.location.href : path });
  pixel('PageView');
};

export interface ItemPayload {
  id?: string;
  name?: string;
  price?: number;
  currency?: string;
  quantity?: number;
  category?: string;
}

const itemsForGa4 = (item: ItemPayload) => [{
  item_id: item.id,
  item_name: item.name,
  item_category: item.category,
  price: item.price,
  quantity: item.quantity ?? 1,
}];

export const trackViewItem = (item: ItemPayload): void => {
  if (!hasConsent()) return;
  const currency = item.currency || 'INR';
  ga4('event', 'view_item', { currency, value: item.price, items: itemsForGa4(item) });
  pixel('ViewContent', {
    content_ids: item.id ? [item.id] : undefined,
    content_name: item.name,
    content_type: 'product',
    value: item.price,
    currency,
  });
};

export const trackAddToCart = (item: ItemPayload): void => {
  if (!hasConsent()) return;
  const currency = item.currency || 'INR';
  const qty = item.quantity ?? 1;
  ga4('event', 'add_to_cart', { currency, value: (item.price ?? 0) * qty, items: itemsForGa4(item) });
  pixel('AddToCart', {
    content_ids: item.id ? [item.id] : undefined,
    content_name: item.name,
    content_type: 'product',
    value: (item.price ?? 0) * qty,
    currency,
  });
};

export interface CheckoutPayload {
  value?: number;
  currency?: string;
  items?: ItemPayload[];
}

export const trackBeginCheckout = (payload: CheckoutPayload = {}): void => {
  if (!hasConsent()) return;
  const currency = payload.currency || 'INR';
  ga4('event', 'begin_checkout', {
    currency,
    value: payload.value,
    items: (payload.items ?? []).map(i => itemsForGa4(i)[0]),
  });
  pixel('InitiateCheckout', {
    content_ids: (payload.items ?? []).map(i => i.id).filter(Boolean),
    content_type: 'product',
    value: payload.value,
    currency,
    num_items: (payload.items ?? []).reduce((n, i) => n + (i.quantity ?? 1), 0) || undefined,
  });
};

export interface PurchasePayload {
  orderId?: string;
  value?: number;
  currency?: string;
  items?: ItemPayload[];
}

export const trackPurchase = (payload: PurchasePayload = {}): void => {
  if (!hasConsent()) return;
  const currency = payload.currency || 'INR';
  ga4('event', 'purchase', {
    transaction_id: payload.orderId,
    currency,
    value: payload.value,
    items: (payload.items ?? []).map(i => itemsForGa4(i)[0]),
  });
  pixel('Purchase', {
    content_ids: (payload.items ?? []).map(i => i.id).filter(Boolean),
    content_type: 'product',
    value: payload.value,
    currency,
  });
};

/** Newsletter / WhatsApp opt-in. */
export const trackLead = (params: { source?: string } = {}): void => {
  if (!hasConsent()) return;
  ga4('event', 'generate_lead', { method: params.source || 'newsletter' });
  pixel('Lead', { content_name: params.source || 'newsletter' });
};
