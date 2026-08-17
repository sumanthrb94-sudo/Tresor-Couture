/**
 * POST /api/pos/sale — ring up a walk-in sale at the studio counter.
 *
 * Why this exists at all: `firestore.rules` has `allow create: if false` on
 * orders, so no browser can write one — by design. `/api/orders/place` is the
 * customer path (COD only, `userId` taken from the buyer's own token) and
 * cannot serve a walk-in. So the counter needs its own admin-only endpoint,
 * reusing the same authoritative pricing and the same transactional stock.
 *
 * The result is one number for stock whether a piece sold online or across the
 * counter, and counter sales landing in Billing beside web orders.
 *
 * Body: { sale: { items: [{fabricId, quantity, color?}], paymentMethod,
 *                 saleKey, customer?: { name?, phone? } } }
 *
 * Decisions worth knowing before changing anything here:
 *
 *  - **`userId` is omitted entirely, never the admin's uid.** Writing the
 *    operator's uid would drop every walk-in sale into that person's own order
 *    history and make it returnable by their account. It is the most damaging
 *    plausible mistake in this file.
 *  - **Stock and order move in ONE transaction.** An order can therefore never
 *    exist without its stock having been taken, so there is no compensating
 *    restore to get wrong.
 *  - **Place of supply is composed by the server** and fixed to the studio's
 *    own state, so the invoice reads CGST+SGST. Not an operator's to override.
 *  - **Rate limits key on the admin uid.** Keyed on IP they would share a
 *    bucket with `/api/orders/place`, and a till on the shop wifi would 429
 *    in-store customers browsing on the same NAT address.
 *  - **Coupons are refused at the counter** in this version. Discounting a
 *    walk-in is a conversation, not a code.
 *  - **Prices come from Firestore, never the body.** The counter UI sends ids
 *    and quantities; every rupee is recomputed here.
 */
import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb, firebaseAdminConfigured } from '../_lib/firebaseAdmin.js';
import { computeBreakdown } from '../_lib/pricing.js';
import { decrementStockInTx } from '../_lib/stock.js';
import { counterPlaceOfSupply } from '../_lib/sellerLegal.js';
import { handleCorsPreflight, rejectDisallowedOrigin } from '../_lib/cors.js';
import { validateCsrfToken } from '../_lib/csrf.js';
import { rateLimited, rateLimitHeaders } from '../_lib/rateLimit.js';
import { readJson, header, type ApiRequest, type ApiResponse } from '../_lib/http.js';
import { verifyIdToken } from '../_lib/auth.js';
import { withSentry } from '../_lib/sentry.js';

/** No COD at a counter — the piece is handed over as it is paid for. */
const COUNTER_PAYMENT_METHODS = ['cash', 'upi', 'card'] as const;
type CounterPaymentMethod = typeof COUNTER_PAYMENT_METHODS[number];

/** A ticket is a handful of pieces, not a warehouse transfer. */
const MAX_LINES = 50;
const MAX_QTY_PER_LINE = 999;
const NAME_MAX = 128;
const PHONE_MAX = 32;

/** Bursts on one till. The hourly rule is the one that catches a stuck retry loop. */
const PER_MINUTE = { window: 60, max: 20 };
const PER_HOUR = { window: 3600, max: 300 };

interface Body {
  sale?: {
    items?: { fabricId?: unknown; quantity?: unknown; color?: unknown }[];
    paymentMethod?: unknown;
    saleKey?: unknown;
    customer?: { name?: unknown; phone?: unknown };
  };
}

const clean = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

/**
 * Idempotency key for one ticket.
 *
 * Salted with the operator's uid so two tills cannot collide on a client-chosen
 * value, and hashed so an arbitrary client string can never shape a document
 * path. The counter mints one UUID per ticket and holds it across retries, so a
 * double-tap or a flaky connection reprints the same invoice instead of
 * charging twice.
 */
const lockIdFor = (uid: string, saleKey: string): string =>
  crypto.createHash('sha256').update(`${uid}:${saleKey}`).digest('hex').slice(0, 40);

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
  // The keyless path can verify tokens but cannot write, and 503 beats a 500
  // in the middle of a sale.
  if (!firebaseAdminConfigured()) {
    res.status(503).json({ error: 'pos_not_configured' });
    return;
  }

  let db: ReturnType<typeof getDb>;
  try {
    db = getDb();
  } catch (err) {
    console.error('[pos/sale] admin init failed:', err instanceof Error ? err.message : err);
    res.status(503).json({ error: 'pos_not_configured' });
    return;
  }

  // Identity BEFORE rate limiting, because the limit is per operator. An
  // unauthenticated caller never reaches a counter bucket at all.
  const decoded = await verifyIdToken(header(req, 'authorization'));
  if (!decoded?.uid) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  if (decoded.admin !== true) {
    // The single most important negative in this file: a signed-in customer
    // must not be able to ring up a sale, price a piece, or move stock.
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  const uid = decoded.uid;

  for (const [k, v] of Object.entries(rateLimitHeaders(PER_MINUTE))) res.setHeader(k, v);
  if (await rateLimited(req, PER_MINUTE, `pos:${uid}`) || await rateLimited(req, PER_HOUR, `posh:${uid}`)) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  let body: Body;
  try {
    body = readJson<Body>(req);
  } catch {
    res.status(400).json({ error: 'invalid_json' });
    return;
  }

  const sale = body.sale;
  if (!sale || !Array.isArray(sale.items) || sale.items.length === 0) {
    res.status(400).json({ error: 'empty_cart' });
    return;
  }
  if (sale.items.length > MAX_LINES) {
    res.status(400).json({ error: 'too_many_lines' });
    return;
  }

  const paymentMethod = sale.paymentMethod as CounterPaymentMethod;
  if (!COUNTER_PAYMENT_METHODS.includes(paymentMethod)) {
    res.status(400).json({ error: 'invalid_payment_method' });
    return;
  }

  const saleKey = clean(sale.saleKey, 128);
  if (!saleKey) {
    // Without it a retry becomes a second sale and a second invoice, so it is
    // required rather than defaulted.
    res.status(400).json({ error: 'sale_key_required' });
    return;
  }

  const items: { fabricId: string; quantity: number; color?: string }[] = [];
  for (const raw of sale.items) {
    const fabricId = clean(raw?.fabricId, 128);
    const quantity = Number(raw?.quantity);
    if (!fabricId || !Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_QTY_PER_LINE) {
      res.status(400).json({ error: 'invalid_line' });
      return;
    }
    const color = clean(raw?.color, 64);
    items.push({ fabricId, quantity, ...(color ? { color } : {}) });
  }

  const customerName = clean(sale.customer?.name, NAME_MAX);
  const customerPhone = clean(sale.customer?.phone, PHONE_MAX);

  try {
    // Authoritative pricing. No paymentMethod is passed at all — 'cash' has no
    // meaning to the pricing rules, and `channel: 'in-store'` already zeroes
    // shipping and the COD surcharge.
    const breakdown = await computeBreakdown(db, { items, channel: 'in-store' });

    // Line snapshots from authoritative data, matching the shape the invoice,
    // order history and emails already read.
    const productRefs = breakdown.lines.map(l => db.collection('products').doc(l.fabricId));
    const productSnaps = await Promise.all(productRefs.map(ref => ref.get()));
    const itemsForDoc = breakdown.lines.map((line, i) => {
      const data = (productSnaps[i]?.data() ?? {}) as Record<string, unknown>;
      return {
        fabricId: line.fabricId,
        quantity: line.quantity,
        ...(line.color ? { color: line.color } : {}),
        fabricSnapshot: { id: line.fabricId, ...data },
      };
    });

    const place = counterPlaceOfSupply();
    const placedAt = new Date().toISOString();
    const orderData: Record<string, unknown> = {
      // NO userId. See the header note — this is deliberate, not an omission.
      items: itemsForDoc,
      subtotal: breakdown.subtotal,
      tax: breakdown.tax,
      shipping: breakdown.shipping,
      total: breakdown.total,
      shippingAddress: {
        fullName: customerName || 'Counter sale',
        email: '',
        phone: customerPhone,
        line1: '',
        city: place.city,
        state: place.state,
        postalCode: '',
        country: place.country,
      },
      paymentMethod,
      channel: 'in-store',
      counterStaffUid: uid,
      placedAt,
      // Handed over and paid for at the same moment, so both states are final
      // on creation rather than something anyone has to remember to update.
      status: 'delivered',
      paymentStatus: 'paid',
      deliveredAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    };

    const lockRef = db.collection('posSales').doc(lockIdFor(uid, saleKey));

    const result = await db.runTransaction(async (tx) => {
      // Every read first — Firestore requires reads to precede writes.
      const lockSnap = await tx.get(lockRef);
      if (lockSnap.exists) {
        // Same ticket, submitted again: reprint, never re-charge.
        return { orderId: String(lockSnap.data()?.orderId ?? ''), alreadyProcessed: true };
      }

      await decrementStockInTx(tx, db, items.map(i => ({ fabricId: i.fabricId, quantity: i.quantity })));

      const orderRef = db.collection('orders').doc();
      tx.set(orderRef, orderData);
      tx.create(lockRef, {
        orderId: orderRef.id,
        counterStaffUid: uid,
        total: breakdown.total,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { orderId: orderRef.id, alreadyProcessed: false };
    });

    if (result.alreadyProcessed) {
      const existing = await db.collection('orders').doc(result.orderId).get();
      res.status(200).json({
        ok: true,
        alreadyProcessed: true,
        orderId: result.orderId,
        // Serve the order as stored, so a reprint shows what was actually sold
        // rather than what the retry happened to ask for.
        order: existing.exists ? { id: existing.id, ...existing.data(), deliveredAt: undefined, createdAt: undefined } : null,
      });
      return;
    }

    // Return the order so the counter can render and print the tax invoice
    // immediately. Server timestamps are not readable until the write settles,
    // and the invoice only needs `placedAt`, so they are left out.
    res.status(200).json({
      ok: true,
      alreadyProcessed: false,
      orderId: result.orderId,
      order: { ...orderData, id: result.orderId, deliveredAt: undefined, createdAt: undefined },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sale_failed';
    if (message.startsWith('insufficient_stock:')) {
      const fabricId = message.slice('insufficient_stock:'.length);
      const snap = await db.collection('products').doc(fabricId).get().catch(() => null);
      const available = typeof snap?.data()?.stock === 'number' ? (snap.data()!.stock as number) : 0;
      const requested = items.find(i => i.fabricId === fabricId)?.quantity ?? 0;
      // Tell the operator what is actually on the shelf, so they can correct
      // the ticket at the counter instead of reloading to find out.
      res.status(409).json({ error: message, fabricId, requested, available });
      return;
    }
    if (
      message.startsWith('unknown_product') ||
      message === 'empty_cart' ||
      message === 'invalid_line' ||
      message === 'product_price_unavailable'
    ) {
      res.status(400).json({ error: message });
      return;
    }
    console.error('[pos/sale] failed', message);
    res.status(500).json({ error: 'sale_failed' });
  }
}

export default withSentry(handler);
