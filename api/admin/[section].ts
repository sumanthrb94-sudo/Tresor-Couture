/**
 * GET /api/admin/<section> — admin-only read-through to data the browser
 * cannot fetch itself because it needs a server-side credential.
 *
 * Deliberately ONE dynamic route rather than a file per section. Vercel counts
 * serverless functions against the Hobby plan's limit of 12, and the project
 * was already at 11. A file per section would have spent the last slot on the
 * first one and left nothing for the next; this way every future admin
 * read-through is another `case` in the switch below and costs nothing.
 *
 * Sections:
 *   analytics — Vercel Web Analytics (page views), so the studio can see
 *               traffic without a Vercel login.
 *
 * Auth: Firebase ID token AND the `admin` custom claim — the same claim the
 * Firestore rules use. Non-admins get 403. This matters more than usual here:
 * the handler holds a Vercel API token that can read the whole account, so it
 * must never answer an unauthenticated caller.
 */
import { handleCorsPreflight, rejectDisallowedOrigin } from '../_lib/cors.js';
import { header, type ApiRequest, type ApiResponse } from '../_lib/http.js';
import { verifyIdToken } from '../_lib/auth.js';
import { withSentry } from '../_lib/sentry.js';

const VERCEL_API = 'https://api.vercel.com';

/** A row of the "which pages were viewed" table. */
interface PathRow {
  path: string;
  visitors: number;
  pageviews: number;
}

interface AnalyticsPayload {
  range: { since: string; until: string; days: number };
  totals: { visitors: number; pageviews: number };
  byDay: { date: string; visitors: number; pageviews: number }[];
  byPath: PathRow[];
  byReferrer: { referrer: string; visitors: number }[];
  byDevice: { device: string; visitors: number }[];
}

/**
 * Vercel's analytics API answers `{ data: ... }` in two shapes — an object for
 * `count`, an array of rows for `aggregate` — and the row key is whatever
 * dimension was grouped by. Narrow at the call site rather than trusting it.
 */
async function vercelAnalytics(
  params: Record<string, string>,
  token: string,
  projectId: string,
  teamId: string | undefined,
): Promise<unknown> {
  const qs = new URLSearchParams({ projectId, ...params });
  if (teamId) qs.set('teamId', teamId);

  const r = await fetch(`${VERCEL_API}/v1/web-analytics/stats?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    throw new Error(`vercel_analytics_${r.status}`);
  }
  const body = (await r.json()) as { data?: unknown };
  return body.data;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

function rows(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

async function analytics(req: ApiRequest): Promise<AnalyticsPayload> {
  const token = process.env.VERCEL_API_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim() || undefined;
  if (!token || !projectId) throw new Error('not_configured');

  // Clamp: a huge window is a slow upstream call, and the page only charts a
  // few months at most.
  const raw = Number(Array.isArray(req.query.days) ? req.query.days[0] : req.query.days);
  const days = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 365) : 30;

  const until = new Date();
  const since = new Date(until.getTime() - days * 86_400_000);
  const window = { since: since.toISOString(), until: until.toISOString() };

  // One round trip per view rather than five sequential ones — the page opens
  // in about the time of the slowest call instead of the sum of all of them.
  const [total, day, path, referrer, device] = await Promise.all([
    vercelAnalytics({ ...window, mode: 'count' }, token, projectId, teamId),
    vercelAnalytics({ ...window, mode: 'aggregate', by: 'day', limit: '400' }, token, projectId, teamId),
    vercelAnalytics({ ...window, mode: 'aggregate', by: 'requestPath', limit: '100' }, token, projectId, teamId),
    vercelAnalytics({ ...window, mode: 'aggregate', by: 'referrerHostname', limit: '10' }, token, projectId, teamId),
    vercelAnalytics({ ...window, mode: 'aggregate', by: 'deviceType', limit: '10' }, token, projectId, teamId),
  ]);

  const totals = (total ?? {}) as Record<string, unknown>;

  return {
    range: { since: window.since, until: window.until, days },
    totals: { visitors: num(totals.visitors), pageviews: num(totals.pageviews) },
    byDay: rows(day)
      .map(r => ({ date: str(r.day ?? r.date), visitors: num(r.visitors), pageviews: num(r.pageviews) }))
      .filter(r => r.date)
      .sort((a, b) => a.date.localeCompare(b.date)),
    byPath: rows(path)
      .map(r => ({ path: str(r.requestPath), visitors: num(r.visitors), pageviews: num(r.pageviews) }))
      .filter(r => r.path)
      .sort((a, b) => b.pageviews - a.pageviews),
    byReferrer: rows(referrer)
      .map(r => ({ referrer: str(r.referrerHostname), visitors: num(r.visitors) }))
      .filter(r => r.referrer)
      .sort((a, b) => b.visitors - a.visitors),
    byDevice: rows(device)
      .map(r => ({ device: str(r.deviceType), visitors: num(r.visitors) }))
      .filter(r => r.device)
      .sort((a, b) => b.visitors - a.visitors),
  };
}

async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (handleCorsPreflight(req, res, 'GET, OPTIONS')) return;
  if (rejectDisallowedOrigin(req, res)) return;

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const decoded = await verifyIdToken(header(req, 'authorization'));
  if (!decoded) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }
  if (decoded.admin !== true) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  const section = Array.isArray(req.query.section) ? req.query.section[0] : req.query.section;

  try {
    switch (section) {
      case 'analytics': {
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        res.status(200).json(await analytics(req));
        return;
      }
      default:
        res.status(404).json({ error: 'unknown_section' });
        return;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error';
    // `not_configured` is the ordinary state before the Vercel token is added,
    // not a fault — the page renders setup instructions for it, so it must be
    // distinguishable from a genuine upstream failure.
    if (message === 'not_configured') {
      res.status(503).json({ error: 'not_configured' });
      return;
    }
    res.status(502).json({ error: 'upstream_failed', detail: message });
  }
}

export default withSentry(handler);
