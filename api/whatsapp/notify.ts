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
//
// SELF-CONTAINED: no relative imports (the project is ESM, which can't resolve
// extensionless relative imports — that crashes the function at cold start).

import { handleCorsPreflight, rejectDisallowedOrigin } from '../_lib/cors.js';
import { validateCsrfToken } from '../_lib/csrf.js';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tresor-couture';

function rupee(n: number): string {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
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

/** Send a WhatsApp template message via the Meta Cloud API. No-ops (false)
 *  until WHATSAPP_TOKEN, WHATSAPP_PHONE_ID and a template name are set. */
async function whatsappSendTemplate(args: { to: string; params: string[]; languageCode?: string }): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const template = process.env.WHATSAPP_TEMPLATE;
  const to = (args.to || '').replace(/[^\d]/g, '');
  if (!token || !phoneId || !template || !to) return false;

  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: template,
        language: { code: args.languageCode || process.env.WHATSAPP_LANG || 'en' },
        components: [{ type: 'body', parameters: args.params.map(text => ({ type: 'text', text: String(text) })) }],
      },
    }),
  });
  if (!r.ok) throw new Error(`whatsapp ${r.status}: ${await r.text()}`);
  return true;
}

export default async function handler(req: any, res: any) {
  if (handleCorsPreflight(req, res, 'POST, OPTIONS')) return;
  if (rejectDisallowedOrigin(req, res)) return;
  if (!validateCsrfToken(req, res)) {
    return res.status(403).json({ error: 'csrf_token_invalid' });
  }
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
