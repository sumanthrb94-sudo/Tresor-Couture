/**
 * How a lace is sold — the three shapes, named once.
 *
 * There are three, and conflating any two of them is a pricing or a stock bug:
 *
 *   'per meter'            cut from the roll. `price` is per metre,
 *                          `stock` counts METRES.
 *   'bundle'               cut from the roll, with a bundle PRICE BREAK.
 *                          `price` is still per metre, `stock` still counts
 *                          metres; `bundlePrice` buys `bundleSizeMeters` of
 *                          them cheaper. See api/_lib/lacePricing.ts.
 *   'unit' + bundleSize    sold ONLY as a whole bundle — the roll is never cut.
 *                          `price` is the price of ONE BUNDLE and `stock`
 *                          counts BUNDLES, not metres.
 *
 * The third is why this file exists. A bundle-only lace is not metered
 * merchandise at all: a customer cannot buy three metres of it, so quantity
 * means bundles and every "meters" label on the page would be a lie. Modelling
 * it as a plain unit is what makes that true throughout — the cart, the stock
 * decrement and the till all count the same thing without a special case —
 * and `bundleSizeMeters` rides along only to say how long one bundle is.
 */
import type { Fabric } from '../types';

/** Sold only as a whole bundle: price is per bundle, stock counts bundles. */
export function bundleOnly(f: Pick<Fabric, 'category' | 'unitType' | 'bundleSizeMeters'>): boolean {
  return f.category === 'Laces' && f.unitType === 'unit' && (f.bundleSizeMeters ?? 0) > 0;
}

/** Is this priced and stocked in METRES? (Both cut-from-the-roll shapes.) */
export function meteredLace(f: Pick<Fabric, 'unitType'>): boolean {
  return f.unitType === 'per meter' || f.unitType === 'bundle';
}

/** The short badge shown on a card and beside the price. */
export function unitBadge(
  f: Pick<Fabric, 'category' | 'unitType' | 'bundleSizeMeters'>,
): string | null {
  if (f.category !== 'Laces') return null;
  if (bundleOnly(f)) return `${f.bundleSizeMeters}m bundle only`;
  if (f.unitType === 'bundle' && f.bundleSizeMeters) return `${f.bundleSizeMeters}m bundle rate`;
  if (f.unitType === 'per meter') return 'Sold per meter';
  if (f.unitType === 'unit') return 'Sold as unit';
  return null;
}

/** What the stock number counts, in words the shopper can act on. */
export function stockLabel(
  f: Pick<Fabric, 'category' | 'unitType' | 'bundleSizeMeters'>,
  stock: number,
): string {
  if (bundleOnly(f)) {
    return `${stock === 1 ? 'bundle' : 'bundles'} of ${f.bundleSizeMeters}m`;
  }
  if (f.category === 'Laces' && f.unitType === 'bundle' && f.bundleSizeMeters) {
    const whole = Math.floor(stock / f.bundleSizeMeters);
    return `meters (${whole} bundle${whole === 1 ? '' : 's'})`;
  }
  if (f.category === 'Laces' && meteredLace(f)) return 'meters';
  return stock === 1 ? 'piece' : 'pieces';
}

/** The word for one of whatever is being counted, for a quantity picker. */
export function quantityNoun(f: Pick<Fabric, 'category' | 'unitType' | 'bundleSizeMeters'>): string {
  if (bundleOnly(f)) return 'bundles';
  if (meteredLace(f)) return 'meters';
  return 'pieces';
}
