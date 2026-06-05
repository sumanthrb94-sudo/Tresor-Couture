/**
 * POST /api/coupons/validate — server-side coupon validation.
 *
 * Body: { code: string, subtotal: number }
 * Returns: { valid, discount, reason?, minSubtotal? }
 *
 * Exists so the `coupons` collection no longer needs to be world-readable: the
 * browser asks the server whether a code is valid and is told only the
 * resulting discount, never the full coupon ledger (which would leak every
 * code, value and threshold to anyone). The authoritative evaluation here is
 * the same one used by checkout pricing (`evaluateCoupon`).
 *
 * Public (coupon entry can happen before sign-in) but rate-limited.
 */
import { getDb, firebaseAdminConfigured } from '../_lib/firebaseAdmin.js';
import { evaluateCoupon } from '../_lib/pricing.js';
import { rateLimit, clientIp } from '../_lib/rateLimit.js';
import { readJson, type ApiRequest, type ApiResponse } from '../_lib/http.js';

interface Body {
  code?: string;
  subtotal?: number;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  if (!firebaseAdminConfigured()) {
    res.status(503).json({ error: 'coupons_server_unavailable' });
    return;
  }

  const rl = rateLimit({ key: `coupon:${clientIp(req)}`, limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  let body: Body;
  try {
    body = readJson<Body>(req);
  } catch {
    res.status(400).json({ error: 'invalid_json' });
    return;
  }

  const code = String(body.code ?? '').trim();
  const subtotal = Number(body.subtotal);
  if (!code || !isFinite(subtotal) || subtotal < 0) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }

  try {
    const result = await evaluateCoupon(getDb(), code, subtotal);
    res.status(200).json(result);
  } catch (err) {
    console.error('[coupons/validate] failed', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'validate_failed' });
  }
}
