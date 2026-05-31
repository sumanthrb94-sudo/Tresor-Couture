// POST /api/email/order — send the order-confirmation email via Brevo.
//
// Auth: requires a valid Firebase ID token (Authorization: Bearer <token>).
// The recipient is forced to the authenticated user's own verified email, so
// this endpoint can't be used to send mail to arbitrary addresses.
//
// Body: { order: { id, items:[{name, brand?, meters, color?, pricePerMeter}],
//                  subtotal, shipping, tax, total, couponCode?, couponDiscount?,
//                  shippingAddress:{fullName,line1,line2?,city,state,postalCode} },
//         name? }

import { setCors, verifyIdToken, brevoSendEmail, rupee, escapeHtml } from '../_lib/util';

function renderEmail(order: any, customerName: string): { subject: string; html: string; text: string } {
  const items = Array.isArray(order.items) ? order.items : [];
  const rows = items.map((it: any) => {
    const name = escapeHtml(it.name || it.brand || 'Fabric');
    const meta = [it.meters ? `${it.meters} m` : '', it.color ? escapeHtml(it.color) : ''].filter(Boolean).join(' · ');
    const line = (Number(it.pricePerMeter) || 0) * (Number(it.meters) || 0);
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #EEE6D6;">${name}<br><span style="color:#8A7656;font-size:12px;">${meta}</span></td>
      <td style="padding:8px 0;border-bottom:1px solid #EEE6D6;text-align:right;white-space:nowrap;">${rupee(line)}</td>
    </tr>`;
  }).join('');

  const a = order.shippingAddress || {};
  const addr = [a.fullName, a.line1, a.line2, a.city, a.state, a.postalCode].filter(Boolean).map(escapeHtml).join(', ');
  const id = escapeHtml(order.id || '');

  const html = `<!doctype html><html><body style="margin:0;background:#FBF7EE;font-family:Georgia,'Times New Roman',serif;color:#2A1F12;">
  <div style="max-width:560px;margin:0 auto;padding:28px 22px;">
    <h1 style="font-size:22px;letter-spacing:.04em;margin:0 0 4px;">TRESOR COUTURE</h1>
    <p style="color:#8A7656;font-size:12px;text-transform:uppercase;letter-spacing:.18em;margin:0 0 20px;">Order confirmed</p>
    <p style="font-size:15px;">Dear ${escapeHtml(customerName)}, thank you for your order. We have received it and our atelier is preparing your weaves.</p>
    <p style="font-size:13px;color:#5D4E36;">Order reference: <b>${id}</b></p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-family:Arial,sans-serif;font-size:14px;">${rows}</table>
    <table style="width:100%;font-family:Arial,sans-serif;font-size:14px;">
      <tr><td>Subtotal</td><td style="text-align:right;">${rupee(order.subtotal)}</td></tr>
      ${order.couponDiscount ? `<tr><td>Discount${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ''}</td><td style="text-align:right;color:#1F5D4F;">- ${rupee(order.couponDiscount)}</td></tr>` : ''}
      <tr><td>Shipping</td><td style="text-align:right;">${Number(order.shipping) ? rupee(order.shipping) : 'FREE'}</td></tr>
      <tr><td>GST</td><td style="text-align:right;">${rupee(order.tax)}</td></tr>
      <tr><td style="padding-top:8px;font-weight:bold;">Total</td><td style="padding-top:8px;text-align:right;font-weight:bold;">${rupee(order.total)}</td></tr>
    </table>
    <p style="font-size:13px;color:#5D4E36;">Delivering to: ${addr}</p>
    <p style="font-size:13px;color:#5D4E36;">Payment: Cash on Delivery.</p>
    <p style="font-size:12px;color:#8A7656;margin-top:24px;">Hand-cut to the metre · shipped within 48 hours · 40-minute delivery across Hyderabad.</p>
  </div></body></html>`;

  const text = `TRESOR COUTURE — Order confirmed\nOrder ${order.id}\nTotal: ${rupee(order.total)}\nDelivering to: ${addr}\nPayment: Cash on Delivery.\nThank you for your order.`;
  return { subject: `Your Tresor Couture order ${order.id} is confirmed`, html, text };
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const decoded = await verifyIdToken(req.headers['authorization']);
  if (!decoded?.email) return res.status(401).json({ error: 'unauthorized' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const order = body.order;
    if (!order || !order.id) return res.status(400).json({ error: 'missing_order' });

    const name = String(body.name || decoded.name || decoded.email.split('@')[0]);
    const { subject, html, text } = renderEmail(order, name);
    // Recipient is the authenticated user's verified email — no spoofing.
    await brevoSendEmail({ to: { email: decoded.email, name }, subject, htmlContent: html, textContent: text });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[api/email/order]', (err as Error).message);
    return res.status(200).json({ ok: false }); // best-effort; never block the order
  }
}
