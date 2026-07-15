// POST /api/email/order — send the order-confirmation email via Brevo.
//
// Auth: requires a valid Firebase ID token (Authorization: Bearer <token>).
// The recipient is forced to the authenticated user's own verified email, so
// this endpoint can't be used to send mail to arbitrary addresses.
//
// Body: { order: { id, items:[{name, brand?, quantity, color?, price}],
//                  subtotal, shipping, tax, total, couponCode?, couponDiscount?,
//                  shippingAddress:{fullName,line1,line2?,city,state,postalCode} },
//         name? }
//
import { handleCorsPreflight, rejectDisallowedOrigin } from '../_lib/cors.js';
import { validateCsrfToken } from '../_lib/csrf.js';
import { getDb } from '../_lib/firebaseAdmin.js';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tresor-couture';

function rupee(n: number): string {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

let _adminAuth: any = null;
async function verifyIdToken(authHeader: string | undefined): Promise<any | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!token) return null;
  try {
    if (!_adminAuth) {
      const { getApps, initializeApp } = await import('firebase-admin/app');
      const { getAuth } = await import('firebase-admin/auth');
      const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
      _adminAuth = getAuth(app);
    }
    return await _adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }
}

async function brevoSendEmail(args: {
  to: { email: string; name?: string };
  subject: string;
  htmlContent: string;
  textContent: string;
}): Promise<void> {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY is not configured');
  const sender = {
    email: process.env.BREVO_SENDER_EMAIL || 'no-reply@tresorcouture.in',
    name: process.env.BREVO_SENDER_NAME || 'Tresor Couture',
  };
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender, to: [args.to], subject: args.subject, htmlContent: args.htmlContent, textContent: args.textContent }),
  });
  if (!r.ok) throw new Error(`brevo email ${r.status}: ${await r.text()}`);
}

function renderEmail(order: Record<string, unknown>, customerName: string): { subject: string; html: string; text: string } {
  const rawItems = Array.isArray(order.items) ? order.items : [];
  const items = rawItems.map((it: any) => {
    const snap = it.fabricSnapshot || {};
    return {
      name: escapeHtml(String(snap.name || snap.brand || 'Fabric')),
      brand: escapeHtml(String(snap.brand || '')),
      quantity: Number(it.quantity) || 0,
      color: it.color ? escapeHtml(String(it.color)) : '',
      price: Number(snap.price) || 0,
    };
  });
  const rows = items.map((it) => {
    const meta = [it.quantity ? `Qty ${it.quantity}` : '', it.color].filter(Boolean).join(' · ');
    const line = it.price * it.quantity;
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #EEE6D6;">${it.name}<br><span style="color:#8A7656;font-size:12px;">${meta}</span></td>
      <td style="padding:8px 0;border-bottom:1px solid #EEE6D6;text-align:right;white-space:nowrap;">${rupee(line)}</td>
    </tr>`;
  }).join('');

  const a = (order.shippingAddress || {}) as Record<string, unknown>;
  const addr = [a.fullName, a.line1, a.line2, a.city, a.state, a.postalCode]
    .filter((v): v is string => typeof v === 'string')
    .map(escapeHtml)
    .join(', ');
  const id = escapeHtml(String(order.id || ''));

  const html = `<!doctype html><html><body style="margin:0;background:#FBF7EE;font-family:Georgia,'Times New Roman',serif;color:#2A1F12;">
  <div style="max-width:560px;margin:0 auto;padding:28px 22px;">
    <h1 style="font-size:22px;letter-spacing:.04em;margin:0 0 4px;">TRESOR COUTURE</h1>
    <p style="color:#8A7656;font-size:12px;text-transform:uppercase;letter-spacing:.18em;margin:0 0 20px;">Order confirmed</p>
    <p style="font-size:15px;">Dear ${escapeHtml(customerName)}, thank you for your order. We have received it and our atelier is preparing your weaves.</p>
    <p style="font-size:13px;color:#5D4E36;">Order reference: <b>${id}</b></p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-family:Arial,sans-serif;font-size:14px;">${rows}</table>
    <table style="width:100%;font-family:Arial,sans-serif;font-size:14px;">
      <tr><td>Subtotal</td><td style="text-align:right;">${rupee(Number(order.subtotal) || 0)}</td></tr>
      ${Number(order.couponDiscount) ? `<tr><td>Discount${order.couponCode ? ` (${escapeHtml(String(order.couponCode))})` : ''}</td><td style="text-align:right;color:#1F5D4F;">- ${rupee(Number(order.couponDiscount))}</td></tr>` : ''}
      <tr><td>Shipping</td><td style="text-align:right;">${Number(order.shipping) ? rupee(Number(order.shipping)) : 'FREE'}</td></tr>
      <tr><td>GST</td><td style="text-align:right;">${rupee(Number(order.tax) || 0)}</td></tr>
      <tr><td style="padding-top:8px;font-weight:bold;">Total</td><td style="padding-top:8px;text-align:right;font-weight:bold;">${rupee(Number(order.total) || 0)}</td></tr>
    </table>
    <p style="font-size:13px;color:#5D4E36;">Delivering to: ${addr}</p>
    <p style="font-size:13px;color:#5D4E36;">Payment: Cash on Delivery.</p>
    <p style="font-size:12px;color:#8A7656;margin-top:24px;">Dispatched within 48 hours · free shipping over ₹1,999.</p>
  </div></body></html>`;

  const text = `TRESOR COUTURE — Order confirmed\nOrder ${id}\nTotal: ${rupee(Number(order.total) || 0)}\nDelivering to: ${addr}\nPayment: Cash on Delivery.\nThank you for your order.`;
  return { subject: `Your Tresor Couture order ${id} is confirmed`, html, text };
}

export default async function handler(req: any, res: any) {
  if (handleCorsPreflight(req, res, 'POST, OPTIONS')) return;
  if (rejectDisallowedOrigin(req, res)) return;
  if (!validateCsrfToken(req, res)) {
    return res.status(403).json({ error: 'csrf_token_invalid' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const decoded = await verifyIdToken(req.headers['authorization']);
  if (!decoded?.email) return res.status(401).json({ error: 'unauthorized' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const submitted = body.order;
    if (!submitted || !submitted.id) return res.status(400).json({ error: 'missing_order' });

    // Verify the order exists and belongs to the caller before rendering an email.
    const db = getDb();
    const orderDoc = await db.collection('orders').doc(String(submitted.id)).get();
    if (!orderDoc.exists) return res.status(404).json({ error: 'order_not_found' });
    const orderData = orderDoc.data() as Record<string, unknown> | undefined;
    if (orderData?.userId !== decoded.uid) return res.status(403).json({ error: 'forbidden' });

    const name = String(body.name || decoded.name || decoded.email.split('@')[0]);
    const { subject, html, text } = renderEmail(orderData, name);
    // Recipient is the authenticated user's verified email — no spoofing.
    await brevoSendEmail({ to: { email: decoded.email, name }, subject, htmlContent: html, textContent: text });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[api/email/order]', (err as Error).message);
    return res.status(200).json({ ok: false }); // best-effort; never block the order
  }
}
