/**
 * POST /api/payments/verify
 *
 * Called by the browser after Razorpay Checkout succeeds. Body:
 * {
 *   razorpay_order_id, razorpay_payment_id, razorpay_signature,
 *   order: {
 *     userId, items:[{fabricId, quantity, color?}], couponCode?,
 *     paymentMethod, shippingAddress
 *   }
 * }
 *
 * Steps (all server-authoritative; the Admin SDK bypasses Firestore rules):
 *   1. Verify the Razorpay handshake signature.
 *   2. Recompute the authoritative amount from Firestore and confirm it
 *      equals the amount Razorpay actually captured (anti-tamper).
 *   3. In a single Firestore transaction: re-read stock, reject if any line
 *      is short, decrement stock, and write the order with
 *      status:'placed' + paymentStatus:'paid' + the payment ids.
 *
 * Idempotent on razorpay_payment_id: a repeat call returns the existing order
 * instead of double-decrementing stock.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getDb, firebaseAdminConfigured } from '../_lib/firebaseAdmin.js';
import { computeBreakdown } from '../_lib/pricing.js';
import { getRazorpay, razorpayConfigured, verifyCheckoutSignature } from '../_lib/razorpay.js';
import { verifyRequest } from '../_lib/auth.js';
import { readJson, type ApiRequest, type ApiResponse } from '../_lib/http.js';

interface VerifyBody {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  order?: {
    userId?: string;
    items?: { fabricId: string; quantity: number; color?: string }[];
    couponCode?: string;
    paymentMethod?: 'card' | 'upi' | 'cod';
    shippingAddress?: Record<string, unknown>;
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  if (!razorpayConfigured() || !firebaseAdminConfigured()) {
    res.status(503).json({ error: 'payments_not_configured' });
    return;
  }

  // Authenticate the caller. The order's owner is taken from the verified
  // token (below), NOT from the request body — a client must not be able to
  // attribute a paid order to someone else's uid.
  const decoded = await verifyRequest(req);
  if (!decoded) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  let body: VerifyBody;
  try {
    body = readJson<VerifyBody>(req);
  } catch {
    res.status(400).json({ error: 'invalid_json' });
    return;
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400).json({ error: 'missing_payment_fields' });
    return;
  }
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    res.status(400).json({ error: 'empty_cart' });
    return;
  }

  // 1. Signature check.
  if (!verifyCheckoutSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
    res.status(400).json({ error: 'signature_mismatch' });
    return;
  }

  try {
    const db = getDb();

    // Idempotency: if we've already recorded this payment, return it.
    const existing = await db
      .collection('orders')
      .where('paymentId', '==', razorpay_payment_id)
      .limit(1)
      .get();
    if (!existing.empty) {
      const doc = existing.docs[0]!;
      res.status(200).json({ ok: true, orderId: doc.id, alreadyProcessed: true });
      return;
    }

    // 2. Recompute authoritative amount and confirm Razorpay actually
    //    captured that amount for this order id.
    const breakdown = await computeBreakdown(db, {
      items: order.items,
      couponCode: order.couponCode,
      paymentMethod: order.paymentMethod,
    });

    const razorpay = getRazorpay();
    const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
    const capturedAmount = Number(rzpOrder.amount);
    if (capturedAmount !== breakdown.amountMinor) {
      // Amount tampering or stale cart — refuse to fulfil.
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
        if (typeof stock === 'number') {
          if (stock < line.quantity) {
            throw new Error(`insufficient_stock:${line.fabricId}`);
          }
          tx.update(productRefs[i]!, {
            stock: FieldValue.increment(-line.quantity),
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
        // Ownership comes from the verified ID token, never the request body.
        userId: decoded.uid,
        customerEmail: decoded.email ?? null,
        items: itemsForDoc,
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
        // Server-recomputed total (anti-tamper) — safe to invoice.
        amountVerified: true,
        paymentProvider: 'razorpay',
        paymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        ...(breakdown.couponCode
          ? { couponCode: breakdown.couponCode, couponDiscount: breakdown.couponDiscount }
          : {}),
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    // NOTE: the order-confirmation email for paid (card/UPI) orders is a
    // follow-up. Main's email path (`api/email/order.ts`) requires the buyer's
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
      // 'placed' order; the CEO should refund from the Razorpay dashboard.
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
