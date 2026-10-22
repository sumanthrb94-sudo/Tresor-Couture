/**
 * GET /api/catalog
 *
 * The public catalogue as one CDN-cached JSON response — the storefront's
 * first paint.
 *
 * Without it, a cold visit had to download the Firebase SDK (the largest chunk
 * in the bundle), initialise it, and run a Firestore query before a single
 * product card could render; on a phone that is seconds of empty skeletons.
 * This is a plain fetch that Vercel's edge answers from cache, so the grid
 * fills while the SDK is still loading. The client still runs its own
 * Firestore query afterwards and that result wins, so a stale cache entry is
 * corrected within seconds — at most `s-maxage` + `stale-while-revalidate` old.
 *
 * Only listed products are returned (Draft and Retired are not public), and
 * the buying price is stripped.
 */
import type { Timestamp } from 'firebase-admin/firestore';
import { getDb } from './_lib/firebaseAdmin.js';
import { type ApiRequest, type ApiResponse } from './_lib/http.js';
import { withSentry } from './_lib/sentry.js';

/** Fields that must never leave the server, even though the client SDK can
 *  read them today. */
const PRIVATE = ['costPrice'];

const toMs = (v: unknown): unknown => {
  const ts = v as Partial<Timestamp> | null;
  return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : v;
};

async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const snap = await getDb().collection('products').limit(1000).get();
  const products = [];
  for (const d of snap.docs) {
    const p = d.data();
    // Mirrors isListed() in src/lib/availability.ts: no status means published.
    if (p.listingStatus !== undefined && p.listingStatus !== 'Active') continue;
    for (const k of PRIVATE) delete p[k];
    p.createdAt = toMs(p.createdAt);
    p.updatedAt = toMs(p.updatedAt);
    products.push({ ...p, id: d.id });
  }

  // Edge-cached for a minute, then served stale for up to ten while it
  // refreshes in the background: the read cost stays flat however busy the
  // shop gets, and the client's own Firestore read corrects any staleness.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
  res.status(200).json({ products });
}

export default withSentry(handler);
