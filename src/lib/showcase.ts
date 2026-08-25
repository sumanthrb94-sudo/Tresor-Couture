import { awaitingPhoto, inStock } from './availability';
import { subcategoriesFor } from './subcategories';
import type { Fabric } from '../types';

/**
 * What each master category looks like right now: how deep it is, what is in it,
 * and which piece should photograph it.
 *
 * The home page used to answer all three from constants — a hero carousel of
 * three fixed slides with stock photography and copy about Banarasi, Kanjivaram
 * and Patola, and a "Shop the House" strip of letters on gradients. None of it
 * came from the shop, so none of it changed when the shop did, and a customer's
 * first screen advertised weaves the atelier has never listed.
 *
 * One derivation, used by both, so the front page can only ever show what is
 * actually on the shelves.
 */

export interface Showcase {
  category: string;
  /** Subcategories with stock, in the curated order. */
  subcategories: string[];
  /** Live products in this category. */
  count: number;
  /** The piece that should represent it — real photograph preferred. */
  photo: string;
  hero?: Fabric;
}

/**
 * The piece that should front a shelf.
 *
 * A generated swatch is not a photograph of anything, so a real one outranks
 * everything else; then something in stock, because the first tap should land
 * on a piece that can be bought; then price, so the best piece leads.
 */
function pickHero(group: Fabric[]): Fabric | undefined {
  // `featured` outranks everything: it is the studio saying so, and a
  // heuristic that can overrule a human choice is not a choice.
  const score = (f: Fabric) =>
    (f.featured ? 16 : 0) + (awaitingPhoto(f) ? 0 : 4) + (inStock(f) ? 2 : 0);
  return [...group].sort(
    (a, b) => score(b) - score(a) || Number(b.price ?? 0) - Number(a.price ?? 0),
  )[0];
}

/** Every master category that has a live product, deepest first. */
export function categoryShowcase(products: Fabric[]): Showcase[] {
  const groups = new Map<string, Fabric[]>();
  for (const p of products) {
    const master = p.masterCategory ?? p.category;
    if (!master) continue;
    const g = groups.get(master);
    if (g) g.push(p); else groups.set(master, [p]);
  }

  const out: Showcase[] = [];
  for (const [category, items] of groups) {
    const hero = pickHero(items);
    const photo = (hero?.photo || hero?.image || '').trim();
    if (!photo) continue;
    out.push({
      category,
      subcategories: subcategoriesFor(category, items),
      count: items.length,
      photo,
      hero,
    });
  }
  return out.sort((a, b) => b.count - a.count);
}
