import type { Fabric } from '../types';
import { isListed, inStock } from './availability';

/**
 * Colourways of one design.
 *
 * A lace design arrives in five or six colours. Each colour is a separate
 * PRODUCT — its own barcode, its own stock, its own photographs — because all
 * three of those are per roll: the till scans one code, the stock transaction in
 * /api/orders/place decrements one number, and a shopper who picked emerald
 * needs to be looking at the emerald photograph. Folding six colours into one
 * document would give one barcode for six rolls and one stock pool for six
 * things that sell independently.
 *
 * So the grouping is a LINK between products, not a field inside one:
 *
 *   styleCode   which design this is   ("TC-BFV" — Beaded Floral Vine)
 *   colourName  which colourway it is  ("Emerald")
 *
 * Deliberately NOT reusing `colors[]`. That field means "the colours present in
 * this piece" and feeds the "More Colours" chips whose selection rides along on
 * the cart line (`CartItem.color`). Overloading it to mean "this product IS
 * emerald" would change what those chips add to the bag.
 *
 * `styleCode` is also a different axis from `subCategory`. Sub-category is what
 * the piece IS — Embroidered Border, Trim & Edging — and that is the shelf a
 * shopper browses. Style code is which design it is. Turning each design into
 * its own sub-category would leave sixteen shelves holding two to eight pieces
 * each, which is no longer a way to browse anything.
 */

export interface ColourSibling {
  id: string;
  /** What to print under the swatch. */
  colour: string;
  photo: string;
  /** Swatch shown when the photograph fails to load. */
  fallback: string;
  soldOut: boolean;
  /** The one being viewed, so the rail reads as a selector rather than a list of other things. */
  isCurrent: boolean;
}

/** Style codes are matched case- and space-insensitively: they get typed by hand. */
export const styleKey = (f: Pick<Fabric, 'styleCode'>): string =>
  (f.styleCode ?? '').trim().toUpperCase();

/** The label for one colourway, falling back to the product name so a swatch is never blank. */
const labelOf = (f: Fabric): string => (f.colourName ?? '').trim() || f.name;

/**
 * Every colourway of `current`'s design, including `current` itself.
 *
 * Returns an EMPTY array when the design has no siblings — a product with no
 * style code, or the only colour of its design. A rail holding a single swatch
 * says nothing and costs a section of the page, so the caller renders nothing.
 *
 * Sold-out colourways are kept and marked rather than dropped: "we make this in
 * emerald, just not today" is worth telling a shopper, and the page it links to
 * still works. Drafts are excluded — they have never been published and their
 * pages would 404.
 */
export function colourSiblings(current: Fabric, catalogue: Fabric[]): ColourSibling[] {
  const key = styleKey(current);
  if (!key) return [];

  const seen = new Set<string>();
  const members = catalogue.filter((p) => {
    if (styleKey(p) !== key) return false;
    // The current product is matched from the catalogue when it is present, but
    // it is appended below when it is not — the catalogue is a cached snapshot
    // and can lag a freshly saved product.
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return isListed(p);
  });
  if (!members.some((p) => p.id === current.id) && isListed(current)) members.push(current);

  if (members.length < 2) return [];

  // Barcodes are issued in one unbroken run per design, so ordering by them puts
  // the colours in the order the studio actually shot and labelled them. Name is
  // the tiebreak for anything not yet barcoded.
  members.sort((a, b) => {
    const ab = (a.barcode ?? '').trim();
    const bb = (b.barcode ?? '').trim();
    if (ab && bb && ab !== bb) return ab < bb ? -1 : 1;
    if (ab && !bb) return -1;
    if (!ab && bb) return 1;
    return labelOf(a).localeCompare(labelOf(b));
  });

  return members.map((p) => ({
    id: p.id,
    colour: labelOf(p),
    photo: p.photo,
    fallback: p.image,
    soldOut: !inStock(p),
    isCurrent: p.id === current.id,
  }));
}

/**
 * How many colourways a design has, for the badge on a grid card.
 *
 * Counts only what a shopper could actually open, so the badge never promises a
 * colour that turns out to be a Draft. Returns 0 for an ungrouped product and
 * for a design with a single colour, so `count > 1` is the whole render test.
 */
export function colourwayCount(f: Fabric, catalogue: Fabric[]): number {
  const key = styleKey(f);
  if (!key) return 0;
  const ids = new Set<string>();
  for (const p of catalogue) if (styleKey(p) === key && isListed(p)) ids.add(p.id);
  if (isListed(f)) ids.add(f.id);
  return ids.size < 2 ? 0 : ids.size;
}
