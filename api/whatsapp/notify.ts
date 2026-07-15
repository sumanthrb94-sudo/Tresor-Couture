// POST /api/whatsapp/notify — WhatsApp order notification via Meta Cloud API.
//
// Auth: requires a valid Firebase ID token AND the `admin` custom claim.
// By default it alerts the STORE (WHATSAPP_ADMIN_TO) of a new order.
//
// Body: { order: { id, total, customerName? } }
// Dormant (returns ok:false) until WHATSAPP_TOKEN/WHATSAPP_PHONE_ID/template
// and WHATSAPP_ADMIN_TO are configured in Vercel.
//
// SELF-CONTAINED: no relative imports (the project is ESM, which can't resolve
// extensionless relative imports — that crashes the function at cold start).

import { handleCorsPreflight, rejectDisallowedOrigin } from '../_lib/cors.js';
import { validateCsrfToken } from '../_lib/csrf.js';
import { rateLimited, rateLimitHeaders } from '../_lib/rateLimit.js';
import { verifyIdToken } from '../_lib/auth.js';
import { withSentry } from '../_lib/sentry.js';

function rupee(n: number): string {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
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

async function handler(req: any, res: any) {
  if (handleCorsPreflight(req, res, 'POST, OPTIONS')) return;
  if (rejectDisallowedOrigin(req, res)) return;
  if (!validateCsrfToken(req, res)) {
    return res.status(403).json({ error: 'csrf_token_invalid' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const decoded = await verifyIdToken(req.headers['authorization']);
  if (!decoded?.uid || decoded.admin !== true) {
    return res.status(403).json({ error: 'forbidden' });
  }

  // Limit to 10 notifications per admin per hour to prevent spam/abuse.
  const notifyRateLimit = { window: 3600, max: 10 };
  for (const [k, v] of Object.entries(rateLimitHeaders(notifyRateLimit))) {
    res.setHeader(k, v);
  }
  if (await rateLimited(req, notifyRateLimit, decoded.uid)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const order = body.order || {};
    const to = process.env.WHATSAPP_ADMIN_TO || '';
    const name = String(order.customerName || decoded.email || 'Customer');
    // Template body variables, in order: {{1}} customer, {{2}} order id, {{3}} total
    const sent = await whatsappSendTemplate({
      to,
      params: [name, String(order.id || ''), rupee(Number(order.total) || 0)],
    });
    return res.status(200).json({ ok: sent });
  } catch (err) {
    console.error('[api/whatsapp/notify]', (err as Error).message);
    return res.status(502).json({ ok: false, error: 'notify_failed' });
  }
}

export default withSentry(handler as any);
