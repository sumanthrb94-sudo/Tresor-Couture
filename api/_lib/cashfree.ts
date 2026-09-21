/**
 * Cashfree Payments server-side helpers.
 *
 * Keys live ONLY in server env and never reach a browser:
 *   CASHFREE_APP_ID       — merchant app id ("client id")
 *   CASHFREE_SECRET_KEY   — merchant secret; also signs webhooks
 *   CASHFREE_ENV          — "production" to charge real cards; anything else
 *                           (or unset) stays on sandbox
 *
 * The client is told nothing but a `payment_session_id`, which is single-use
 * and bound to an amount Cashfree already holds. There is no public key to
 * expose and no amount the browser can restate.
 *
 * WHERE PAYMENT TRUTH COMES FROM:
 *
 * Nothing the browser reports about the outcome is believed. The server ASKS
 * CASHFREE what happened (`fetchOrder`) and acts only on
 * `order_status: "PAID"`. Truth comes from the payment processor over a
 * server-to-server call, so there is no client-side success token to forge.
 *
 * API: https://www.cashfree.com/docs/api-reference/payments/latest/orders
 */
import crypto from 'node:crypto';

/** Pinned. Cashfree versions its API by date and changes response shapes between
 *  versions, so this must move deliberately and not drift with their default. */
const API_VERSION = '2025-01-01';

const PROD_BASE = 'https://api.cashfree.com';
const SANDBOX_BASE = 'https://sandbox.cashfree.com';

export function cashfreeConfigured(): boolean {
  return Boolean(process.env.CASHFREE_APP_ID?.trim() && process.env.CASHFREE_SECRET_KEY?.trim());
}

/** Live only when explicitly asked for. An unset or misspelled CASHFREE_ENV
 *  must never be the thing that starts charging real cards. */
export function cashfreeLive(): boolean {
  return (process.env.CASHFREE_ENV ?? '').trim().toLowerCase() === 'production';
}

/**
 * Which Cashfree to talk to.
 *
 * `CASHFREE_API_BASE` redirects the sandbox at a local stub so the verify and
 * webhook handlers can be driven end to end without a merchant account. It is
 * checked ONLY on the sandbox branch and is unreachable once CASHFREE_ENV says
 * `production` — a live deploy always talks to api.cashfree.com, whatever the
 * environment says. Making the payment-truth endpoint redirectable in
 * production would hand an attacker with env access the ability to mark orders
 * paid, which is the one thing this whole module exists to prevent.
 */
export const cashfreeBase = (): string =>
  cashfreeLive() ? PROD_BASE : process.env.CASHFREE_API_BASE?.trim() || SANDBOX_BASE;

function authHeaders(): Record<string, string> {
  const id = process.env.CASHFREE_APP_ID?.trim();
  const secret = process.env.CASHFREE_SECRET_KEY?.trim();
  if (!id || !secret) throw new Error('payments_not_configured');
  return {
    'x-client-id': id,
    'x-client-secret': secret,
    'x-api-version': API_VERSION,
    'Content-Type': 'application/json',
    accept: 'application/json',
  };
}

export interface CashfreeCustomer {
  id: string;
  phone: string;
  name?: string;
  email?: string;
}

export interface CreatedCashfreeOrder {
  orderId: string;
  paymentSessionId: string;
  cfOrderId?: string | number;
}

/**
 * Cashfree requires a 10-digit Indian mobile and rejects the order outright
 * without one. Checkout already validates the shopper's number, but it accepts
 * a +91 or 0 prefix, so strip to the last ten digits before sending.
 */
export function normalisePhone(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** Our own order reference. Cashfree allows 3–50 chars of [A-Za-z0-9_-]. */
export function newCashfreeOrderId(): string {
  return `tc_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;
}

async function cashfreeFetch(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(`${cashfreeBase()}${path}`, { ...init, headers: authHeaders() });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    // Cashfree returns HTML on some gateway errors; keep the status, drop the page.
  }
  if (!res.ok) {
    const message = typeof body.message === 'string' ? body.message : `cashfree_http_${res.status}`;
    const err = new Error(message) as Error & { status?: number; code?: unknown };
    err.status = res.status;
    err.code = body.code;
    throw err;
  }
  return body;
}

/**
 * Create the order Cashfree will collect against.
 *
 * `amount` is in RUPEES as a decimal, not paise. Sending a minor-unit integer
 * here would charge a hundred times the order.
 */
export async function createCashfreeOrder(args: {
  orderId: string;
  amount: number;
  currency: string;
  customer: CashfreeCustomer;
  returnUrl?: string;
  notifyUrl?: string;
  note?: string;
}): Promise<CreatedCashfreeOrder> {
  const body = {
    order_id: args.orderId,
    order_amount: Number(args.amount.toFixed(2)),
    order_currency: args.currency,
    customer_details: {
      customer_id: args.customer.id,
      customer_phone: args.customer.phone,
      ...(args.customer.name ? { customer_name: args.customer.name } : {}),
      ...(args.customer.email ? { customer_email: args.customer.email } : {}),
    },
    order_meta: {
      // Cashfree requires the {order_id} placeholder literally; it substitutes
      // it when a bank or UPI app sends the shopper back to us.
      ...(args.returnUrl ? { return_url: args.returnUrl } : {}),
      ...(args.notifyUrl ? { notify_url: args.notifyUrl } : {}),
    },
    ...(args.note ? { order_note: args.note.slice(0, 200) } : {}),
  };

  const out = await cashfreeFetch('/pg/orders', { method: 'POST', body: JSON.stringify(body) });
  const sessionId = out.payment_session_id;
  if (typeof sessionId !== 'string' || !sessionId) throw new Error('cashfree_no_session');
  return {
    orderId: String(out.order_id ?? args.orderId),
    paymentSessionId: sessionId,
    cfOrderId: out.cf_order_id as string | number | undefined,
  };
}

export interface CashfreeOrderState {
  status: string;
  amount: number;
  currency: string;
  raw: Record<string, unknown>;
}

/**
 * Ask Cashfree what actually happened to an order.
 *
 * This is the ONLY thing the server trusts when deciding a payment succeeded.
 * `order_status` is one of ACTIVE (created, not paid), PAID, EXPIRED,
 * TERMINATED or TERMINATION_REQUESTED.
 */
export async function fetchCashfreeOrder(orderId: string): Promise<CashfreeOrderState> {
  const out = await cashfreeFetch(`/pg/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
  return {
    status: String(out.order_status ?? ''),
    amount: Number(out.order_amount ?? 0),
    currency: String(out.order_currency ?? 'INR'),
    raw: out,
  };
}

export const CASHFREE_PAID = 'PAID';

/**
 * Verify a webhook: base64(HMAC_SHA256(timestamp + rawBody, CASHFREE_SECRET_KEY))
 * against the `x-webhook-signature` header.
 *
 * Signed over the RAW body. Re-serialising parsed JSON reorders keys and
 * changes whitespace, which produces a different digest and rejects every
 * genuine webhook — hence bodyParser:false on the route.
 */
export function verifyCashfreeWebhook(
  rawBody: string,
  signature: string | undefined,
  timestamp: string | undefined,
): boolean {
  const secret = process.env.CASHFREE_SECRET_KEY?.trim();
  if (!secret || !signature || !timestamp) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}${rawBody}`)
    .digest('base64');
  return timingSafeEqualB64(expected, signature);
}

function timingSafeEqualB64(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'base64');
    const bb = Buffer.from(b, 'base64');
    if (ba.length !== bb.length || ba.length === 0) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
