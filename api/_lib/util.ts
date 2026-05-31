// Shared helpers for Vercel serverless functions.
//
// Keyless by design: Firebase ID tokens are verified with the Admin SDK
// initialised with ONLY a projectId — token verification fetches Google's
// public keys over HTTPS and needs no service-account key (which org policy
// blocks anyway). Secrets (Brevo) live in Vercel env, never in the client.

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tresor-couture';

// firebase-admin is imported and initialised LAZILY (inside verifyIdToken),
// not at module load — so endpoints that don't need auth (e.g. /api/contact)
// can never be taken down by an admin-SDK load/init issue.
let _adminAuth: any = null;
async function getAdminAuth(): Promise<any> {
  if (_adminAuth) return _adminAuth;
  const { getApps, initializeApp } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
  _adminAuth = getAuth(app);
  return _adminAuth;
}

export function setCors(res: any): void {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/** Verify a Firebase ID token (keyless). Returns the decoded token or null. */
export async function verifyIdToken(authHeader: string | undefined): Promise<any | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!token) return null;
  try {
    const adminAuth = await getAdminAuth();
    return await adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }
}

const BREVO = 'https://api.brevo.com/v3';

function brevoHeaders() {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY is not configured');
  return { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' };
}

/**
 * Send a transactional email via Brevo. If `templateId` is given, Brevo's own
 * template is used (design it in Brevo, pass `params` for {{ params.x }}); else
 * the inline subject/htmlContent is sent. This lets you swap to Brevo-designed
 * templates later by setting the *_TEMPLATE_ID env vars — no code change.
 */
export async function brevoSendEmail(args: {
  to: { email: string; name?: string };
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  templateId?: number;
  params?: Record<string, unknown>;
}): Promise<void> {
  const sender = {
    email: process.env.BREVO_SENDER_EMAIL || 'no-reply@tresorcouture.in',
    name: process.env.BREVO_SENDER_NAME || 'Tresor Couture',
  };
  const body = args.templateId
    ? { sender, to: [args.to], templateId: args.templateId, params: args.params ?? {} }
    : { sender, to: [args.to], subject: args.subject, htmlContent: args.htmlContent, textContent: args.textContent };
  const r = await fetch(`${BREVO}/smtp/email`, { method: 'POST', headers: brevoHeaders(), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`brevo email ${r.status}: ${await r.text()}`);
}

/** Upsert a contact into the marketing list. */
export async function brevoAddContact(email: string, attributes: Record<string, unknown> = {}): Promise<void> {
  const listId = process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined;
  const r = await fetch(`${BREVO}/contacts`, {
    method: 'POST',
    headers: brevoHeaders(),
    body: JSON.stringify({ email, attributes, updateEnabled: true, ...(listId ? { listIds: [listId] } : {}) }),
  });
  // 201 created, 204 updated. Brevo returns 400 "Contact already exist" only
  // when updateEnabled is false — we set it true, so treat <300 as success.
  if (!r.ok && r.status !== 204) throw new Error(`brevo contact ${r.status}: ${await r.text()}`);
}

/**
 * Send a WhatsApp template message via the Meta Cloud API.
 * No-ops (returns false) unless WHATSAPP_TOKEN, WHATSAPP_PHONE_ID and a
 * template name are configured — so it stays dormant until the WhatsApp
 * Business number + approved template are live.
 * The named template must have a BODY with one {{n}} variable per `params`.
 */
export async function whatsappSendTemplate(args: {
  to: string;
  templateName?: string;
  params: string[];
  languageCode?: string;
}): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const template = args.templateName || process.env.WHATSAPP_TEMPLATE;
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

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function rupee(n: number): string {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
