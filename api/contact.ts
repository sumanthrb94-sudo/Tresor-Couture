// POST /api/contact  — upsert a contact into the Brevo marketing list.
// Body: { email?, phone?, source?, name? }. Public (newsletter capture + signup).
//   - email present  → email contact; phone (if any) stored as the SMS attribute.
//   - phone only      → SMS-keyed contact (ext_id), no email.
// Used by the footer/home capture and by captureNewUser on every signup path.
//
// SELF-CONTAINED: no relative imports. The project is ESM ("type":"module"),
// and Node ESM does not resolve extensionless relative imports — importing a
// shared './_lib/util' here throws ERR_MODULE_NOT_FOUND at cold start and the
// function returns FUNCTION_INVOCATION_FAILED. Inlining the few helpers it
// needs keeps this endpoint bullet-proof.

import { handleCorsPreflight, rejectDisallowedOrigin, originAllowed } from './_lib/cors.js';
import { validateCsrfToken } from './_lib/csrf.js';
import { rateLimited, rateLimitHeaders } from './_lib/rateLimit.js';
import { verifyHcaptcha } from './_lib/captcha.js';
import { withSentry } from './_lib/sentry.js';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// 10 submissions per IP per minute. Pair with hCaptcha for hard protection.
const CONTACT_RATE_LIMIT = { window: 60, max: 10 };

/** Best-effort E.164 normalisation. Returns '' when the input can't be made
 *  into a plausible international number (Brevo rejects bad SMS attributes). */
function normalizePhone(raw: unknown): string {
  const s = String(raw || '').replace(/[^\d+]/g, '');
  if (!s) return '';
  if (s.startsWith('+')) return /^\+\d{8,15}$/.test(s) ? s : '';
  const d = s.replace(/\D/g, '');
  if (d.length === 10) return `+91${d}`;                 // bare 10-digit → assume India
  if (d.length === 12 && d.startsWith('91')) return `+${d}`;
  if (d.length >= 8 && d.length <= 15) return `+${d}`;
  return '';
}

/** Upsert a contact. Pass either { email } or { ext_id } as the identifier. */
async function brevoUpsert(body: Record<string, unknown>): Promise<void> {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY is not configured');
  const listId = process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined;
  const r = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ updateEnabled: true, ...(listId ? { listIds: [listId] } : {}), ...body }),
  });
  // 201 created, 204 updated — both success.
  if (!r.ok && r.status !== 204) throw new Error(`brevo contact ${r.status}: ${await r.text()}`);
}

async function handler(req: any, res: any) {
  const origin = req.headers['origin'] as string | undefined;
  if (handleCorsPreflight(req, res, 'POST, OPTIONS', true)) return;
  if (!originAllowed(origin, true)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (!validateCsrfToken(req, res)) {
    return res.status(403).json({ error: 'csrf_token_invalid' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  for (const [k, v] of Object.entries(rateLimitHeaders(CONTACT_RATE_LIMIT))) {
    res.setHeader(k, v);
  }
  if (await rateLimited(req, CONTACT_RATE_LIMIT)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    const captcha = await verifyHcaptcha(body.captchaToken);
    if (!captcha.ok) {
      return res.status(403).json({ error: captcha.error || 'captcha_failed' });
    }

    const email = String(body.email || '').trim().toLowerCase().slice(0, 254);
    const phone = normalizePhone(body.phone);

    const attributes: Record<string, unknown> = { SIGNUP_SOURCE: String(body.source || 'site').slice(0, 64) };
    if (body.name) attributes.FIRSTNAME = String(body.name).split(' ')[0].slice(0, 64);
    if (phone) attributes.SMS = phone;

    if (EMAIL_RE.test(email)) {
      try {
        await brevoUpsert({ email, attributes });
      } catch (e) {
        // A malformed SMS attribute can reject the whole upsert — retry without
        // it so the email capture still succeeds.
        if (attributes.SMS) {
          const { SMS, ...rest } = attributes;
          await brevoUpsert({ email, attributes: rest });
        } else {
          throw e;
        }
      }
      return res.status(200).json({ ok: true });
    }

    if (phone) {
      // Phone-only signup: key the contact by ext_id (the number itself).
      await brevoUpsert({ ext_id: phone, attributes });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'invalid_contact' });
  } catch (err) {
    console.error('[api/contact]', (err as Error).message);
    // Don't leak config errors to the client; return a generic server error.
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
}

export default withSentry(handler as any);
