/**
 * Client-side Razorpay integration.
 *
 * Real-vs-demo is gated on `paymentsConfigured`, derived from the PUBLIC env
 * var VITE_RAZORPAY_KEY_ID. When that is absent the app keeps using the demo
 * checkout (the setTimeout flow in PaymentModal) so builds and previews work
 * with zero payment configuration.
 *
 * Authority lives on the server:
 *   1. createPaymentOrder() asks /api/payments/create-order to recompute the
 *      amount from Firestore and create a Razorpay order.
 *   2. openRazorpayCheckout() opens Razorpay's hosted modal.
 *   3. On success we POST the signature + cart to /api/payments/verify, which
 *      re-verifies, re-prices, decrements stock and writes the order.
 *
 * The browser never decides the amount and never writes the paid order.
 */

import { apiPost } from './csrf';

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

/** PUBLIC key id. Safe to expose; the secret stays server-side. */
export const razorpayKeyId: string | undefined = env.VITE_RAZORPAY_KEY_ID?.trim() || undefined;

/** True when real payments are configured; otherwise the UI uses demo mode. */
export const paymentsConfigured: boolean = Boolean(razorpayKeyId);

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
  orderId: string;
  amount: number;
  currency: string;
  razorpayKeyId: string;
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

/** Ask the server to price the cart and open a Razorpay order. */
export async function createPaymentOrder(input: {
  items: CartLine[];
  couponCode?: string;
  paymentMethod: 'card' | 'upi' | 'cod';
}): Promise<CreatedOrder> {
  const res = await apiPost('/api/payments/create-order', input);
  if (res.status === 503) throw new PaymentsNotConfiguredError();
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'create_order_failed');
  }
  return data as unknown as CreatedOrder;
}

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  notes?: Record<string, string>;
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open(): void;
  on(event: string, cb: (resp: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let scriptPromise: Promise<void> | null = null;

/** Lazily inject Razorpay Checkout.js exactly once. */
export function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no_window'));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('razorpay_script_failed')));
      if (window.Razorpay) resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = CHECKOUT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('razorpay_script_failed'));
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Open the Razorpay hosted checkout. Resolves with the signature payload on
 * success, rejects with Error('payment_cancelled') if the user dismisses.
 */
export function openRazorpayCheckout(args: {
  created: CreatedOrder;
  prefill?: { name?: string; email?: string; contact?: string };
}): Promise<RazorpaySuccess> {
  return new Promise<RazorpaySuccess>((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error('razorpay_unavailable'));
      return;
    }
    let settled = false;
    const rzp = new window.Razorpay({
      key: args.created.razorpayKeyId,
      amount: args.created.amount,
      currency: args.created.currency,
      name: 'Tresor Couture',
      description: 'Secure checkout',
      order_id: args.created.orderId,
      prefill: args.prefill,
      theme: { color: '#1f2a44' },
      handler: (response) => {
        settled = true;
        resolve(response);
      },
      modal: {
        ondismiss: () => {
          if (!settled) reject(new Error('payment_cancelled'));
        },
      },
    });
    rzp.on('payment.failed', (resp) => {
      if (!settled) {
        settled = true;
        reject(new Error(resp.error?.description || 'payment_failed'));
      }
    });
    rzp.open();
  });
}

/** Verify the payment server-side; the server writes the paid order + stock. */
export async function verifyPayment(args: {
  success: RazorpaySuccess;
  order: OrderContext;
}): Promise<{ orderId: string }> {
  const res = await apiPost('/api/payments/verify', {
    razorpay_order_id: args.success.razorpay_order_id,
    razorpay_payment_id: args.success.razorpay_payment_id,
    razorpay_signature: args.success.razorpay_signature,
    order: args.order,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !data.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'verify_failed');
  }
  return { orderId: String(data.orderId) };
}

/**
 * Full real-payment flow: create order → load script → open modal → verify.
 * Returns the Firestore order id written by the server.
 */
export async function runRazorpayPayment(input: {
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
  });
  await loadRazorpayScript();
  const success = await openRazorpayCheckout({ created, prefill: input.prefill });
  return verifyPayment({
    success,
    order: {
      items: input.items,
      couponCode: input.couponCode,
      paymentMethod: input.paymentMethod,
      shippingAddress: input.shippingAddress,
      userId: input.userId,
    },
  });
}
