/**
 * POST /api/orders/place — server-authoritative COD / unpaid order placement.
 *
 * The browser used to compute the order total and write it straight to
 * Firestore, so a tampered client could place a real cart at a fake price.
 * This endpoint is now the ONLY path for creating orders: it verifies the
 * buyer's Firebase ID token, RECOMPUTES every amount from Firestore via the
 * Admin SDK (the client total is ignored), RESERVES inventory by decrementing
 * product stock inside a Firestore transaction, and writes the order. `userId`
 * is taken from the verified token, never the body.
 *
 * Gated strictly on WRITE credentials (a service account). When the service
 * account isn't set it returns 503 `orders_not_configured` so the checkout UI
 * can show a clear "not configured" message instead of a generic error.
 *
 * Body: { order: { items:[{fabricId,quantity,color?}], couponCode?,
 *                  paymentMethod, shippingAddress } }
 *
 * NOTE: mirrors the current client total (no COD surcharge) so the figure
 * charged equals the figure the checkout UI showed. Real card/UPI money uses
 * /api/payments/verify, which additionally checks the Razorpay signature.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../_lib/firebaseAdmin.js';
import { computeBreakdown } from '../_lib/pricing.js';
import { handleCorsPreflight, rejectDisallowedOrigin } from '../_lib/cors.js';
import { validateCsrfToken } from '../_lib/csrf.js';
import { rateLimited, rateLimitHeaders } from '../_lib/rateLimit.js';
import { readJson, header, type ApiRequest, type ApiResponse } from '../_lib/http.js';
import { verifyIdToken } from '../_lib/auth.js';
import { withSentry } from '../_lib/sentry.js';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tresor-couture';

/** True only when real WRITE credentials exist. The keyless projectId path can
 *  verify ID tokens but cannot write Firestore, so we must not advertise this
 *  endpoint as available on a keyless deploy — return 503 instead of 500-ing
 *  mid-checkout. */
function canWriteOrders(): boolean {
  return Boolean(
    (process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT.trim()) ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

interface Body {
  order?: {
    items?: { fabricId: string; quantity: number; color?: string }[];
    couponCode?: string;
    paymentMethod?: string;
    shippingAddress?: Record<string, unknown>;
  };
}

const ALLOWED_PAYMENT_METHODS = ['cod'] as const;

const SHIPPING_FIELD_MAX: Record<string, number> = {
  fullName: 128,
  email: 254,
  phone: 32,
  line1: 256,
  line2: 256,
  city: 64,
  state: 64,
  postalCode: 16,
  country: 64,
};

/** Sanitize the shipping address: keep only known string fields and cap length. */
function sanitizeShippingAddress(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  const input = raw as Record<string, unknown>;
  for (const [key, max] of Object.entries(SHIPPING_FIELD_MAX)) {
    const value = input[key];
    if (typeof value === 'string') {
      out[key] = value.trim().slice(0, max);
    }
  }
  return out;
}

function readStock(data: Record<string, unknown>): number {
  const s = data.stock;
  return typeof s === 'number' && isFinite(s) ? s : 0;
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

  // 5 placement attempts per IP per minute prevents brute-force / cart probing.
  const ORDER_RATE_LIMIT = { window: 60, max: 5 };
  for (const [k, v] of Object.entries(rateLimitHeaders(ORDER_RATE_LIMIT))) {
    res.setHeader(k, v);
  }
  if (await rateLimited(req, ORDER_RATE_LIMIT)) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  if (!canWriteOrders()) {
    res.status(503).json({ error: 'orders_not_configured' });
    return;
  }

  // Build the credentialed app FIRST (so token verification reuses it), then auth.
  // A malformed/invalid service account makes getDb() throw at init — degrade to
  // 503 instead of a 500 FUNCTION_INVOCATION_FAILED, and log the real reason.
  let db: ReturnType<typeof getDb>;
  try {
    db = getDb();
  } catch (err) {
    console.error('[orders/place] admin init failed:', err instanceof Error ? err.message : err);
    res.status(503).json({ error: 'orders_not_configured' });
    return;
  }
  const decoded = await verifyIdToken(header(req, 'authorization'));
  if (!decoded?.uid) {
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

  const order = body.order;
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    res.status(400).json({ error: 'empty_cart' });
    return;
  }
  if (!ALLOWED_PAYMENT_METHODS.includes(order.paymentMethod as typeof ALLOWED_PAYMENT_METHODS[number])) {
    res.status(400).json({ error: 'invalid_payment_method' });
    return;
  }

  const shippingAddress = sanitizeShippingAddress(order.shippingAddress);

  try {
    // Authoritative pricing for COD. Pass paymentMethod so the ₹50 COD
    // surcharge is included in the recorded total.
    const breakdown = await computeBreakdown(db, {
      items: order.items,
      couponCode: order.couponCode,
      paymentMethod: 'cod',
    });

    // Self-contained line snapshots (mirror the client's fabricSnapshot so
    // order history / confirmation emails keep working) from authoritative data.
    const productRefs = breakdown.lines.map((l) => db.collection('products').doc(l.fabricId));
    const productSnaps = await Promise.all(productRefs.map((ref) => ref.get()));
    const itemsForDoc = breakdown.lines.map((line, i) => {
      const data = (productSnaps[i]?.data() ?? {}) as Record<string, unknown>;
      return {
        fabricId: line.fabricId,
        quantity: line.quantity,
        ...(line.color ? { color: line.color } : {}),
        fabricSnapshot: { id: line.fabricId, ...data },
      };
    });

    // Reserve inventory and create the order atomically. If stock is
    // insufficient for any line, the transaction aborts and we return 409.
    const orderId = await db.runTransaction(async (tx) => {
      const snaps = await tx.getAll(...productRefs);
      for (let i = 0; i < breakdown.lines.length; i++) {
        const line = breakdown.lines[i];
        const snap = snaps[i];
        if (!snap.exists) throw new Error(`unknown_product:${line.fabricId}`);
        const data = (snap.data() ?? {}) as Record<string, unknown>;
        const current = readStock(data);
        if (current < line.quantity) {
          throw new Error(`insufficient_stock:${line.fabricId}`);
        }
        tx.update(snap.ref, {
          stock: current - line.quantity,
          updatedAt: new Date().toISOString(),
        });
      }

      const orderRef = db.collection('orders').doc();
      tx.set(orderRef, {
        userId: decoded.uid,
        items: itemsForDoc,
        subtotal: breakdown.subtotal,
        tax: breakdown.tax,
        shipping: breakdown.shipping,
        total: breakdown.total,
        shippingAddress,
        paymentMethod: 'cod',
        ...(breakdown.codSurcharge ? { codSurcharge: breakdown.codSurcharge } : {}),
        placedAt: new Date().toISOString(),
        status: 'placed',
        paymentStatus: 'pending',
        ...(breakdown.couponCode
          ? { couponCode: breakdown.couponCode, couponDiscount: breakdown.couponDiscount }
          : {}),
        createdAt: FieldValue.serverTimestamp(),
      });
      return orderRef.id;
    });

    res.status(200).json({ ok: true, orderId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'place_failed';
    if (
      message.startsWith('unknown_product') ||
      message === 'empty_cart' ||
      message === 'invalid_line' ||
      message === 'product_price_unavailable'
    ) {
      res.status(400).json({ error: message });
      return;
    }
    if (message.startsWith('insufficient_stock:')) {
      const fabricId = message.slice('insufficient_stock:'.length);
      res.status(409).json({ error: message, fabricId });
      return;
    }
    console.error('[orders/place] failed', message);
    res.status(500).json({ error: 'place_failed' });
  }
}

export default withSentry(handler);
