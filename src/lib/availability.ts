import type { Fabric } from '../types';

/**
 * Availability helpers shared by every surface that lists product.
 *
 * `stock` is optional on Fabric: a document that has never been through the
 * inventory screen simply has no field. Treat that as zero rather than as
 * "unlimited" — advertising something we cannot ship is worse than hiding a
 * product whose stock nobody has entered yet.
 *
 * The server is the real gate: /api/orders/place decrements stock inside a
 * Firestore transaction and rejects with `insufficient_stock:{fabricId}`, so an
 * item can never be oversold. These helpers exist so a customer finds out on
 * the grid instead of at the payment step.
 */

type HasStock = Pick<Fabric, 'stock'>;

/** Units we can actually ship today. */
export const unitsAvailable = (f: HasStock): number =>
  typeof f.stock === 'number' && Number.isFinite(f.stock) ? Math.max(0, f.stock) : 0;

export const inStock = (f: HasStock): boolean => unitsAvailable(f) > 0;

/**
 * Move sold-out items to the end, preserving the caller's ordering within each
 * group (Array.prototype.sort is stable in every engine we target). Used for
 * browse surfaces, where hiding stock-outs entirely would collapse a category
 * and break links people have already shared.
 */
export const sellableFirst = <T extends HasStock>(list: T[]): T[] =>
  [...list].sort((a, b) => Number(inStock(b)) - Number(inStock(a)));

/**
 * Whether a product belongs on the public storefront.
 *
 * Separate from stock on purpose: a sold-out piece is still *listed* (its page
 * stays up, links keep working, it just cannot be added to a bag), whereas a
 * Draft has never been published at all. Bulk imports create Drafts — a whole
 * store can be registered for inventory, barcodes and counter billing long
 * before any of it has been photographed, and each piece goes live the day its
 * photo does.
 *
 * A missing `listingStatus` means "published" so every product that predates
 * the field keeps behaving exactly as it did.
 */
type HasListing = Pick<Fabric, 'listingStatus'>;

export const isListed = (f: HasListing): boolean =>
  f.listingStatus === undefined || f.listingStatus === 'Active';
