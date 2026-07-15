// /api/email/bulk — admin-only bulk marketing via Brevo email campaigns.
//
//   GET   → { lists, senders, configured }  (to populate the composer)
//   POST  → create a Brevo email campaign to a contact list and send it now.
//           Body: { subject, htmlContent, senderEmail, senderName, listId, campaignName? }
//           Returns { ok, campaignId }.
//
// Auth: Firebase ID token AND the `admin` custom claim (same claim the
// Firestore rules use). Non-admins get 403.
//
// SELF-CONTAINED: no relative imports — the project is ESM ("type":"module")
// and Node ESM can't resolve extensionless relative imports, which crashes the
// function at cold start. Helpers are inlined (mirrors api/email/welcome.ts).

import { handleCorsPreflight, rejectDisallowedOrigin } from '../_lib/cors.js';
import { validateCsrfToken } from '../_lib/csrf.js';
import { rateLimited, rateLimitHeaders } from '../_lib/rateLimit.js';
import { withSentry } from '../_lib/sentry.js';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tresor-couture';
const BREVO = 'https://api.brevo.com/v3';

// Keyless admin-token verification (firebase-admin against Google public keys).
let _adminAuth: any = null;
async function verifyAdmin(authHeader: string | undefined): Promise<any | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!token) return null;
  try {
    if (!_adminAuth) {
      const { getApps, initializeApp } = await import('firebase-admin/app');
      const { getAuth } = await import('firebase-admin/auth');
      const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
      _adminAuth = getAuth(app);
    }
    const decoded = await _adminAuth.verifyIdToken(token);
    return decoded?.admin === true ? decoded : null;
  } catch {
    return null;
  }
}

function brevoHeaders(key: string) {
  return { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' };
}

/** Reject HTML that contains obvious active content. This is a defence-in-depth
 *  control on top of the admin gate; Brevo also sanitises, but we never want to
 *  relay script tags or event handlers from the composer. */
function dangerousHtml(html: string): boolean {
  const lowered = html.toLowerCase();
  if (lowered.includes('<script')) return true;
  if (lowered.includes('javascript:')) return true;
  if (/\s(on\w+)\s*=/i.test(html)) return true;
  if (lowered.includes('<iframe')) return true;
  if (lowered.includes('<object')) return true;
  if (lowered.includes('<embed')) return true;
  return false;
}

interface HtmlValidationOk { ok: true; error?: undefined; }
interface HtmlValidationError { ok: false; error: string; }
type HtmlValidation = HtmlValidationOk | HtmlValidationError;
function validateHtmlContent(html: string): HtmlValidation {
  if (!html) return { ok: false, error: 'html_content_required' };
  if (dangerousHtml(html)) return { ok: false, error: 'html_content_forbidden' };
  return { ok: true };
}

async function brevoGet(path: string, key: string): Promise<any> {
  const r = await fetch(`${BREVO}${path}`, { headers: brevoHeaders(key) });
  if (!r.ok) throw new Error(`brevo GET ${path} ${r.status}: ${await r.text()}`);
  return r.json();
}

async function handler(req: any, res: any) {
  if (handleCorsPreflight(req, res, 'GET, POST, OPTIONS')) return;
  if (rejectDisallowedOrigin(req, res)) return;
  if (!validateCsrfToken(req, res)) {
    return res.status(403).json({ error: 'csrf_token_invalid' });
  }

  const admin = await verifyAdmin(req.headers['authorization']);
  if (!admin) return res.status(403).json({ error: 'forbidden' });

  // Limit bulk/campaign actions to 20 per admin per hour.
  const bulkRateLimit = { window: 3600, max: 20 };
  for (const [k, v] of Object.entries(rateLimitHeaders(bulkRateLimit))) {
    res.setHeader(k, v);
  }
  if (await rateLimited(req, bulkRateLimit, `admin:${String(admin.uid)}`)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const key = process.env.BREVO_API_KEY;
  if (!key) return res.status(200).json({ configured: false, error: 'BREVO_API_KEY not set' });

  try {
    // ---- GET: composer metadata (lists + verified senders) ----
    if (req.method === 'GET') {
      const [listsRes, sendersRes] = await Promise.all([
        brevoGet('/contacts/lists?limit=50&sort=desc', key).catch(() => ({ lists: [] })),
        brevoGet('/senders', key).catch(() => ({ senders: [] })),
      ]);
      const lists = (listsRes.lists || []).map((l: any) => ({
        id: l.id, name: l.name, totalSubscribers: l.totalSubscribers ?? l.uniqueSubscribers ?? 0,
      }));
      const senders = (sendersRes.senders || [])
        .filter((s: any) => s.active !== false)
        .map((s: any) => ({ id: s.id, name: s.name, email: s.email }));
      return res.status(200).json({ configured: true, lists, senders });
    }

    // ---- POST: add a contact, send a one-off email, or run a campaign ----
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const action = String(body.action || 'campaign');
      const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

      // (a) Add a single customer email to a Brevo list.
      if (action === 'add-contact') {
        const email = String(body.email || '').trim().toLowerCase().slice(0, 254);
        const listId = Number(body.listId);
        if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid_email' });
        if (!Number.isFinite(listId) || listId <= 0) return res.status(400).json({ error: 'list_required' });
        const attributes: Record<string, unknown> = { SIGNUP_SOURCE: 'admin' };
        if (body.name) attributes.FIRSTNAME = String(body.name).split(' ')[0].slice(0, 64);
        const r = await fetch(`${BREVO}/contacts`, {
          method: 'POST',
          headers: brevoHeaders(key),
          body: JSON.stringify({ email, attributes, listIds: [listId], updateEnabled: true }),
        });
        if (!r.ok && r.status !== 204) return res.status(502).json({ error: 'brevo_contact_failed', detail: await r.text() });
        return res.status(200).json({ ok: true, action: 'add-contact' });
      }

      // (b) Send a one-off email to a single address (also used as a test send).
      if (action === 'send-one') {
        const to = String(body.to || '').trim().toLowerCase().slice(0, 254);
        const subject = String(body.subject || '').trim();
        const htmlContent = String(body.htmlContent || '').trim();
        const senderEmail = String(body.senderEmail || process.env.BREVO_SENDER_EMAIL || '').trim();
        const senderName = String(body.senderName || process.env.BREVO_SENDER_NAME || 'Tresor Couture').trim();
        if (!EMAIL_RE.test(to)) return res.status(400).json({ error: 'invalid_recipient' });
        if (!subject || !htmlContent) return res.status(400).json({ error: 'subject_and_body_required' });
        const htmlCheck = validateHtmlContent(htmlContent);
        if (!htmlCheck.ok) return res.status(400).json({ error: htmlCheck.error });
        if (!senderEmail) return res.status(400).json({ error: 'sender_required' });
        const r = await fetch(`${BREVO}/smtp/email`, {
          method: 'POST',
          headers: brevoHeaders(key),
          body: JSON.stringify({ sender: { name: senderName, email: senderEmail }, to: [{ email: to }], subject, htmlContent }),
        });
        if (!r.ok) return res.status(502).json({ error: 'brevo_send_failed', detail: await r.text() });
        return res.status(200).json({ ok: true, action: 'send-one' });
      }

      // (c) Campaign to a whole list (default).
      const subject = String(body.subject || '').trim();
      const htmlContent = String(body.htmlContent || '').trim();
      const senderEmail = String(body.senderEmail || process.env.BREVO_SENDER_EMAIL || '').trim();
      const senderName = String(body.senderName || process.env.BREVO_SENDER_NAME || 'Tresor Couture').trim();
      const listId = Number(body.listId);
      const campaignName = String(body.campaignName || `Campaign — ${subject}`).slice(0, 120);

      if (!subject || !htmlContent) return res.status(400).json({ error: 'subject_and_body_required' });
      const htmlCheck = validateHtmlContent(htmlContent);
      if (!htmlCheck.ok) return res.status(400).json({ error: htmlCheck.error });
      if (!senderEmail) return res.status(400).json({ error: 'sender_required' });
      if (!Number.isFinite(listId) || listId <= 0) return res.status(400).json({ error: 'list_required' });

      // 1) Create the campaign.
      const createRes = await fetch(`${BREVO}/emailCampaigns`, {
        method: 'POST',
        headers: brevoHeaders(key),
        body: JSON.stringify({
          name: campaignName,
          subject,
          type: 'classic',
          sender: { name: senderName, email: senderEmail },
          htmlContent,
          recipients: { listIds: [listId] },
        }),
      });
      if (!createRes.ok) {
        return res.status(502).json({ error: 'brevo_create_failed', detail: await createRes.text() });
      }
      const created = await createRes.json();
      const campaignId = created.id;

      // 2) Send it now.
      const sendRes = await fetch(`${BREVO}/emailCampaigns/${campaignId}/sendNow`, {
        method: 'POST', headers: brevoHeaders(key),
      });
      if (!sendRes.ok && sendRes.status !== 204) {
        // Campaign exists as a draft in Brevo even if sendNow failed.
        return res.status(502).json({ error: 'brevo_send_failed', campaignId, detail: await sendRes.text() });
      }
      return res.status(200).json({ ok: true, campaignId });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error('[api/email/bulk]', (err as Error).message);
    return res.status(500).json({ error: 'internal_error' });
  }
}

export default withSentry(handler as any);
