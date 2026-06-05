/**
 * POST /api/orders/place — authoritative placement of an UNPAID order.
 *
 * This is the server-authoritative path for orders that are NOT settled through
 * the online gateway at checkout time: Cash on Delivery, and the pre-gateway
 * card/UPI demo. It exists to close the gap where a client could write an order
 * straight to Firestore with a tampered `total` (the Firestore rules cannot
 * recompute prices from the catalogue).
 *
 * Guarantees (Admin SDK bypasses Firestore rules):
 *   1. Caller is authenticated; the order's owner is the verified token uid.
 *   2. subtotal / discount / tax / shipping / total are recomputed server-side
 *      from Firestore product prices + coupon defs (`computeBreakdown`). The
 *      client total is ignored.
 *   3. COD is capped by value (COD_MAX_TOTAL, default ₹50,000).
 *   4. Stock is checked (lines that exceed available stock are rejected). Stock
 *      is NOT decremented here — COD orders can be abandoned; inventory is only
 *      committed on a *paid* order (see payments/verify.ts).
 *   5. The order is written with `amountVerified: true` — the marker invoices
 *      and reports trust. Client-written fallback orders carry
 *      `amountVerified: false` and must never be invoiced from their total.
 *
 * Returns 503 `orders_server_unavailable` when the Admin SDK isn't configured
 * (e.g. localhost / preview) so the client can fall back to the direct
 * Firestore write gracefully.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getDb, firebaseAdminConfigured } from '../_lib/firebaseAdmin.js';
import { computeBreakdown } from '../_lib/pricing.js';
import { verifyRequest } from '../_lib/auth.js';
import { readJson, type ApiRequest, type ApiResponse } from '../_lib/http.js';

const COD_MAX_TOTAL = Number(process.env.COD_MAX_TOTAL || 50000);

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
    // No Admin SDK here — let the client fall back to its direct write.
    res.status(503).json({ error: 'orders_server_unavailable' });
    return;
  }

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

  const paymentMethod = body.paymentMethod ?? 'cod';

  try {
    const db = getDb();
    const breakdown = await computeBreakdown(db, {
      items: body.items,
      couponCode: body.couponCode,
      paymentMethod,
    });

    if (paymentMethod === 'cod' && breakdown.total > COD_MAX_TOTAL) {
      res.status(400).json({ error: 'cod_limit_exceeded', limit: COD_MAX_TOTAL });
      return;
    }

    const orderRef = db.collection('orders').doc();
    const placedAt = new Date().toISOString();

    // Built inside the transaction; returned to the client so the confirmation
    // page + email have the full product snapshots without an extra read.
    let itemsForDoc: Record<string, unknown>[] = [];

    await db.runTransaction(async (tx) => {
      const productRefs = breakdown.lines.map((l) => db.collection('products').doc(l.fabricId));
      const snaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

      const built: Record<string, unknown>[] = [];
      for (let i = 0; i < breakdown.lines.length; i++) {
        const line = breakdown.lines[i]!;
        const snap = snaps[i]!;
        if (!snap.exists) throw new Error(`unknown_product:${line.fabricId}`);
        const data = (snap.data() ?? {}) as Record<string, unknown>;
        const stock = data.stock;
        if (typeof stock === 'number' && stock < line.quantity) {
          throw new Error(`insufficient_stock:${line.fabricId}`);
        }
        built.push({
          fabricId: line.fabricId,
          quantity: line.quantity,
          ...(line.color ? { color: line.color } : {}),
          fabricSnapshot: { id: line.fabricId, ...data },
        });
      }
      itemsForDoc = built;

      tx.set(orderRef, {
        userId: decoded.uid,
        customerEmail: decoded.email ?? null,
        items: itemsForDoc,
        subtotal: breakdown.subtotal,
        tax: breakdown.tax,
        shipping: breakdown.shipping,
        ...(breakdown.codSurcharge ? { codSurcharge: breakdown.codSurcharge } : {}),
        total: breakdown.total,
        shippingAddress: body.shippingAddress ?? {},
        paymentMethod,
        placedAt,
        status: 'placed',
        paymentStatus: 'pending',
        // Server-recomputed total — safe to invoice.
        amountVerified: true,
        ...(breakdown.couponCode
          ? { couponCode: breakdown.couponCode, couponDiscount: breakdown.couponDiscount }
          : {}),
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    // In-app admin alert (best-effort; mirrors the old client-side write).
    try {
      await db.collection('admin_notifications').add({
        kind: 'new_order',
        orderId: orderRef.id,
        userId: decoded.uid,
        customerEmail: decoded.email ?? null,
        total: breakdown.total,
        itemCount: itemsForDoc.length,
        createdAt: FieldValue.serverTimestamp(),
        read: false,
      });
    } catch (err) {
      console.warn('[orders/place] admin alert failed', err instanceof Error ? err.message : err);
    }

    // Echo the persisted order so the client doesn't trust its own totals.
    res.status(200).json({
      ok: true,
      orderId: orderRef.id,
      order: {
        id: orderRef.id,
        userId: decoded.uid,
        items: itemsForDoc,
        subtotal: breakdown.subtotal,
        tax: breakdown.tax,
        shipping: breakdown.shipping,
        ...(breakdown.codSurcharge ? { codSurcharge: breakdown.codSurcharge } : {}),
        total: breakdown.total,
        shippingAddress: body.shippingAddress ?? {},
        paymentMethod,
        placedAt,
        status: 'placed',
        paymentStatus: 'pending',
        amountVerified: true,
        ...(breakdown.couponCode
          ? { couponCode: breakdown.couponCode, couponDiscount: breakdown.couponDiscount }
          : {}),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'place_failed';
    if (message.startsWith('insufficient_stock')) {
      res.status(409).json({ error: 'insufficient_stock', detail: message });
      return;
    }
    if (message.startsWith('unknown_product')) {
      res.status(400).json({ error: message });
      return;
    }
    if (message === 'empty_cart' || message === 'invalid_line' || message === 'product_price_unavailable') {
      res.status(400).json({ error: message });
      return;
    }
    console.error('[orders/place] failed', message);
    res.status(500).json({ error: 'place_failed' });
  }
}
