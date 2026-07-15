/**
 * Centralized CORS policy for Vercel serverless functions.
 *
 * Rules:
 *  - We NEVER echo `*`. The allowed Origin is either the caller's origin (if
 *    explicitly allowlisted) or the canonical production domain.
 *  - `ALLOWED_ORIGIN` is a comma-separated env var that adds to the canonical
 *    list (custom domains, staging previews, etc.).
 *  - Vercel preview domains (`*.vercel.app`) and localhost are allowed for
 *    developer convenience on non-admin, public endpoints only when opted in.
 */

export interface CorsRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface CorsResponse {
  setHeader(name: string, value: string): void;
  status(code: number): CorsResponse;
  json(data: unknown): CorsResponse | void;
  end(data?: unknown): void;
}

const CANONICAL_ORIGINS = ['https://tresorcouture.in', 'https://www.tresorcouture.in'];

function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

export function allowedOrigins(): string[] {
  const extra = String(process.env.ALLOWED_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // Reject wildcards: they would allow any origin with credentials.
  const safe = extra.filter((o) => {
    if (o === '*') {
      console.error('[cors] ALLOWED_ORIGIN wildcard "*" is not permitted; ignoring.');
      return false;
    }
    return true;
  });
  return [...CANONICAL_ORIGINS, ...safe];
}

function headerValue(req: CorsRequest, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const key of Object.keys(req.headers)) {
    if (key.toLowerCase() === lower) {
      const v = req.headers[key];
      return Array.isArray(v) ? v[0] : v;
    }
  }
  return undefined;
}

export function originAllowed(origin: string | undefined, allowPreview = false): boolean {
  if (!origin) return false; // require an explicit Origin for browser requests
  if (allowedOrigins().includes(origin)) return true;
  // Preview / localhost origins are only allowed in non-production environments.
  if (!allowPreview || isProduction()) return false;
  try {
    const host = new URL(origin).hostname;
    return host.endsWith('.vercel.app') || host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

export function setCorsHeaders(
  res: CorsResponse,
  origin: string | undefined,
  methods: string,
  allowPreview = false,
): void {
  const list = allowedOrigins();
  // Never reflect an arbitrary Origin and never send '*'.
  const allowed = origin && originAllowed(origin, allowPreview) ? origin : list[0] ?? CANONICAL_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

/**
 * Handle an OPTIONS preflight. Returns `true` if the request was a preflight
 * and the response has been ended.
 */
export function handleCorsPreflight(
  req: CorsRequest,
  res: CorsResponse,
  methods: string,
  allowPreview = false,
): boolean {
  const origin = headerValue(req, 'origin');
  setCorsHeaders(res, origin, methods, allowPreview);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

/**
 * Reject requests from disallowed origins. Should be called after preflight
 * handling for state-changing endpoints.
 */
export function rejectDisallowedOrigin(
  req: CorsRequest,
  res: CorsResponse,
  allowPreview = false,
): boolean {
  const origin = headerValue(req, 'origin');
  if (!originAllowed(origin, allowPreview)) {
    res.status(403).json({ error: 'origin_not_allowed' });
    return true;
  }
  return false;
}
