// POST /api/contact  — add an email to the Brevo marketing list.
// Body: { email, source?, name? }. Public (newsletter capture); validates the
// email shape. Used by the footer/home capture and on signup.

import { setCors, brevoAddContact, EMAIL_RE } from './_lib/util';

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = String(body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid_email' });

    const attributes: Record<string, unknown> = { SIGNUP_SOURCE: String(body.source || 'site') };
    if (body.name) attributes.FIRSTNAME = String(body.name).split(' ')[0];

    await brevoAddContact(email, attributes);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[api/contact]', (err as Error).message);
    // Don't leak config errors to the client; capture is best-effort.
    return res.status(200).json({ ok: false });
  }
}
