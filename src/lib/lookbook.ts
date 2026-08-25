import { awaitingPhoto, inStock } from './availability';
import type { Fabric } from '../types';

/**
 * What the home-page Lookbook shows: one card per part of the catalogue that
 * actually has a product in it.
 *
 * Pure, and separate from the component, for the same reason `subcategories.ts`
 * is: this is the rule about what may be advertised, it is the part worth
 * testing, and importing the component drags in the Firebase client with it.
 */

export interface Entry {
  key: string;
  photo: string;
  eyebrow: string;      // master category
  title: string;        // subcategory
  blurb: string;
  category: string;
  subCategory: string;
}

const MAX_CARDS = 8;
/** Below this the rail is a gappy shelf rather than a lookbook, so it hides. */
export const MIN_CARDS = 3;
const BLURB_MAX = 150;

/** Trim to a word boundary, and only add the ellipsis if something was cut. */
function trim(text: string, max = BLURB_MAX): string {
  const s = (text ?? '').trim().replace(/\s+/g, ' ');
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).replace(/[,;:.\s]+$/, '')}…`;
}

/**
 * The piece that should represent its subcategory.
 *
 * Order matters and each step is a real preference: a card with a generated
 * swatch on it advertises a photograph nobody has taken, and a card whose CTA
 * lands on a sold-out shelf is the dead link this component exists to stop
 * being. Price breaks the remaining tie — the best piece fronts the shelf.
 */
function pickHero(group: Fabric[]): Fabric | undefined {
  // `featured` outranks everything: it is the studio saying so, and a
  // heuristic that can overrule a human choice is not a choice.
  const score = (f: Fabric) =>
    (f.featured ? 16 : 0) + (awaitingPhoto(f) ? 0 : 4) + (inStock(f) ? 2 : 0)
    + ((f.description ?? '').trim().length > 40 ? 1 : 0);
  return [...group].sort(
    (a, b) => score(b) - score(a) || Number(b.price ?? 0) - Number(a.price ?? 0),
  )[0];
}

export function buildEntries(products: Fabric[]): Entry[] {
  // The category pair is carried on the group rather than encoded into the key
  // and parsed back out. Both halves contain spaces of their own — "Lehenga
  // Cholis", "Trim & Edging" — so any separator is one that something is
  // already using, and the split quietly yields a category nothing matches.
  interface Group { master: string; sub: string; items: Fabric[] }
  const groups = new Map<string, Group>();
  for (const p of products) {
    const master = p.masterCategory ?? p.category;
    const sub = p.subCategory?.trim();
    if (!master || !sub) continue;
    const key = `${master}\u0000${sub}`;
    const g = groups.get(key);
    if (g) g.items.push(p);
    else groups.set(key, { master, sub, items: [p] });
  }

  const entries: (Entry & { depth: number })[] = [];
  for (const [key, { master, sub, items }] of groups) {
    const hero = pickHero(items);
    if (!hero) continue;
    const photo = (hero.photo || hero.image || '').trim();
    if (!photo) continue;
    entries.push({
      key,
      photo,
      eyebrow: master,
      title: sub,
      blurb: trim(hero.description || `${items.length} piece${items.length === 1 ? '' : 's'} in the ${sub} edit.`),
      category: master,
      subCategory: sub,
      depth: items.length,
    });
  }

  // Deepest shelves first: a subcategory with nine pieces makes a better card
  // than one with a single piece, and a shopper who taps it finds more to see.
  return entries
    .sort((a, b) => b.depth - a.depth)
    .slice(0, MAX_CARDS)
    .map(({ depth: _depth, ...entry }) => entry);
}
