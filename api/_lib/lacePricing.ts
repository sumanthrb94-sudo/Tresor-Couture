/**
 * What a length of lace costs.
 *
 * Lace is held and sold in METRES. `stock` is metres, a cart line's `quantity`
 * is metres, and `price` is the loose per-metre rate. A bundle is not a
 * different unit — it is a PRICE BREAK on the same metres: `bundleSizeMeters`
 * metres for `bundlePrice`, cheaper than buying them loose.
 *
 * Keeping one unit throughout is what makes the stock arithmetic honest. The
 * order transaction in /api/orders/place decrements `stock` by `quantity`, so
 * if `quantity` ever counted bundles while `stock` counted metres, every bundle
 * sold would take nine metres off the shelf and one off the record.
 *
 * THE RULE: a customer is never charged more for ordering less.
 *
 * A plain price break has an ugly edge. With a 9m bundle at 1800 (200/m) and
 * loose lace at 250/m, eight metres would cost 2000 and nine would cost 1800 —
 * so ordering less costs more. Nobody can defend that at a counter. Instead the
 * cost of N metres is the cheapest honest way to cover N metres, which means
 * eight metres is sold as the nine-metre bundle at 1800 and the customer simply
 * gets a metre they did not ask for.
 *
 * This file has no imports on purpose. It is the one place the rule lives, and
 * both the authoritative server pricing (api/_lib/pricing.ts) and the cart's
 * on-screen totals import it, so the number a shopper sees and the number the
 * card is charged cannot drift apart.
 */

export interface LaceTerms {
  /** Loose per-metre rate for lace; per-piece price for anything else. */
  price: number;
  unitType?: string | null;
  bundleSizeMeters?: number | null;
  bundlePrice?: number | null;
}

export interface LineCost {
  /** Rupees for the whole line. */
  total: number;
  /** Whole bundles charged. */
  bundles: number;
  /** Metres charged at the loose rate. */
  looseMeters: number;
  /** Metres the customer receives — more than they asked for when rounding a
   *  part-bundle up was the cheaper way to cover the order. */
  metersGiven: number;
  /** What the same metres would have cost with no bundle break. */
  wouldHaveCost: number;
}

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;

/** True when this product actually has a bundle break to apply. */
export function hasBundleBreak(t: LaceTerms): boolean {
  const size = num(t.bundleSizeMeters);
  const bp = num(t.bundlePrice);
  return t.unitType === 'bundle' && size !== undefined && size > 0 && bp !== undefined && bp > 0;
}

/**
 * Cost of `meters` metres.
 *
 * Only three candidates are ever worth testing, which is why this is arithmetic
 * rather than a search. Let f(b) be the cost of covering the order with b
 * bundles plus any shortfall loose:
 *
 *   for b below N/size   f(b) = N*price + b*(bundlePrice - size*price)   — linear in b
 *   for b above N/size   f(b) = b*bundlePrice                            — increasing
 *
 * The first is linear, so on that side the best b is whichever end the slope
 * points to: all-loose when a bundle is not actually cheaper per metre, or as
 * many whole bundles as fit when it is. The second only ever grows, so on that
 * side the best b is the smallest one that covers the order. Hence: none, the
 * whole bundles that fit, or one more than that.
 */
export function costOf(t: LaceTerms, meters: number): LineCost {
  const price = num(t.price) ?? 0;

  // A nonsense length costs nothing rather than costing NEGATIVE. The server
  // rejects quantity <= 0 before it prices anything, but the cart's on-screen
  // total calls straight in here, and a line worth minus seven hundred rupees
  // would quietly discount the rest of the basket. A pricing primitive should
  // not depend on a guard living in another file.
  if (!Number.isFinite(meters) || meters <= 0) {
    return { total: 0, bundles: 0, looseMeters: 0, metersGiven: 0, wouldHaveCost: 0 };
  }

  const loose = Math.round(price * meters);
  if (!hasBundleBreak(t)) {
    return { total: loose, bundles: 0, looseMeters: meters, metersGiven: meters, wouldHaveCost: loose };
  }

  const size = num(t.bundleSizeMeters)!;
  const bundlePrice = num(t.bundlePrice)!;
  const whole = Math.floor(meters / size);

  const candidates = [0, whole, whole + 1].filter((b, i, a) => b >= 0 && a.indexOf(b) === i);
  let best = { total: Infinity, bundles: 0, looseMeters: 0, metersGiven: 0 };
  for (const b of candidates) {
    const shortfall = Math.max(0, meters - b * size);
    const total = Math.round(b * bundlePrice + shortfall * price);
    // Ties go to the option with fewer bundles, so a customer is not handed
    // extra lace when it saved them nothing.
    if (total < best.total) {
      best = { total, bundles: b, looseMeters: shortfall, metersGiven: Math.max(meters, b * size + shortfall) };
    }
  }
  return { ...best, wouldHaveCost: loose };
}

/** Rupees for a line — the number that reaches the card. */
export const lineTotal = (t: LaceTerms, meters: number): number => costOf(t, meters).total;

/**
 * How a line reads on screen: "1 bundle + 3m", "2 bundles", "5m".
 * Returns an empty string for an ordinary product, whose quantity needs no gloss.
 */
export function describeLine(t: LaceTerms, meters: number): string {
  if (!hasBundleBreak(t)) return '';
  const c = costOf(t, meters);
  const parts: string[] = [];
  if (c.bundles > 0) parts.push(`${c.bundles} bundle${c.bundles === 1 ? '' : 's'}`);
  if (c.looseMeters > 0) parts.push(`${c.looseMeters}m`);
  return parts.join(' + ');
}
