import { MASTER_CATEGORIES, MASTER_CATEGORY_TREE } from '../constants';
import type { Fabric, MasterCategory } from '../types';

/**
 * The master categories to OFFER a shopper, in the order a designer chose.
 *
 * Same rule as `subcategoriesFor` one level up: a section with nothing in it is
 * a menu link that lands on an empty page, so it is not shown. This matters most
 * the day a category is ADDED — 'Ethnic Wear' exists in the admin dropdowns from
 * the moment it is declared, because that is how its first product gets created,
 * but a shopper should not meet it until there is something to see.
 *
 * The pool passed in is the shopper's catalogue, which already excludes drafts
 * and retired pieces, so "has a product" means "has a product on sale" without
 * this needing to know what a draft is.
 *
 * An EMPTY pool returns everything. That is the catalogue still loading, not a
 * shop with nothing in it, and blanking the navbar for a second is worse than
 * briefly offering a section.
 */
export function masterCategoriesFor(
  products: Pick<Fabric, 'masterCategory' | 'category'>[],
): MasterCategory[] {
  if (!products.length) return MASTER_CATEGORIES;
  const inUse = new Set<string>();
  for (const p of products) {
    if (p.masterCategory) inUse.add(p.masterCategory);
    if (p.category) inUse.add(p.category);
  }
  return MASTER_CATEGORIES.filter(m => inUse.has(m));
}

/**
 * The subcategories to OFFER a shopper under a master category.
 *
 * `MASTER_CATEGORY_TREE` is the curated vocabulary — the list the admin
 * dropdown offers and the order a designer chose. It is not, and cannot be, the
 * navigation menu: it drifts the moment a product is created under a name the
 * tree does not know, and the drift is invisible because both halves look fine
 * on their own. Before this existed, the Lehenga Cholis menu offered Bridal,
 * Festive and Contemporary — none of which any product used — while all 14
 * lehengas sat under design names (Zardozi Floral, Threadwork…) the menu never
 * mentioned. Every menu link was a dead end and every product was unreachable
 * by subcategory, from two lists that each looked correct in isolation.
 *
 * So: derive the menu from the catalogue, and use the tree only for ORDER.
 * Curated names that have stock come first, in the designer's order; anything
 * else the catalogue actually contains follows alphabetically. A name with no
 * products is never shown, so a menu link always lands on something.
 */
export function subcategoriesFor(
  master: MasterCategory | string,
  products: Pick<Fabric, 'masterCategory' | 'category' | 'subCategory'>[],
): string[] {
  const inUse = new Set<string>();
  for (const p of products) {
    if (p.masterCategory !== master && p.category !== master) continue;
    const sub = p.subCategory?.trim();
    if (sub) inUse.add(sub);
  }

  const curated = MASTER_CATEGORY_TREE[master as MasterCategory] ?? [];
  const ordered = curated.filter(s => inUse.has(s));
  const extra = [...inUse].filter(s => !curated.includes(s)).sort((a, b) => a.localeCompare(b));
  return [...ordered, ...extra];
}
