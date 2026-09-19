/**
 * Client-side Cashfree integration.
 *
 * Real-vs-demo is gated on `paymentsConfigured`, derived from the PUBLIC env
 * var VITE_CASHFREE_MODE. When that is absent the app keeps using the demo
 * checkout (the setTimeout flow in PaymentModal) so builds and previews work
 * with zero payment configuration.
 *
 * Authority lives on the server:
 *   1. createPaymentOrder() asks /api/payments/create-order to recompute the
 *      amount from Firestore and open a Cashfree order for it.
 *   2. openCashfreeCheckout() shows Cashfree's modal for that session.
 *   3. verifyPayment() posts the order id + cart to /api/payments/verify,
 *      which ASKS CASHFREE what happened, re-prices, decrements stock and
 *      writes the order.
 *
 * The browser never decides the amount, never writes the paid order, and —
 * unlike a signature-handshake gateway — never even carries the claim that the
 * payment succeeded. It reports which order it was working on; the server asks
 * the processor. There is no success token here to forge.
 */

import { apiPost } from './csrf';
import { auth } from './firebase';

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

/**
 * 'production' or 'sandbox' — which Cashfree the browser SDK should talk to.
 *
 * Public and safe: it is one word. There is no public Cashfree key, because the
 * browser only ever receives a single-use payment_session_id minted by our
 * server for an amount Cashfree already holds.
 */
export const cashfreeMode: string | undefined = env.VITE_CASHFREE_MODE?.trim() || undefined;

/** True when real payments are configured; otherwise the UI uses demo mode. */
export const paymentsConfigured: boolean = Boolean(cashfreeMode);

export interface CartLine {
  fabricId: string;
  quantity: number;
  color?: string;
}

export interface OrderContext {
  items: CartLine[];
  couponCode?: string;
  paymentMethod: 'card' | 'upi' | 'cod';
  shippingAddress: Record<string, unknown>;
  userId?: string;
}

export interface CreatedOrder {
  /** Our own order reference, and the key /verify looks the payment up by. */
  orderId: string;
  /** Rupees. Informational — the authoritative total lives with Cashfree. */
  amount: number;
  currency: string;
  /** Single-use, minted server-side, bound to the amount. */
  paymentSessionId?: string;
  breakdown?: {
    subtotal: number;
    couponCode: string | null;
    couponDiscount: number;
    tax: number;
    shipping: number;
    codSurcharge: number;
    total: number;
  };
}

/** Thrown when the server reports payments aren't configured (→ demo fallback). */
export class PaymentsNotConfiguredError extends Error {
  constructor() {
    super('payments_not_configured');
    this.name = 'PaymentsNotConfiguredError';
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  return token ? { authorization: `Bearer ${token}` } : {};
}

/** Ask the server to price the cart and open a Cashfree order. */
export async function createPaymentOrder(input: {
  items: CartLine[];
  couponCode?: string;
  paymentMethod: 'card' | 'upi' | 'cod';
  /** Cashfree requires a 10-digit mobile on the order and rejects it without one. */
  customer?: { name?: string; email?: string; phone?: string };
}): Promise<CreatedOrder> {
  const res = await apiPost('/api/payments/create-order', input, await authHeader());
  if (res.status === 503) throw new PaymentsNotConfiguredError();
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'create_order_failed');
  }
  return data as unknown as CreatedOrder;
}

/* ------------------------------------------------------------- Cashfree SDK */

const CASHFREE_SRC = 'https://sdk.cashfree.com/js/v3/cashfree.js';
let cashfreeScript: Promise<void> | null = null;

interface CashfreeInstance {
  checkout(opts: { paymentSessionId: string; redirectTarget?: string }): Promise<{
    error?: { message?: string };
    paymentDetails?: { paymentMessage?: string };
    redirect?: boolean;
  }>;
}
declare global {
  interface Window {
    Cashfree?: (opts: { mode: string }) => CashfreeInstance;
  }
}

/** Lazily inject the Cashfree SDK exactly once. */
export function loadCashfreeScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no_window'));
  if (window.Cashfree) return Promise.resolve();
  if (cashfreeScript) return cashfreeScript;
  cashfreeScript = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CASHFREE_SRC}"]`);
    const fail = () => {
      cashfreeScript = null;
      reject(new Error('cashfree_script_failed'));
    };
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', fail);
      if (window.Cashfree) resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = CASHFREE_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = fail;
    document.body.appendChild(s);
  });
  return cashfreeScript;
}

/**
 * Open the Cashfree modal and wait for it to close.
 *
 * Resolving here means "the shopper finished with the modal", NOT "the payment
 * succeeded" — the SDK reports what the page saw, and the page is not a
 * trustworthy witness to a payment. The server decides, by asking Cashfree
 * directly in /api/payments/verify. So this deliberately returns nothing about
 * the outcome beyond "carry on and go ask".
 */
export async function openCashfreeCheckout(created: CreatedOrder): Promise<void> {
  if (!window.Cashfree) throw new Error('cashfree_unavailable');
  if (!created.paymentSessionId) throw new Error('cashfree_no_session');
  const cashfree = window.Cashfree({ mode: cashfreeMode === 'production' ? 'production' : 'sandbox' });
  const result = await cashfree.checkout({
    paymentSessionId: created.paymentSessionId,
    redirectTarget: '_modal',
  });
  // A dismissed modal reports an error; treat it as a cancellation rather than
  // a failure so the UI does not accuse the shopper of a problem they did not
  // have. Either way the server is the one that decides whether money moved.
  if (result?.error) {
    throw new Error('payment_cancelled');
  }
}

/** Verify the payment server-side; the server writes the paid order + stock. */
export async function verifyPayment(args: {
  /** Our own order id. The server asks Cashfree what became of it. */
  cashfreeOrderId: string;
  order: OrderContext;
}): Promise<{ orderId: string }> {
  const res = await apiPost('/api/payments/verify', {
    cashfree_order_id: args.cashfreeOrderId,
    order: args.order,
  }, await authHeader());
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !data.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'verify_failed');
  }
  return { orderId: String(data.orderId) };
}

/**
 * Full real-payment flow: create order → load SDK → open modal → verify.
 * Returns the Firestore order id written by the server.
 */
export async function runCardPayment(input: {
  items: CartLine[];
  couponCode?: string;
  paymentMethod: 'card' | 'upi' | 'cod';
  shippingAddress: Record<string, unknown>;
  userId?: string;
  prefill?: { name?: string; email?: string; contact?: string };
}): Promise<{ orderId: string }> {
  const created = await createPaymentOrder({
    items: input.items,
    couponCode: input.couponCode,
    paymentMethod: input.paymentMethod,
    customer: {
      name: input.prefill?.name,
      email: input.prefill?.email,
      phone: input.prefill?.contact,
    },
  });

  await loadCashfreeScript();
  await openCashfreeCheckout(created);

  return verifyPayment({
    cashfreeOrderId: created.orderId,
    order: {
      items: input.items,
      couponCode: input.couponCode,
      paymentMethod: input.paymentMethod,
      shippingAddress: input.shippingAddress,
      userId: input.userId,
    },
  });
}
