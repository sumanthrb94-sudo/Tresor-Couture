/**
 * POST /api/subscribers/sync
 *
 * Body: { email: string, phone?: string, source?: string }
 *
 * Best-effort sync of a newsletter/WhatsApp opt-in into Brevo contacts so the
 * marketing list authored in Brevo stays current. Firestore's `subscribers`
 * collection remains the source of truth (written client-side by the form);
 * this endpoint is purely the outbound push to Brevo.
 *
 * Returns 200 `{ synced }` on a real upsert, 200 `{ synced:false, reason }`
 * when Brevo isn't configured (so the client treats it as a graceful no-op),
 * and never leaks the API key to the browser.
 */
import { brevoConfigured, upsertBrevoContact } from '../_lib/brevo.js';
import { readJson, type ApiRequest, type ApiResponse } from '../_lib/http.js';

interface Body {
  email?: string;
  phone?: string;
  source?: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  if (!brevoConfigured()) {
    // Not an error: the form already persisted the lead to Firestore.
    res.status(200).json({ synced: false, reason: 'brevo_not_configured' });
    return;
  }

  const { email, phone, source } = readJson<Body>(req);
  if (!email || !EMAIL_RE.test(email.trim())) {
    res.status(400).json({ error: 'invalid_email' });
    return;
  }

  const ok = await upsertBrevoContact({ email, phone, source });
  res.status(200).json({ synced: ok });
}
