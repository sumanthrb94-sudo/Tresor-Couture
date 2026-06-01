/**
 * Minimal request/response typings for Vercel Node serverless functions.
 *
 * We deliberately avoid a hard dependency on `@vercel/node` (not installed)
 * so `tsc --noEmit` stays green with the app's existing tsconfig. These shapes
 * are a structural subset of Node's IncomingMessage / ServerResponse plus the
 * conveniences Vercel layers on top (parsed `body`, `query`, `json()`).
 */
export interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  /** Vercel parses JSON/urlencoded bodies automatically into `body`. */
  body?: unknown;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(data: unknown): ApiResponse | void;
  send(data: unknown): ApiResponse | void;
  setHeader(name: string, value: string): void;
  end(data?: unknown): void;
}

/** Read a single header value case-insensitively. */
export function header(req: ApiRequest, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const key of Object.keys(req.headers)) {
    if (key.toLowerCase() === lower) {
      const v = req.headers[key];
      return Array.isArray(v) ? v[0] : v;
    }
  }
  return undefined;
}

/** Parse the body whether Vercel handed us an object or a raw string. */
export function readJson<T = Record<string, unknown>>(req: ApiRequest): T {
  const b = req.body;
  if (b == null) return {} as T;
  if (typeof b === 'string') {
    if (!b.trim()) return {} as T;
    return JSON.parse(b) as T;
  }
  return b as T;
}
