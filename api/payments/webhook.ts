/**
 * POST /api/payments/webhook  — Razorpay server-to-server webhook.
 *
 * Defense-in-depth backstop to /verify: if the browser closes before the
 * verify call lands (network drop, tab close), Razorpay still notifies us
 * here so the order can be reconciled. Register this URL in the Razorpay
 * Dashboard (Settings → Webhooks) for the `payment.captured` event with the
 * secret stored in RAZORPAY_WEBHOOK_SECRET.
 *
 * Signature: HMAC_SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET) === X-Razorpay-Signature.
 *
 * This handler marks an EXISTING order (matched by razorpay order/payment id)
 * as paid if /verify hasn't already. It does NOT create new orders or
 * decrement stock — it lacks the cart/address context and the rich product
 * snapshot that /verify builds; it only reconciles payment state. Orders that
 * were never created client-side surface as unmatched and should be handled
 * manually from the dashboard.
 *
 * Vercel parses JSON bodies by default, which would break HMAC verification
 * (re-serialised JSON differs byte-for-byte). We disable the body parser via
 * the exported `config` and read the raw stream ourselves.
 */
import type { IncomingMessage } from 'node:http';
import { getDb, firebaseAdminConfigured } from '../_lib/firebaseAdmin.js';
import { verifyWebhookSignature } from '../_lib/razorpay.js';
import { header, type ApiRequest, type ApiResponse } from '../_lib/http.js';

// Tell Vercel NOT to parse the body so we can verify the raw bytes.
export const config = { api: { bodyParser: false } };

function readRawBody(req: ApiRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    // The Vercel request object is also a Node readable stream.
    const stream = req as unknown as IncomingMessage;
    let data = '';
    stream.on('data', (chunk: Buffer | string) => {
      data += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    });
    stream.on('end', () => resolve(data));
    stream.on('error', reject);
  });
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  if (!firebaseAdminConfigured() || !process.env.RAZORPAY_WEBHOOK_SECRET) {
    res.status(503).json({ error: 'payments_not_configured' });
    return;
  }

  let raw: string;
  try {
    raw = await readRawBody(req);
  } catch {
    res.status(400).json({ error: 'body_read_failed' });
    return;
  }

  const signature = header(req, 'x-razorpay-signature');
  if (!verifyWebhookSignature(raw, signature)) {
    res.status(400).json({ error: 'signature_mismatch' });
    return;
  }

  let event: {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string; status?: string } } };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    res.status(400).json({ error: 'invalid_json' });
    return;
  }

  // We only act on successful captures. Acknowledge everything else with 200
  // so Razorpay stops retrying.
  const payment = event.payload?.payment?.entity;
  if (event.event !== 'payment.captured' || !payment?.id) {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  try {
    const db = getDb();
    // Match an order already created by /verify; reconcile its payment state.
    const byPayment = await db.collection('orders').where('paymentId', '==', payment.id).limit(1).get();
    if (!byPayment.empty) {
      res.status(200).json({ ok: true, reconciled: byPayment.docs[0]!.id });
      return;
    }
    let matched = byPayment;
    if (matched.empty && payment.order_id) {
      matched = await db.collection('orders').where('razorpayOrderId', '==', payment.order_id).limit(1).get();
    }
    if (!matched.empty) {
      const doc = matched.docs[0]!;
      await doc.ref.set(
        { paymentStatus: 'paid', paymentId: payment.id, paymentProvider: 'razorpay', status: 'placed' },
        { merge: true },
      );
      res.status(200).json({ ok: true, reconciled: doc.id });
      return;
    }

    // No matching order: the browser never completed /verify. Record the
    // orphan payment for manual reconciliation rather than silently dropping.
    await db.collection('payment_events').add({
      provider: 'razorpay',
      event: event.event,
      paymentId: payment.id,
      razorpayOrderId: payment.order_id ?? null,
      status: payment.status ?? null,
      receivedAt: new Date().toISOString(),
      reconciled: false,
    });
    res.status(200).json({ ok: true, orphan: true });
  } catch (err) {
    console.error('[webhook] failed', err instanceof Error ? err.message : err);
    // Return 500 so Razorpay retries delivery.
    res.status(500).json({ error: 'webhook_failed' });
  }
}
