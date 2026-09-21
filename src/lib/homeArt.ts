/**
 * Category art for the home page.
 *
 * The hero and the "Shop the House" tiles both used a PRODUCT photograph as
 * the face of a whole category — whichever piece `pickHero` chose. That is a
 * photograph framed for a 3:4 card being asked to carry a banner, which is why
 * the hero never had anywhere to put its headline and why one tile rendered as
 * a bare patch of skin off the top of a model shot.
 *
 * Category art is a separate layer: one image per category, shot (or made) to
 * be a category image rather than a product one. Where a category has art the
 * home page uses it; where it does not, the product photograph still stands in,
 * so the page degrades to exactly what it did before rather than to a hole.
 *
 * Crucially this does NOT touch `products`. A shopper who taps a tile still
 * sees the real photographs of the real piece — the art is the shelf label, not
 * the goods. Replacing a garment's own photograph would misrepresent what a
 * customer is buying.
 *
 * Stored one document per category under `config/homeart-<slug>`: six
 * photographs will not fit in one Firestore document, and `config/*` is
 * already public-read / admin-write, so this needs no rules change.
 */
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export type HomeArt = Record<string, string>;

const PREFIX = 'homeart-';

/** Resolved once per page load — the home page asks from two components. */
let cache: Promise<HomeArt> | null = null;

export function loadHomeArt(): Promise<HomeArt> {
  if (cache) return cache;
  cache = getDocs(collection(db, 'config'))
    .then(snap => {
      const out: HomeArt = {};
      for (const d of snap.docs) {
        if (!d.id.startsWith(PREFIX)) continue;
        const data = d.data() as { category?: unknown; photo?: unknown };
        if (typeof data.category === 'string' && typeof data.photo === 'string' && data.photo) {
          out[data.category] = data.photo;
        }
      }
      return out;
    })
    // Art is decoration, not content: if it cannot be read the page still has
    // product photographs to fall back on, so a failure is silent by design.
    .catch(() => ({}));
  return cache;
}

/** Test seam — the module-level cache would otherwise outlive a fixture. */
export function resetHomeArtCache(): void {
  cache = null;
}

/**
 * Category art for a component, empty until it lands.
 *
 * Empty is a real state, not a loading screen: the home page renders
 * immediately on product photographs and swaps in the art when it arrives, so
 * a slow read delays a nicer picture rather than the page.
 */
export function useHomeArt(): HomeArt {
  const [art, setArt] = useState<HomeArt>({});
  useEffect(() => {
    let live = true;
    void loadHomeArt().then(a => { if (live) setArt(a); });
    return () => { live = false; };
  }, []);
  return art;
}
