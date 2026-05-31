// POST /api/whatsapp/notify — WhatsApp order notification via Meta Cloud API.
//
// Auth: requires a valid Firebase ID token. By default it alerts the STORE
// (WHATSAPP_ADMIN_TO) of a new order — that avoids the customer opt-in /
// template-approval friction for v1. Customer notifications can reuse the same
// helper once a customer-facing template is approved.
//
// Body: { order: { id, total, customerName? } }
// Dormant (returns ok:false) until WHATSAPP_TOKEN/WHATSAPP_PHONE_ID/template
// and WHATSAPP_ADMIN_TO are configured in Vercel.

import { setCors, verifyIdToken, whatsappSendTemplate, rupee } from '../_lib/util';

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const decoded = await verifyIdToken(req.headers['authorization']);
  if (!decoded) return res.status(401).json({ error: 'unauthorized' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const order = body.order || {};
    const to = process.env.WHATSAPP_ADMIN_TO || '';
    const name = String(order.customerName || decoded.name || decoded.email || 'Customer');
    // Template body variables, in order: {{1}} customer, {{2}} order id, {{3}} total
    const sent = await whatsappSendTemplate({
      to,
      params: [name, String(order.id || ''), rupee(Number(order.total) || 0)],
    });
    return res.status(200).json({ ok: sent });
  } catch (err) {
    console.error('[api/whatsapp/notify]', (err as Error).message);
    return res.status(200).json({ ok: false }); // best-effort; never block the order
  }
}
