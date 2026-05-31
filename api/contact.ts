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

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function setCors(res: any): void {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

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

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = String(body.email || '').trim().toLowerCase();
    const phone = normalizePhone(body.phone);

    const attributes: Record<string, unknown> = { SIGNUP_SOURCE: String(body.source || 'site') };
    if (body.name) attributes.FIRSTNAME = String(body.name).split(' ')[0];
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
    // Don't leak config errors to the client; capture is best-effort.
    return res.status(200).json({ ok: false });
  }
}
