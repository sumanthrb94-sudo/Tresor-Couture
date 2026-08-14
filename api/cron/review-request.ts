// GET /api/cron/review-request — daily Vercel cron.
//
// Finds orders delivered REVIEW_REQUEST_DAYS ago (default 3) that have not
// been asked yet, sends one review-request email per order via Brevo with the
// Google review link, and stamps reviewRequestSentAt so an order is never
// asked twice. This is the engine behind the "0 → 25 Google reviews" goal:
// review count is the dominant local-pack ranking factor, and asking at the
// moment the piece has arrived is when customers actually say yes.
//
// Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` on cron
// invocations when the CRON_SECRET env var is set. The handler refuses to run
// without a configured secret — an unauthenticated mass-mail endpoint is not
// an acceptable failure mode, so "not configured" fails closed.
//
// Config:
//   CRON_SECRET          required — shared secret, checked on every call
//   GOOGLE_REVIEW_URL    required — the g.page/… "write a review" short link
//   REVIEW_REQUEST_DAYS  optional — days after delivery to ask (default 3)
//
// Firestore constraint: the free tier has no composite indexes, so the query
// is a single equality (status == 'delivered'); the date window and the
// already-asked filter run in JS. Volumes here are tens of orders, not
// millions.
import { getDb } from '../_lib/firebaseAdmin.js';
import { withSentry } from '../_lib/sentry.js';

const BATCH_LIMIT = 40; // Brevo free tier is 300 mails/day — stay far under it.

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

async function brevoSend(to: { email: string; name?: string }, reviewUrl: string, firstName: string, orderId: string): Promise<void> {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY is not configured');
  const sender = {
    email: process.env.BREVO_SENDER_EMAIL || 'care@tresorcouture.in',
    name: process.env.BREVO_SENDER_NAME || 'Tresor Couture',
  };
  const name = escapeHtml(firstName);
  const url = escapeHtml(reviewUrl);
  const html = `<!doctype html><html><body style="margin:0;background:#FBF7EE;font-family:Georgia,'Times New Roman',serif;color:#2A1F12;">
  <div style="max-width:560px;margin:0 auto;padding:28px 22px;">
    <h1 style="font-size:22px;letter-spacing:.04em;margin:0 0 4px;">TRESOR COUTURE</h1>
    <p style="color:#8A7656;font-size:12px;text-transform:uppercase;letter-spacing:.18em;margin:0 0 20px;">How did we do?</p>
    <p style="font-size:15px;">Dear ${name}, your order has been with you a few days now — we hope the piece is everything you wanted.</p>
    <p style="font-size:15px;">If you have a minute, a Google review helps other brides and shoppers find our atelier. It genuinely makes a difference to a small studio.</p>
    <p style="margin:24px 0;">
      <a href="${url}" style="background:#2A1F12;color:#FBF7EE;text-decoration:none;padding:12px 22px;font-family:Arial,sans-serif;font-size:14px;letter-spacing:.06em;">WRITE A REVIEW</a>
    </p>
    <p style="font-size:13px;color:#5D4E36;">If anything is not right, reply to this email instead — we read every message and we will fix it.</p>
    <p style="font-size:11px;color:#A2917A;margin-top:24px;border-top:1px solid #EEE6D6;padding-top:12px;">Order ${escapeHtml(orderId)} · You received this because you ordered from tresorcouture.in.</p>
  </div></body></html>`;
  const text = `Dear ${firstName},\n\nYour Tresor Couture order has been with you a few days — we hope you love it.\nA Google review helps other shoppers find our atelier: ${reviewUrl}\n\nIf anything is not right, just reply to this email.\n\n— Tresor Couture (order ${orderId})`;

  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender, to: [to], subject: 'How is your Tresor Couture piece?', htmlContent: html, textContent: text }),
  });
  if (!r.ok) throw new Error(`brevo email ${r.status}: ${await r.text()}`);
}

/** deliveredAt is a Firestore Timestamp; tolerate ISO strings from older docs. */
function toMillis(v: unknown): number | null {
  if (v && typeof (v as { toMillis?: () => number }).toMillis === 'function') {
    return (v as { toMillis: () => number }).toMillis();
  }
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return res.status(503).json({ error: 'cron_secret_not_configured' });
  const auth = String(req.headers['authorization'] ?? '');
  if (auth !== `Bearer ${secret}`) return res.status(401).json({ error: 'unauthorized' });

  const reviewUrl = process.env.GOOGLE_REVIEW_URL?.trim();
  if (!reviewUrl) return res.status(200).json({ ok: true, skipped: 'GOOGLE_REVIEW_URL not configured' });

  const days = Math.max(1, Number(process.env.REVIEW_REQUEST_DAYS) || 3);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  try {
    const db = getDb();
    // Single-equality query only — no composite indexes on this project.
    const snap = await db.collection('orders').where('status', '==', 'delivered').get();

    let sent = 0;
    const errors: string[] = [];
    for (const doc of snap.docs) {
      if (sent >= BATCH_LIMIT) break;
      const o = doc.data() as Record<string, unknown>;
      if (o.reviewRequestSentAt) continue;                 // asked already
      const deliveredAt = toMillis(o.deliveredAt);
      if (deliveredAt === null || deliveredAt > cutoff) continue; // too recent / unknown
      const addr = (o.shippingAddress ?? {}) as Record<string, unknown>;
      const email = typeof addr.email === 'string' ? addr.email.trim() : '';
      if (!email) continue;
      const firstName = (typeof addr.fullName === 'string' && addr.fullName.trim().split(/\s+/)[0]) || 'there';

      try {
        await brevoSend({ email, name: String(addr.fullName ?? '') }, reviewUrl, firstName, doc.id);
        // Stamp AFTER a successful send; a failed send retries tomorrow.
        await doc.ref.update({ reviewRequestSentAt: new Date().toISOString() });
        sent += 1;
      } catch (err) {
        errors.push(`${doc.id}: ${(err as Error).message}`);
      }
    }

    return res.status(200).json({ ok: true, sent, scanned: snap.size, ...(errors.length ? { errors } : {}) });
  } catch (err) {
    console.error('[cron/review-request]', (err as Error).message);
    return res.status(500).json({ error: 'internal' });
  }
}

export default withSentry(handler as never);
