/**
 * Global rate limiting for Vercel serverless functions.
 *
 * Primary backend: Upstash Redis REST (serverless-friendly, no persistent TCP).
 * Falls back to an in-memory Map when Upstash is not configured. The in-memory
 * fallback is per-instance, so it only blocks bursts on a warm function — it
 * does NOT provide a global guarantee. Set UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN for real global protection.
 */

export interface RateLimitRule {
  /** Window in seconds. */
  window: number;
  /** Max attempts per window. */
  max: number;
}

interface UpstashConfig {
  url: string;
  token: string;
}

function getUpstashConfig(): UpstashConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}

function clientIp(req: { headers: Record<string, string | string[] | undefined> }): string {
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  return (raw ? String(raw).split(',')[0].trim() : '') || 'unknown';
}

// ── In-memory fallback ──────────────────────────────────────────────
const memHits = new Map<string, { count: number; resetAt: number }>();

function memRateLimited(key: string, rule: RateLimitRule): boolean {
  const now = Date.now();
  const e = memHits.get(key);
  if (!e || now > e.resetAt) {
    memHits.set(key, { count: 1, resetAt: now + rule.window * 1000 });
    if (memHits.size > 5000) {
      for (const [k, v] of memHits) {
        if (now > v.resetAt) memHits.delete(k);
      }
    }
    return false;
  }
  e.count += 1;
  return e.count > rule.max;
}

// ── Upstash Redis backend ───────────────────────────────────────────
async function upstashRateLimited(key: string, rule: RateLimitRule, cfg: UpstashConfig): Promise<boolean> {
  try {
    const incrRes = await fetch(`${cfg.url}/incr/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
    });
    if (!incrRes.ok) throw new Error(`upstash incr ${incrRes.status}`);
    const incrData = (await incrRes.json()) as { result?: number };
    const count = incrData.result ?? 0;

    if (count === 1) {
      await fetch(`${cfg.url}/expire/${encodeURIComponent(key)}/${rule.window}`, {
        headers: { Authorization: `Bearer ${cfg.token}` },
      });
    }

    return count > rule.max;
  } catch (err) {
    console.error('[rateLimit] Upstash failed:', (err as Error).message);
    // Degrade gracefully to the in-memory limiter on an Upstash outage rather
    // than blocking every request (or disabling limiting entirely).
    return memRateLimited(key, rule);
  }
}

/**
 * Check whether a request should be rate-limited. `identifier` can be an IP
 * (default) or a user-chosen key (e.g., user id for authenticated endpoints).
 */
export async function rateLimited(
  req: { headers: Record<string, string | string[] | undefined> },
  rule: RateLimitRule,
  identifier?: string,
): Promise<boolean> {
  const keyBase = identifier || clientIp(req);
  const key = `rl:${keyBase}`;

  const cfg = getUpstashConfig();
  if (cfg) return upstashRateLimited(key, rule, cfg);
  // No Upstash configured — use the built-in in-memory limiter. It lives inside
  // each serverless instance (Vercel may run several), so it is a best-effort
  // soft guard, not a global guarantee. That is fine for launch; set
  // UPSTASH_REDIS_REST_URL/TOKEN later for shared, global limiting at scale.
  return memRateLimited(key, rule);
}

export function rateLimitHeaders(rule: RateLimitRule): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(rule.max),
    'X-RateLimit-Window': String(rule.window),
  };
}
