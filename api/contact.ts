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

// Allow-list of origins permitted to call this endpoint cross-origin. The app
// itself calls /api/* same-origin (no CORS needed), so this only governs
// external callers. Override with ALLOWED_ORIGINS (comma-separated) in Vercel.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'https://tresorcouture.in,https://www.tresorcouture.in')
  .split(',').map(s => s.trim()).filter(Boolean);

function setCors(req: any, res: any): void {
  const origin = String(req.headers?.origin || '');
  // Reflect only allow-listed origins; otherwise fall back to the primary site
  // origin (never the wildcard '*').
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] || 'null');
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Best-effort per-instance rate limit (inlined to keep this endpoint
// import-free / cold-start bullet-proof — see note below). Caveat: per-instance
// only; back with a durable store for hard guarantees.
const _rlStore = new Map<string, { count: number; resetAt: number }>();
function rateLimited(req: any, limit = 10, windowMs = 60_000): boolean {
  const xff = String(req.headers?.['x-forwarded-for'] || '');
  const ip = (xff.split(',')[0] || '').trim() || String(req.headers?.['x-real-ip'] || 'unknown');
  const now = Date.now();
  const b = _rlStore.get(ip);
  if (!b || b.resetAt <= now) { _rlStore.set(ip, { count: 1, resetAt: now + windowMs }); return false; }
  if (b.count >= limit) return true;
  b.count += 1;
  return false;
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
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (rateLimited(req)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'rate_limited' });
  }

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
