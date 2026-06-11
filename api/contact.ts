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

// Payload sanity caps — anything bigger is garbage/abuse, not a real signup.
const MAX_EMAIL_LEN = 254;
const MAX_NAME_LEN = 100;
const MAX_PHONE_LEN = 20;

/** Read a single header value, tolerating string[] shapes. */
function headerValue(req: any, name: string): string {
  const v = req?.headers?.[name];
  return Array.isArray(v) ? String(v[0] || '') : String(v || '');
}

/** The request's Origin (falls back to the Referer's origin), or ''. */
function requestOrigin(req: any): string {
  const origin = headerValue(req, 'origin');
  if (origin) return origin;
  const referer = headerValue(req, 'referer');
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      /* malformed referer — treat as absent */
    }
  }
  return '';
}

/** Built-in allowlist of the site's own domains (used when ALLOWED_ORIGIN is unset). */
function isOwnOrigin(origin: string): boolean {
  let host: string;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  return (
    host === 'tresorcouture.in' ||
    host === 'www.tresorcouture.in' ||
    host === 'localhost' || // local dev
    host.endsWith('.vercel.app') // Vercel preview deployments
  );
}

function setCors(req: any, res: any): void {
  const allowed = process.env.ALLOWED_ORIGIN;
  const origin = requestOrigin(req);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', allowed);
  } else if (origin && isOwnOrigin(origin)) {
    // Echo back only the site's own domains instead of a blanket wildcard.
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ---------------------------------------------------------------------------
// In-memory fixed-window rate limiter, keyed by client IP.
//
// BEST-EFFORT ONLY: this Map lives in module scope of a single warm serverless
// instance. Cold starts and parallel instances each get a fresh Map, so a
// determined attacker spread across instances can exceed the limit. It still
// stops naive single-source flooding cheaply and with zero dependencies.
// TODO: replace with a durable limiter (Vercel KV / Upstash Ratelimit) for a
// real cross-instance guarantee.
// ---------------------------------------------------------------------------
const RATE_LIMIT_MAX = 5; // requests
const RATE_LIMIT_WINDOW_MS = 60_000; // per 60s window, per IP
const rateBuckets = new Map<string, { windowStart: number; count: number }>();

/** Derive the client IP: first hop of x-forwarded-for, fallback x-real-ip. */
function clientIp(req: any): string {
  const fwd = headerValue(req, 'x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return headerValue(req, 'x-real-ip') || 'unknown';
}

/** Returns true when this IP is over its fixed-window budget. */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  // Prune stale buckets so the Map can't grow unbounded on a warm instance.
  if (rateBuckets.size > 1000) {
    for (const [key, bucket] of rateBuckets) {
      if (now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) rateBuckets.delete(key);
    }
  }
  const entry = rateBuckets.get(ip);
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
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

  // ORIGIN LOCK: when ALLOWED_ORIGIN is configured, reject cross-origin posts
  // outright. Requests without an Origin header (curl, same-origin fetch in
  // some browsers, server-side callers) are still allowed — this is a
  // best-effort abuse brake, not an auth boundary.
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  if (allowedOrigin) {
    const origin = headerValue(req, 'origin');
    if (origin && origin !== allowedOrigin) {
      return res.status(403).json({ error: 'forbidden_origin' });
    }
  }

  // RATE LIMIT (per-instance, best-effort — see comment on rateBuckets above).
  if (isRateLimited(clientIp(req))) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    // PAYLOAD SANITY: cap field sizes before doing any work with them.
    if (
      String(body.email || '').length > MAX_EMAIL_LEN ||
      String(body.name || '').length > MAX_NAME_LEN ||
      String(body.phone || '').length > MAX_PHONE_LEN
    ) {
      return res.status(400).json({ error: 'invalid_contact' });
    }

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
