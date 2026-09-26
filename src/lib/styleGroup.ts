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
  /** Hex color code for swatch icon display. */
  hex?: string;
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
    hex: p.colors?.[0]?.hex,
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

/**
 * One card per DESIGN for a browse grid, instead of one per colourway.
 *
 * The Apple shelf: "iPhone 18" is one tile, and the Pro, the storage and the
 * colour are chosen inside it — not thirty tiles differing by a word. A lace
 * design in eight colours is the same shape, and eight near-identical
 * photographs of the same border teaches a shopper nothing while pushing the
 * next design off the screen.
 *
 * So a group collapses to its lead colourway, which carries the "8 colours"
 * badge and opens a page whose swatch rail holds the rest. NOTHING IS LOST:
 * every colourway keeps its own page, its own URL and its own barcode, and a
 * shared link still opens the exact colour it names.
 *
 * The lead prefers a colourway that is IN STOCK. Leading with a sold-out one
 * while seven siblings are available would read as "this design is unavailable"
 * and cost the sale the grid exists to make. Ties, and all-sold-out groups,
 * fall back to barcode order, which is the order the studio shot them in.
 *
 * Order is preserved: a group sits where its lead sat, so an A–Z or
 * price sort still means what it says.
 *
 * Deliberately NOT used on search results — see collapseForBrowse's caller.
 * Someone searching "emerald" wants the emerald one, not the design it belongs
 * to with emerald hidden one click away.
 */
export function collapseToStyles(products: Fabric[]): Fabric[] {
  const leadOf = new Map<string, Fabric>();
  const out: Fabric[] = [];

  for (const p of products) {
    const key = styleKey(p);
    if (!key) {
      out.push(p);                      // ungrouped pieces pass through untouched
      continue;
    }
    const current = leadOf.get(key);
    if (!current) {
      leadOf.set(key, p);
      out.push(p);                      // reserve this group's place in the order
      continue;
    }
    if (beatsLead(p, current)) {
      leadOf.set(key, p);
      out[out.indexOf(current)] = p;    // same slot, better representative
    }
  }
  return out;
}

/** In stock wins; otherwise the earlier barcode, which is shoot order. */
function beatsLead(candidate: Fabric, lead: Fabric): boolean {
  const cIn = inStock(candidate);
  const lIn = inStock(lead);
  if (cIn !== lIn) return cIn;
  const cb = (candidate.barcode ?? '').trim();
  const lb = (lead.barcode ?? '').trim();
  if (cb && lb) return cb < lb;
  return Boolean(cb) && !lb;
}

/**
 * Every colour name a shopper can filter by.
 *
 * Reads `colourName` as well as `colors[]`, because those are different things:
 * `colors[]` lists the colours PRESENT in a piece, while `colourName` says which
 * colourway the piece IS. Laces use the second, so a facet built from `colors[]`
 * alone would offer nothing for them and quietly drop every lace from a
 * colour-filtered grid.
 */
export function colourFacet(products: Fabric[]): string[] {
  const s = new Set<string>();
  for (const p of products) {
    const own = (p.colourName ?? '').trim();
    if (own) s.add(own);
    p.colors?.forEach(c => c.name && s.add(c.name));
  }
  return [...s].sort((a, b) => a.localeCompare(b));
}

/** Does this product match any of the chosen colour names? */
export function matchesColour(p: Fabric, chosen: Set<string>): boolean {
  if (chosen.size === 0) return true;
  const own = (p.colourName ?? '').trim();
  if (own && chosen.has(own)) return true;
  return (p.colors ?? []).some(c => chosen.has(c.name));
}
