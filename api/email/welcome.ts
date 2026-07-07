// POST /api/email/welcome — branded welcome email on new signup.
// Auth: Firebase ID token; recipient forced to the user's own verified email.
// Body: { name? }. Uses BREVO_WELCOME_TEMPLATE_ID if set, else inline HTML.
//
// SELF-CONTAINED: no relative imports (the project is ESM, which can't resolve
// extensionless relative imports — that crashes the function at cold start).

import { handleCorsPreflight, rejectDisallowedOrigin } from '../_lib/cors.js';
import { validateCsrfToken } from '../_lib/csrf.js';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tresor-couture';

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

// Keyless: firebase-admin verifies the token against Google's public keys with
// only a projectId — no service-account key (org policy blocks key creation).
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
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  templateId?: number;
  params?: Record<string, unknown>;
}): Promise<void> {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY is not configured');
  const sender = {
    email: process.env.BREVO_SENDER_EMAIL || 'no-reply@tresorcouture.in',
    name: process.env.BREVO_SENDER_NAME || 'Tresor Couture',
  };
  const body = args.templateId
    ? { sender, to: [args.to], templateId: args.templateId, params: args.params ?? {} }
    : { sender, to: [args.to], subject: args.subject, htmlContent: args.htmlContent, textContent: args.textContent };
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`brevo email ${r.status}: ${await r.text()}`);
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
    const name = String(body.name || decoded.name || decoded.email.split('@')[0]);
    const first = escapeHtml(name.split(' ')[0]);
    const templateId = process.env.BREVO_WELCOME_TEMPLATE_ID ? Number(process.env.BREVO_WELCOME_TEMPLATE_ID) : undefined;

    const html = `<!doctype html><html><body style="margin:0;background:#FBF7EE;font-family:Georgia,'Times New Roman',serif;color:#2A1F12;">
      <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
        <h1 style="font-size:24px;letter-spacing:.04em;margin:0 0 6px;">TRESOR COUTURE</h1>
        <p style="color:#8A7656;font-size:12px;text-transform:uppercase;letter-spacing:.18em;margin:0 0 22px;">Welcome to the atelier</p>
        <p style="font-size:16px;">Dear ${first}, welcome to Tresor Couture.</p>
        <p style="font-size:15px;line-height:1.6;color:#3a3026;">You now have access to our ledger of heritage Indian weaves — Banarasi, Patola, Jamdani, Kanjivaram and more — shipped worldwide. As a member you get a saved wishlist, faster checkout, and early access to bridal drops.</p>
        <p style="font-size:15px;line-height:1.6;color:#3a3026;">Here is <b>10% off your first order</b> with code <b style="letter-spacing:.05em;">WELCOME10</b>.</p>
        <p style="margin-top:24px;"><a href="https://tresorcouture.in/#/shop" style="background:#7A1F2C;color:#fff;text-decoration:none;padding:12px 22px;border-radius:4px;font-family:Arial,sans-serif;font-size:14px;">Explore the collection</a></p>
        <p style="font-size:12px;color:#8A7656;margin-top:28px;">Hand-woven heritage · free shipping over ₹1,999 · dispatched within 48 hours.</p>
      </div></body></html>`;

    await brevoSendEmail({
      to: { email: decoded.email, name },
      subject: 'Welcome to Tresor Couture',
      htmlContent: html,
      textContent: `Welcome to Tresor Couture, ${name}. Enjoy 10% off your first order with code WELCOME10. Explore: https://tresorcouture.in/#/shop`,
      templateId,
      params: { FIRSTNAME: first, COUPON: 'WELCOME10' },
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[api/email/welcome]', (err as Error).message);
    return res.status(200).json({ ok: false });
  }
}
