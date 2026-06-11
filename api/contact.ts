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

// ── Origin allowlist ────────────────────────────────────────────────
// Public capture endpoint, but we still refuse cross-site BROWSER calls so a
// random page can't drive our Brevo list. Allowed: the storefront domains, any
// *.vercel.app preview, localhost dev, and anything in ALLOWED_ORIGIN (CSV).
// Requests with no Origin header (server-to-server, the E2E request client) are
// let through but still rate-limited below. A non-browser attacker can forge
// Origin, so this is defence-in-depth — pair with a CAPTCHA for hard coverage.
const CANONICAL_ORIGINS = ['https://tresorcouture.in', 'https://www.tresorcouture.in'];
function allowedOrigins(): string[] {
  const extra = String(process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  return [...CANONICAL_ORIGINS, ...extra];
}
function originAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // non-browser / same-origin server call
  if (allowedOrigins().includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return host.endsWith('.vercel.app') || host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}
function setCors(res: any, origin: string | undefined): void {
  const list = allowedOrigins();
  // Never reflect an arbitrary Origin and never send '*': echo the caller's
  // Origin only when it's allowed, otherwise pin to the canonical domain.
  res.setHeader('Access-Control-Allow-Origin', origin && originAllowed(origin) ? origin : list[0]);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Best-effort per-IP rate limit ───────────────────────────────────
// In-memory + per-instance: throttles bursts from one IP on a warm function
// instance. Serverless instances don't share state, so this is a soft cap, not
// a global limiter — move to Firestore/Upstash (or add a CAPTCHA) for a hard
// guarantee. Still stops the trivial "loop curl to poison the list" abuse.
const RL_WINDOW_MS = 60_000;
const RL_MAX = 10;
const rlHits = new Map<string, { count: number; resetAt: number }>();
function clientIp(req: any): string {
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  return (raw ? String(raw).split(',')[0].trim() : '') || 'unknown';
}
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const e = rlHits.get(ip);
  if (!e || now > e.resetAt) {
    rlHits.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    if (rlHits.size > 5000) for (const [k, v] of rlHits) if (now > v.resetAt) rlHits.delete(k);
    return false;
  }
  e.count += 1;
  return e.count > RL_MAX;
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
  const origin = req.headers['origin'] as string | undefined;
  setCors(res, origin);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!originAllowed(origin)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (rateLimited(clientIp(req))) return res.status(429).json({ error: 'rate_limited' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
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
    // Don't leak config errors to the client; capture is best-effort.
    return res.status(200).json({ ok: false });
  }
}
