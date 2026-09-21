/**
 * POST /api/payments/verify
 *
 * Called by the browser after the Cashfree modal closes. Body:
 * {
 *   cashfree_order_id,
 *   order: {
 *     userId, items:[{fabricId, quantity, color?}], couponCode?,
 *     paymentMethod, shippingAddress
 *   }
 * }
 *
 * NOTHING THE BROWSER SAYS ABOUT THE OUTCOME IS TRUSTED. The page reports only
 * which order it was working on; whether money actually moved is settled by
 * asking Cashfree over a server-to-server call. There is no client-side
 * success token to forge, because there is no client-side success token.
 *
 * Steps (all server-authoritative; the Admin SDK bypasses Firestore rules):
 *   1. Ask Cashfree for the order and proceed only on order_status "PAID".
 *   2. Recompute the authoritative amount from Firestore and confirm Cashfree
 *      holds that same amount (anti-tamper).
 *   3. In a single Firestore transaction: re-read stock, reject if any line
 *      is short, decrement stock, and write the order with
 *      status:'placed' + paymentStatus:'paid' + the payment id.
 *
 * Idempotent on the Cashfree order id: a repeat call returns the existing
 * order instead of double-decrementing stock.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getDb, firebaseAdminConfigured } from '../_lib/firebaseAdmin.js';
import { computeBreakdown } from '../_lib/pricing.js';
import { CASHFREE_PAID, cashfreeConfigured, fetchCashfreeOrder } from '../_lib/cashfree.js';
import { handleCorsPreflight, rejectDisallowedOrigin } from '../_lib/cors.js';
import { validateCsrfToken } from '../_lib/csrf.js';
import { readJson, header, type ApiRequest, type ApiResponse } from '../_lib/http.js';
import { verifyIdToken } from '../_lib/auth.js';
import { rateLimited, rateLimitHeaders } from '../_lib/rateLimit.js';
import { withSentry } from '../_lib/sentry.js';

interface VerifyBody {
  /** The order id we generated at create-order time. Nothing else is taken
   *  from the browser — the status comes from Cashfree itself. */
  cashfree_order_id?: string;
  order?: {
    userId?: string;
    items?: { fabricId: string; quantity: number; color?: string }[];
    couponCode?: string;
    paymentMethod?: 'card' | 'upi' | 'cod';
    shippingAddress?: Record<string, unknown>;
  };
}

async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (handleCorsPreflight(req, res, 'POST, OPTIONS')) return;
  if (rejectDisallowedOrigin(req, res)) return;
  if (!validateCsrfToken(req, res)) {
    res.status(403).json({ error: 'csrf_token_invalid' });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const decoded = await verifyIdToken(header(req, 'authorization'));
  if (!decoded?.uid) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  // The Cashfree status lookup is the security boundary; this bounds how fast
  // anyone can probe order ids (or hammer the endpoint after a real payment).
  const VERIFY_RATE_LIMIT = { window: 60, max: 10 };
  for (const [k, v] of Object.entries(rateLimitHeaders(VERIFY_RATE_LIMIT))) {
    res.setHeader(k, v);
  }
  if (await rateLimited(req, VERIFY_RATE_LIMIT, decoded.uid)) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  if (!cashfreeConfigured() || !firebaseAdminConfigured()) {
    res.status(503).json({ error: 'payments_not_configured' });
    return;
  }

  let body: VerifyBody;
  try {
    body = readJson<VerifyBody>(req);
  } catch {
    res.status(400).json({ error: 'invalid_json' });
    return;
  }

  const { cashfree_order_id, order } = body;

  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    res.status(400).json({ error: 'empty_cart' });
    return;
  }
  if (!cashfree_order_id) {
    res.status(400).json({ error: 'missing_payment_fields' });
    return;
  }

  try {
    const db = getDb();

    // Idempotency: if we've already recorded this payment, return it. The
    // order id is the key — an order can be attempted several times but only
    // one attempt ever reaches PAID.
    const paymentKey = cashfree_order_id;
    const existing = await db
      .collection('orders')
      .where('paymentId', '==', paymentKey)
      .limit(1)
      .get();
    if (!existing.empty) {
      const doc = existing.docs[0]!;
      res.status(200).json({ ok: true, orderId: doc.id, alreadyProcessed: true });
      return;
    }

    // 2. Recompute the authoritative amount and confirm Cashfree is holding
    //    that same amount for this order id.
    const breakdown = await computeBreakdown(db, {
      items: order.items,
      couponCode: order.couponCode,
      paymentMethod: order.paymentMethod,
    });

    // The payment processor is the only witness worth believing.
    const state = await fetchCashfreeOrder(cashfree_order_id);
    if (state.status !== CASHFREE_PAID) {
      // ACTIVE means the shopper never completed; EXPIRED/TERMINATED means it
      // can never complete. Neither is an error on our side, so say plainly
      // what happened rather than returning a generic failure.
      res.status(409).json({ error: 'payment_not_completed', status: state.status });
      return;
    }
    // Cashfree holds rupees with two decimals; our total is whole rupees.
    // Compare with a paise of tolerance rather than exact float equality.
    if (Math.abs(state.amount - breakdown.total) > 0.01) {
      res.status(409).json({ error: 'amount_mismatch' });
      return;
    }

    // 3. Transactional stock decrement + order write.
    const orderRef = db.collection('orders').doc();
    await db.runTransaction(async (tx) => {
      // Re-read every product inside the transaction for a consistent snapshot.
      const productRefs = breakdown.lines.map((l) => db.collection('products').doc(l.fabricId));
      const snaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

      const itemsForDoc: Record<string, unknown>[] = [];
      for (let i = 0; i < breakdown.lines.length; i++) {
        const line = breakdown.lines[i]!;
        const snap = snaps[i]!;
        if (!snap.exists) throw new Error(`unknown_product:${line.fabricId}`);
        const data = (snap.data() ?? {}) as Record<string, unknown>;
        const stock = data.stock;
        // What LEAVES THE SHELF, which is not always what was ordered: lace is
        // stocked in metres with a bundle price break, and rounding a
        // part-bundle up hands over the whole bundle. Same rule as
        // api/orders/place.ts — the two paths must not disagree about stock.
        const taken = line.metersGiven ?? line.quantity;
        if (typeof stock === 'number') {
          if (stock < taken) {
            throw new Error(`insufficient_stock:${line.fabricId}`);
          }
          tx.update(productRefs[i]!, {
            stock: FieldValue.increment(-taken),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        // Build a self-contained snapshot for the order line (mirrors the
        // client's fabricSnapshot so order history / emails keep working).
        itemsForDoc.push({
          fabricId: line.fabricId,
          quantity: line.quantity,
          ...(line.color ? { color: line.color } : {}),
          fabricSnapshot: { id: line.fabricId, ...data },
        });
      }

      tx.set(orderRef, {
        userId: decoded.uid,
        items: itemsForDoc,
        // See api/orders/place.ts: firestore.rules needs a flat id list to
        // answer "did this person buy this product?" for the review gate.
        productIds: [...new Set(breakdown.lines.map((l) => l.fabricId))],
        subtotal: breakdown.subtotal,
        tax: breakdown.tax,
        shipping: breakdown.shipping,
        ...(breakdown.codSurcharge ? { codSurcharge: breakdown.codSurcharge } : {}),
        total: breakdown.total,
        shippingAddress: order.shippingAddress ?? {},
        paymentMethod: order.paymentMethod ?? 'card',
        placedAt: new Date().toISOString(),
        status: 'placed',
        paymentStatus: 'paid',
        paymentProvider: 'cashfree',
        paymentId: paymentKey,
        cashfreeOrderId: cashfree_order_id,
        ...(breakdown.couponCode
          ? { couponCode: breakdown.couponCode, couponDiscount: breakdown.couponDiscount }
          : {}),
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    // NOTE: the order-confirmation email for paid (card/UPI) orders is a
    // follow-up. Main's email path (`api/_handlers/email-order.ts`) requires the buyer's
    // Firebase ID token, which this server-to-server flow does not hold, so it
    // can't be called from here directly. Options for the follow-up: (a) have
    // the client call /api/email/order after a successful verify, or (b) add a
    // token-less server enqueue. The order itself is safely persisted + paid
    // and visible in the admin console regardless.
    res.status(200).json({ ok: true, orderId: orderRef.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'verify_failed';
    if (message.startsWith('insufficient_stock')) {
      // Payment captured but stock ran out: flag for refund. We do NOT write a
      // 'placed' order; the CEO should refund from the Cashfree dashboard.
      res.status(409).json({ error: 'insufficient_stock', detail: message, refundRequired: true });
      return;
    }
    if (message.startsWith('unknown_product')) {
      res.status(400).json({ error: message });
      return;
    }
    console.error('[verify] failed', message);
    res.status(500).json({ error: 'verify_failed' });
  }
}

export default withSentry(handler);
