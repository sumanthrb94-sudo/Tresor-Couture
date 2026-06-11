/**
 * POST /api/orders/create
 *
 * Authenticated, server-authoritative order creation for Cash-on-Delivery
 * (and any other non-gateway method). This closes the gap where COD orders were
 * written client-side with a client-supplied total: the price is recomputed
 * here from Firestore product data via the Admin SDK, and the order's `userId`
 * is taken from the verified Firebase ID token — never from the request body.
 * A tampered cart total can therefore never be trusted.
 *
 * Card / UPI orders do NOT use this route — they go through /api/payments/*,
 * where Razorpay captures the authoritative amount and is the only path that
 * may mark an order `paid`.
 *
 * Auth: Authorization: Bearer <Firebase ID token>.
 * Body: { items:[{fabricId,quantity,color?}], couponCode?, paymentMethod?, shippingAddress }
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDb, firebaseAdminConfigured } from '../_lib/firebaseAdmin.js';
import { computeBreakdown } from '../_lib/pricing.js';
import { header, readJson, type ApiRequest, type ApiResponse } from '../_lib/http.js';

interface Body {
  items?: { fabricId: string; quantity: number; color?: string }[];
  couponCode?: string;
  paymentMethod?: 'card' | 'upi' | 'cod';
  shippingAddress?: Record<string, unknown>;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  if (!firebaseAdminConfigured()) {
    res.status(503).json({ error: 'orders_not_configured' });
    return;
  }

  let body: Body;
  try {
    body = readJson<Body>(req);
  } catch {
    res.status(400).json({ error: 'invalid_json' });
    return;
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    res.status(400).json({ error: 'empty_cart' });
    return;
  }
  // Only COD creates orders here; card/UPI must be captured by Razorpay.
  if (body.paymentMethod && body.paymentMethod !== 'cod') {
    res.status(400).json({ error: 'unsupported_payment_method' });
    return;
  }

  // Authenticate. The order's userId comes from the verified token, not the body.
  let uid: string;
  try {
    getDb(); // initialise the credentialed Admin app before reading its Auth
    const raw = header(req, 'authorization');
    const token = raw?.startsWith('Bearer ') ? raw.slice(7) : raw;
    if (!token) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const decoded = await getAuth(getApps()[0]!).verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const db = getDb();
    // Authoritative price. No COD surcharge so the recorded total matches the
    // figure shown at checkout (the UI doesn't display a COD surcharge).
    const breakdown = await computeBreakdown(db, {
      items: body.items,
      couponCode: body.couponCode,
    });

    // Self-contained line snapshots from current product data (mirrors the
    // client's fabricSnapshot so order history / emails keep working).
    const snaps = await Promise.all(
      breakdown.lines.map((l) => db.collection('products').doc(l.fabricId).get()),
    );
    const items = breakdown.lines.map((line, i) => {
      const data = (snaps[i]?.data() ?? {}) as Record<string, unknown>;
      return {
        fabricId: line.fabricId,
        quantity: line.quantity,
        ...(line.color ? { color: line.color } : {}),
        fabricSnapshot: { id: line.fabricId, ...data },
      };
    });

    const order = {
      userId: uid,
      items,
      subtotal: breakdown.subtotal,
      tax: breakdown.tax,
      shipping: breakdown.shipping,
      total: breakdown.total,
      shippingAddress: body.shippingAddress ?? {},
      paymentMethod: 'cod' as const,
      // COD is unpaid until delivery — a client may never assert 'paid'.
      paymentStatus: 'pending' as const,
      placedAt: new Date().toISOString(),
      status: 'placed' as const,
      ...(breakdown.couponCode
        ? { couponCode: breakdown.couponCode, couponDiscount: breakdown.couponDiscount }
        : {}),
    };

    const ref = db.collection('orders').doc();
    await ref.set({ ...order, createdAt: FieldValue.serverTimestamp() });

    res.status(200).json({ ok: true, orderId: ref.id, order: { id: ref.id, ...order } });
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
    console.error('[orders/create] failed', message);
    res.status(500).json({ error: 'create_order_failed' });
  }
}
