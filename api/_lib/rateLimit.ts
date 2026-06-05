/**
 * Best-effort in-memory rate limiter for the serverless API.
 *
 * IMPORTANT CAVEAT: Vercel functions are horizontally scaled and ephemeral, so
 * this counter is per-instance and resets on cold start. It meaningfully blunts
 * single-source bursts (scripted abuse, accidental retry storms) but is NOT a
 * substitute for a durable, shared limiter. For hard guarantees back this with
 * Upstash/Redis or Vercel's platform rate limiting — the call sites can keep
 * the same shape and only swap the store.
 */
import { header, type ApiRequest } from './http.js';

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

/** Derive a best-effort client key from the forwarded IP chain. */
export function clientIp(req: ApiRequest): string {
  const xff = header(req, 'x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return header(req, 'x-real-ip') || 'unknown';
}

/**
 * Fixed-window check. Returns `{ ok }` and, when blocked, `retryAfter` seconds.
 * Counts the current request when allowed.
 */
export function rateLimit(opts: { key: string; limit: number; windowMs: number }): {
  ok: boolean;
  retryAfter: number;
} {
  const now = Date.now();

  // Opportunistic cleanup so the map can't grow unbounded on a warm instance.
  if (store.size > 5000) {
    for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
  }

  const b = store.get(opts.key);
  if (!b || b.resetAt <= now) {
    store.set(opts.key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= opts.limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}
