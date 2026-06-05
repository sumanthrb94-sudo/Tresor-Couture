/**
 * POST /api/payments/create-order
 *
 * Body: {
  *   items: [{ fabricId, quantity, color? }],
 *   couponCode?: string,
 *   paymentMethod?: 'card' | 'upi' | 'cod'
 * }
 *
 * Recomputes the authoritative amount server-side from Firestore product
 * prices (the client total is ignored), creates a Razorpay order for that
 * amount, and returns the order id + amount + public key id so the browser
 * can open Razorpay Checkout.
 *
 * If Razorpay keys are absent the endpoint returns 503 `payments_not_configured`
 * so the client falls back to the demo flow gracefully.
 */
import { getDb, firebaseAdminConfigured } from '../_lib/firebaseAdmin.js';
import { computeBreakdown } from '../_lib/pricing.js';
import { getRazorpay, razorpayConfigured } from '../_lib/razorpay.js';
import { verifyRequest } from '../_lib/auth.js';
import { readJson, type ApiRequest, type ApiResponse } from '../_lib/http.js';

interface Body {
  items?: { fabricId: string; quantity: number; color?: string }[];
  couponCode?: string;
  paymentMethod?: 'card' | 'upi' | 'cod';
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  // Credential gate — let the client fall back to demo mode.
  if (!razorpayConfigured()) {
    res.status(503).json({ error: 'payments_not_configured' });
    return;
  }
  if (!firebaseAdminConfigured()) {
    // Without a service account we cannot establish the authoritative amount.
    res.status(503).json({ error: 'payments_not_configured' });
    return;
  }

  // Require a signed-in caller. Without this, anyone could spin up Razorpay
  // orders against our account (cost/abuse) — and there is no reason an
  // unauthenticated client should be initiating a checkout.
  const decoded = await verifyRequest(req);
  if (!decoded) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  let body: Body;
  try {
    body = readJson<Body>(req);
  } catch {
    res.status(400).json({ error: 'invalid_json' });
    return;
  }

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    res.status(400).json({ error: 'empty_cart' });
    return;
  }

  try {
    const db = getDb();
    const breakdown = await computeBreakdown(db, {
      items: body.items,
      couponCode: body.couponCode,
      paymentMethod: body.paymentMethod,
    });

    if (breakdown.amountMinor < 100) {
      // Razorpay rejects amounts under ₹1.00.
      res.status(400).json({ error: 'amount_too_low' });
      return;
    }

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: breakdown.amountMinor,
      currency: breakdown.currency,
      receipt: `tc_${Date.now().toString(36)}`,
      notes: {
        itemCount: String(breakdown.lines.length),
        couponCode: breakdown.couponCode ?? '',
        paymentMethod: body.paymentMethod ?? '',
      },
    });

    res.status(200).json({
      orderId: order.id,
      amount: breakdown.amountMinor,
      currency: breakdown.currency,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      // Echo the breakdown so the UI can show an authoritative summary.
      breakdown: {
        subtotal: breakdown.subtotal,
        couponCode: breakdown.couponCode ?? null,
        couponDiscount: breakdown.couponDiscount,
        tax: breakdown.tax,
        shipping: breakdown.shipping,
        codSurcharge: breakdown.codSurcharge,
        total: breakdown.total,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'create_order_failed';
    if (message.startsWith('unknown_product')) {
      res.status(400).json({ error: message });
      return;
    }
    if (message === 'empty_cart' || message === 'invalid_line' || message === 'product_price_unavailable') {
      res.status(400).json({ error: message });
      return;
    }
    console.error('[create-order] failed', message);
    res.status(500).json({ error: 'create_order_failed' });
  }
}
