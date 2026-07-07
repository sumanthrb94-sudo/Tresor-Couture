/**
 * Double-submit cookie CSRF protection.
 *
 * Flow:
 *   1. Server sets `tresor_csrf` cookie (not HttpOnly so JS can read it).
 *   2. Client JavaScript reads the cookie and sends the value in the
 *      `X-CSRF-Token` header on every state-changing request.
 *   3. Server compares the cookie value with the header value.
 *
 * A cross-origin attacker cannot read the cookie (same-origin policy) and
 * cannot set custom headers on a cross-origin request without a preflight,
 * which is blocked by CORS. Pair this with strict origin allowlisting.
 */
import { randomBytes } from 'crypto';
import { header } from './http.js';
import type { ApiRequest, ApiResponse } from './http.js';

const CSRF_COOKIE = 'tresor_csrf';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

function serializeCookie(name: string, value: string, opts: Record<string, string | boolean>): string {
  let cookie = `${name}=${encodeURIComponent(value)}`;
  for (const [k, v] of Object.entries(opts)) {
    if (v === true) cookie += `; ${k}`;
    else if (v !== false) cookie += `; ${k}=${v}`;
  }
  return cookie;
}

function isSecureRequest(req: ApiRequest): boolean {
  const proto = header(req, 'x-forwarded-proto');
  const origin = header(req, 'origin');
  if (proto) return proto === 'https';
  if (origin) return origin.startsWith('https:');
  return true; // default to secure in production
}

export function setCsrfCookie(req: ApiRequest, res: ApiResponse, token: string): void {
  const attrs: Record<string, string | boolean> = {
    Path: '/',
    SameSite: 'Lax',
    // Not HttpOnly: the SPA must read this cookie to send the header.
  };
  if (isSecureRequest(req)) {
    attrs.Secure = true;
  }
  res.setHeader('Set-Cookie', serializeCookie(CSRF_COOKIE, token, attrs));
}

function getCookieValue(req: ApiRequest, name: string): string | undefined {
  const raw = header(req, 'cookie');
  if (!raw) return undefined;
  const match = raw.split(';').find((c) => c.trim().startsWith(`${name}=`));
  if (!match) return undefined;
  try {
    return decodeURIComponent(match.split('=')[1] ?? '');
  } catch {
    return undefined;
  }
}

export function getCsrfTokenFromCookie(req: ApiRequest): string | undefined {
  return getCookieValue(req, CSRF_COOKIE);
}

export function getCsrfTokenFromHeader(req: ApiRequest): string | undefined {
  return header(req, CSRF_HEADER);
}

/**
 * Validate the CSRF token for a state-changing request. Safe methods are
 * allowed through without a token (they don't mutate state). If the request
 * has no CSRF cookie, this function sets one and returns false so the client
 * can retry with the new token.
 */
export function validateCsrfToken(req: ApiRequest, res: ApiResponse): boolean {
  if (CSRF_SAFE_METHODS.has(req.method ?? '')) return true;

  const cookieToken = getCsrfTokenFromCookie(req);
  const headerToken = getCsrfTokenFromHeader(req);

  if (!cookieToken) {
    // First visit: set the cookie and require the client to retry.
    setCsrfCookie(req, res, generateCsrfToken());
    return false;
  }

  if (!headerToken || headerToken !== cookieToken) {
    return false;
  }

  return true;
}

/**
 * Convenience: sets a fresh CSRF cookie and returns the token. Used by the
 * dedicated /api/csrf endpoint.
 */
export function issueCsrfToken(req: ApiRequest, res: ApiResponse): string {
  const token = generateCsrfToken();
  setCsrfCookie(req, res, token);
  return token;
}
