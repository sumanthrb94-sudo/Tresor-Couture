// POST /api/contact  — add an email to the Brevo marketing list.
// Body: { email, source?, name? }. Public (newsletter capture); validates the
// email shape. Used by the footer/home capture and on signup.
//
// SELF-CONTAINED: no relative imports. The project is ESM ("type":"module"),
// and Node ESM does not resolve extensionless relative imports — importing a
// shared './_lib/util' here throws ERR_MODULE_NOT_FOUND at cold start and the
// function returns FUNCTION_INVOCATION_FAILED. Inlining the few helpers it
// needs keeps this endpoint bullet-proof.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function setCors(res: any): void {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function brevoAddContact(email: string, attributes: Record<string, unknown>): Promise<void> {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY is not configured');
  const listId = process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined;
  const r = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ email, attributes, updateEnabled: true, ...(listId ? { listIds: [listId] } : {}) }),
  });
  // 201 created, 204 updated — both success.
  if (!r.ok && r.status !== 204) throw new Error(`brevo contact ${r.status}: ${await r.text()}`);
}

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
    const message = (err as Error).message;
    console.error('[api/contact]', message);
    // TEMPORARY: with ?debug=1 surface the underlying Brevo/config error so we
    // can diagnose ok:false in production. Remove once Brevo is confirmed live.
    const debug = /[?&]debug=1(?:&|$)/.test(req.url || '') || (req.query && req.query.debug === '1');
    // Don't leak config errors to the client by default; capture is best-effort.
    return res.status(200).json({ ok: false, ...(debug ? { detail: message.slice(0, 300) } : {}) });
  }
}
