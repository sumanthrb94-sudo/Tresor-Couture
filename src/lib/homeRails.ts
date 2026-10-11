import { awaitingPhoto, inStock, isListed, sellableFirst } from './availability';
import { collapseToStyles } from './styleGroup';
import type { Fabric } from '../types';

/**
 * What the home page shelves, derived from the catalogue.
 *
 * The rails used to be nothing but sticker filters (`sticker === 'Trending'`).
 * Stickers are typed in by hand, one product at a time, and no import or seed
 * path ever sets one — so on a catalogue that grew by bulk upload every rail was
 * empty, `ProductRail` removes an empty rail from the page, and the home screen
 * collapsed to a hero and a handful of tiles above a catalogue of hundreds.
 *
 * The rules here keep the one promise worth keeping — a rail only ever
 * advertises a piece that is photographed and can be shipped — and stop
 * depending on someone having remembered to tag it.
 */

/** Cards per curated rail. */
export const RAIL_SIZE = 5;

/** Milliseconds a document was created at, whatever shape the field arrived in. */
export function createdMs(f: Pick<Fabric, 'createdAt'>): number {
  const c = f.createdAt as unknown;
  if (typeof c === 'number') return c;
  if (typeof c === 'string') {
    const t = Date.parse(c);
    return Number.isFinite(t) ? t : 0;
  }
  if (c && typeof c === 'object') {
    const ts = c as { toMillis?: () => number; seconds?: number };
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  }
  return 0;
}

const newestFirst = (a: Fabric, b: Fabric) => createdMs(b) - createdMs(a);

/** A piece the home page may advertise: live, photographed, and in stock. */
export const isShowable = (f: Fabric): boolean =>
  isListed(f) && inStock(f) && !awaitingPhoto(f);

export interface HomeRails {
  trending: Fabric[];
  newIn: Fabric[];
  bridal: Fabric[];
  /** True when `bridal` is Sarees/Lehengas rather than the silk/satin fallback. */
  bridalUsesMaster: boolean;
  summer: Fabric[];
  /** Suggested by the studio: pieces ticked "Feature on the home page". */
  studio: Fabric[];
  /** How many of `studio` the studio actually chose (the rest are filler). */
  studioChosen: number;
}

export function buildHomeRails(products: Fabric[]): HomeRails {
  // One card per DESIGN, as in the shop: eight colourways of one lace are one
  // shelf-space, not eight cards that push every other design off the rail.
  const showable = collapseToStyles(products.filter(isShowable)).sort(newestFirst);

  // A piece appears on one rail only. Without this, a catalogue with a few
  // stickered pieces shows the same five cards under four different headings.
  const used = new Set<string>();
  const take = (list: Fabric[]): Fabric[] => {
    const out: Fabric[] = [];
    for (const f of list) {
      if (out.length >= RAIL_SIZE) break;
      if (used.has(f.id)) continue;
      used.add(f.id);
      out.push(f);
    }
    return out;
  };

  const trending = take(showable.filter(f => f.sticker === 'Trending' || f.sticker === 'Bestseller'));

  const masters = showable.filter(f => f.masterCategory === 'Sarees' || f.masterCategory === 'Lehenga Cholis');
  const bridalUsesMaster = masters.length >= 3;
  const bridal = take(
    bridalUsesMaster ? masters : showable.filter(f => f.materialType === 'Silk' || f.materialType === 'Satin'),
  );

  // "New In": pieces the studio stickered, then simply the newest on the shelf.
  // Recency is a fact about the catalogue, so this rail needs no tagging to
  // exist — which is the point of it.
  const stickered = showable.filter(f => f.sticker === 'New In' || f.sticker === 'Limited');
  const newIn = take([...stickered, ...showable]);

  const summer = take(showable.filter(f => f.materialType === 'Cotton' || f.materialType === 'Linen'));

  // Studio picks: what the studio chose, in the order it is easiest to read.
  // `used` is deliberately NOT consulted for the chosen ones — a deliberate pick
  // may also be new, and hiding it from the rail built for it would defeat the
  // checkbox. Filler (when fewer than RAIL_SIZE are chosen) does avoid repeats.
  const chosen = showable.filter(f => f.featured === true).slice(0, RAIL_SIZE);
  const chosenIds = new Set(chosen.map(f => f.id));
  const filler = showable.filter(f => !chosenIds.has(f.id) && !used.has(f.id));
  const studio = [...chosen, ...filler].slice(0, RAIL_SIZE);

  return { trending, newIn, bridal, bridalUsesMaster, summer, studio, studioChosen: chosen.length };
}

/**
 * Everything on sale, one card per design, sellable first, newest first —
 * the home page's "keep scrolling" shelf.
 */
export function browseAll(products: Fabric[]): Fabric[] {
  const live = products.filter(p => isListed(p) && !awaitingPhoto(p)).sort(newestFirst);
  return sellableFirst(collapseToStyles(live));
}
