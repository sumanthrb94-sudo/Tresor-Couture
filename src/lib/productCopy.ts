import type { Fabric } from '../types';

/**
 * Placeholder descriptions, and the plain copy that replaces them.
 *
 * "Description is required" only checked that the box was not empty, so typing
 * `test` satisfied it — and a customer then read "test" on a product page, in
 * the search-engine snippet, and in the Google Shopping feed.
 */

const PLACEHOLDERS = new Set([
  'test', 'testing', 'test product', 'test description', 'demo', 'sample', 'dummy',
  'description', 'desc', 'lorem ipsum', 'asdf', 'xxx', 'na', 'n/a', 'tbd', 'todo', '.', '-',
]);

/** True when a description is a stand-in rather than copy a shopper can read. */
export function isPlaceholderDescription(text: string | undefined | null): boolean {
  const t = (text ?? '').trim().toLowerCase().replace(/[.!\s]+$/g, '');
  if (!t) return true;
  if (PLACEHOLDERS.has(t)) return true;
  if (/^(test|testing|asdf|lorem|dummy)\b/.test(t) && t.split(/\s+/).length <= 3) return true;
  return false;
}

/**
 * Copy built ONLY from what the record states: its name, colourway, category,
 * subcategory and how it is sold. It asserts nothing about fabric, handwork or
 * origin that the record does not already say, so it can be published without
 * anyone having to fact-check it — and is meant to be replaced by real words
 * when the studio writes them.
 */
export function fallbackDescription(
  f: Pick<Fabric, 'name' | 'colourName' | 'masterCategory' | 'category' | 'subCategory' | 'unitType' | 'bundleSizeMeters'>,
): string {
  const name = (f.name ?? '').trim() || 'This piece';
  const sub = (f.subCategory ?? '').trim();
  const master = (f.masterCategory ?? f.category ?? '').toString().trim();
  const colour = (f.colourName ?? '').trim();

  const kind = sub ? `${sub.toLowerCase()} from our ${master.toLowerCase()} collection` : `piece from our ${master.toLowerCase()} collection`;
  const parts = [`${name}${colour && !name.toLowerCase().includes(colour.toLowerCase()) ? ` in ${colour.toLowerCase()}` : ''} — a ${kind}.`];

  if (f.unitType === 'per meter') parts.push('Sold per metre.');
  else if (f.unitType === 'bundle') {
    parts.push(f.bundleSizeMeters ? `Sold as a ${f.bundleSizeMeters}-metre bundle.` : 'Sold as a bundle.');
  }
  parts.push('Photographed in the Tresor Couture studio; colours may vary slightly by screen.');
  return parts.join(' ');
}

/** What a shopper (and a search engine) should read: the studio's words, or plain copy if there are none. */
export function displayDescription(f: Parameters<typeof fallbackDescription>[0] & Pick<Fabric, 'description'>): string {
  return isPlaceholderDescription(f.description) ? fallbackDescription(f) : f.description.trim();
}
