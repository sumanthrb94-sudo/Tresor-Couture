/**
 * GET /api/csrf
 *
 * Returns a fresh CSRF token and sets the `tresor_csrf` cookie. The SPA should
 * call this once on load (or before its first state-changing request) and send
 * the returned token in the `X-CSRF-Token` header for every POST/PUT/DELETE.
 */
import { handleCorsPreflight, rejectDisallowedOrigin } from './_lib/cors.js';
import { issueCsrfToken } from './_lib/csrf.js';
import { header, type ApiRequest, type ApiResponse } from './_lib/http.js';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const origin = header(req, 'origin');
  if (handleCorsPreflight(req, res, 'GET, OPTIONS', true)) return;
  if (rejectDisallowedOrigin(req, res, true)) return;

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const token = issueCsrfToken(req, res);
  res.status(200).json({ token });
}
