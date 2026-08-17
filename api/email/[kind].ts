/**
 * One serverless function for all three email endpoints.
 *
 * Vercel bills a function per file under `api/`, and the Hobby plan allows
 * twelve. Adding the counter endpoint made thirteen, so the deployment was
 * refused — after a successful build, at the deploy step, which is a confusing
 * place to discover a quota.
 *
 * A dynamic segment is one function serving many paths, so collapsing the three
 * email routes here takes the project to eleven with the URLs completely
 * unchanged: `/api/email/welcome`, `/api/email/order` and `/api/email/bulk` all
 * still resolve, and no client, cron or Postman test needed editing.
 *
 * The handlers themselves are untouched. They live under `api/_handlers/`,
 * which Vercel excludes from the function count because of the leading
 * underscore — the same reason `api/_lib/` has never been billed as thirteen
 * more functions. This file only decides which one runs.
 *
 * Deliberately NOT applied to `api/payments/*`: the webhook is signature-
 * verified with no CSRF check while the other two are token-authenticated, and
 * putting three different security postures behind one dispatcher is how the
 * wrong one ends up running. Money endpoints stay one file each.
 */
import bulk from '../_handlers/email-bulk.js';
import order from '../_handlers/email-order.js';
import welcome from '../_handlers/email-welcome.js';
import type { ApiRequest, ApiResponse } from '../_lib/http.js';

type Handler = (req: ApiRequest, res: ApiResponse) => unknown;

/**
 * An explicit Map, not a dynamic import of `./${kind}` and not a plain object.
 *
 * Dynamic import would let a URL segment name a module. A plain object looks
 * safe but is not: `ROUTES['constructor']` and `ROUTES['toString']` resolve to
 * inherited `Object.prototype` members, so the lookup succeeds, the router
 * "finds" a route and calls it — returning an empty response instead of a 404.
 * A Map has no prototype chain to fall through.
 */
const ROUTES = new Map<string, Handler>([
  ['bulk', bulk as unknown as Handler],
  ['order', order as unknown as Handler],
  ['welcome', welcome as unknown as Handler],
]);

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const raw = req.query?.kind;
  const kind = Array.isArray(raw) ? raw[0] : raw;
  const route = typeof kind === 'string' ? ROUTES.get(kind) : undefined;

  if (!route) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  await route(req, res);
}
