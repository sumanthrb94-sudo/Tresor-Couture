import { test, expect } from '@playwright/test';
import { Recorder } from './lib/recorder';
import { DESKTOP } from './lib/session';
import { awaitingPhoto, isListed } from '../../src/lib/availability';
import { subcategoriesFor } from '../../src/lib/subcategories';
import type { Fabric } from '../../src/types';

/**
 * Bulk import: what a spreadsheet row becomes, and what it must not become.
 *
 * The store is filled from a workbook, one row per product, largely before the
 * pieces have been photographed. Two rules make that safe, and both are pinned
 * here:
 *
 *  1. A product with no photograph is registered as a DRAFT — it has stock, a
 *     barcode and a counter price, but no shopper ever sees it. Publishing is a
 *     separate, deliberate act.
 *  2. The subcategory menus are derived from the catalogue, so a design name
 *     the import invents is reachable, and a curated name nothing uses is never
 *     offered. Before this, the Lehenga Cholis menu offered three subcategories
 *     no product used while all fourteen lehengas sat under design names the
 *     menu never mentioned: every link a dead end, from two lists that each
 *     looked correct on their own.
 *
 * Fixture: `e2e-draft`, seeded with `listingStatus: 'Draft'` and stock 7. The
 * stock is non-zero on purpose — if it were zero the storefront would hide it
 * for the sold-out reason and this test would pass on the wrong mechanism.
 */

const DRAFT = 'E2E Draft Fixture';

const base: Fabric = {
  id: 'x', brand: 'TRESOR', name: 'Piece',
  description: 'A piece.', price: 1000, mrp: 1000, photo: '', image: '',
  category: 'Lehenga Cholis', masterCategory: 'Lehenga Cholis', tags: [], stock: 3,
};
const make = (over: Partial<Fabric>): Fabric => ({ ...base, ...over });

test('Catalogue import · draft rules and derived subcategory menus', async () => {
  const rec = new Recorder({
    slug: 'catalogue-import-rules',
    title: 'Catalogue import · draft visibility and subcategory menus',
    area: 'Catalogue · Bulk import',
    purpose:
      'A bulk-imported product with no photograph must stay off the storefront while remaining fully usable for stock, barcodes and counter billing; and the subcategory menus must follow the catalogue rather than a static list that silently drifts from it.',
    reproduce: [
      'Fill the Catalogue sheet of docs/ops/tresor-catalogue-TEMPLATE.xlsx, leaving Image URL blank on one row.',
      'python3 scripts/catalogue-xlsx-to-json.py <file>.xlsx -o import.json',
      'npx tsx scripts/import-catalogue.ts import.json --dry-run — the imageless row is reported as Draft.',
      'Run it for real: the product exists with a barcode but does not appear on the storefront.',
      'Admin → Inventory → Listing → "On the website" publishes it.',
    ],
  });

  try {
    // --- Rule 1: what counts as published ----------------------------------
    // A missing field means published: every product written before the field
    // existed must keep behaving exactly as it did.
    expect(isListed(make({ listingStatus: undefined }))).toBe(true);
    expect(isListed(make({ listingStatus: 'Active' }))).toBe(true);
    expect(isListed(make({ listingStatus: 'Draft' }))).toBe(false);
    expect(isListed(make({ listingStatus: 'Retired' }))).toBe(false);

    // Listing and stock are independent axes. A sold-out piece stays listed —
    // its page stays up and shared links keep working — whereas a draft was
    // never published at all.
    expect(isListed(make({ stock: 0 }))).toBe(true);
    expect(isListed(make({ stock: 99, listingStatus: 'Draft' }))).toBe(false);
    rec.note('Draft is not sold-out', 'Listing status and stock are separate; neither stands in for the other.');

    // --- What counts as "not photographed yet" -----------------------------
    // The generated swatch is what a product has INSTEAD of a photograph, so it
    // is the marker for the reshoot queue.
    expect(awaitingPhoto(make({ photo: '' }))).toBe(true);
    expect(awaitingPhoto(make({ photo: '   ' }))).toBe(true);
    expect(awaitingPhoto(make({ photo: 'data:image/svg+xml;utf8,%3Csvg' }))).toBe(true);
    expect(awaitingPhoto(make({ photo: '/products/lace/HA6758.jpg' }))).toBe(false);
    expect(awaitingPhoto(make({ photo: 'https://tresorcouture.in/a.jpg' }))).toBe(false);
    // The 34 rescued laces once held real photographs as data:image/jpeg URIs —
    // badly stored, but genuinely shot. Calling those unphotographed would put
    // finished work back in the queue.
    expect(awaitingPhoto(make({ photo: 'data:image/jpeg;base64,/9j/4AAQ' }))).toBe(false);
    rec.note('Swatch means "not shot yet"', 'Only the generated SVG counts — a badly-stored real photograph is still a photograph.');

    // --- Rule 2: menus follow the catalogue --------------------------------
    // The exact regression: design names in use, curated names unused.
    const lehengas = [
      make({ id: 'a', subCategory: 'Zardozi Floral' }),
      make({ id: 'b', subCategory: 'Zardozi Floral' }),
      make({ id: 'c', subCategory: 'Threadwork' }),
    ];
    const menu = subcategoriesFor('Lehenga Cholis', lehengas);
    expect(menu).toEqual(['Zardozi Floral', 'Threadwork']);
    // Bridal/Festive/Contemporary are in MASTER_CATEGORY_TREE and must NOT be
    // offered while nothing uses them — an empty menu link is a dead end.
    expect(menu).not.toContain('Bridal');

    // Curated names that DO have stock keep the designer's order and come
    // first; anything the catalogue invented follows alphabetically.
    const sarees = [
      make({ id: 'd', masterCategory: 'Sarees', category: 'Sarees', subCategory: 'Zzz Custom' }),
      make({ id: 'e', masterCategory: 'Sarees', category: 'Sarees', subCategory: 'Kanjivaram' }),
      make({ id: 'f', masterCategory: 'Sarees', category: 'Sarees', subCategory: 'Aaa Custom' }),
      make({ id: 'g', masterCategory: 'Sarees', category: 'Sarees', subCategory: 'Banarasi' }),
    ];
    expect(subcategoriesFor('Sarees', sarees)).toEqual(['Banarasi', 'Kanjivaram', 'Aaa Custom', 'Zzz Custom']);

    // A product with no subcategory contributes nothing rather than an empty entry.
    expect(subcategoriesFor('Lehenga Cholis', [make({ subCategory: undefined }), make({ subCategory: '  ' })])).toEqual([]);
    rec.note('Menus follow the catalogue', 'Curated order first, invented names after, nothing empty.');

    rec.finish('passed');
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});

test.describe('Storefront', () => {
  test.use({ viewport: DESKTOP });

  test('Storefront · a draft product is nowhere a shopper can reach', async ({ page }) => {
    const rec = new Recorder({
      slug: 'catalogue-import-draft-hidden',
      title: 'Storefront · draft products are invisible',
      area: 'Storefront · Catalogue',
      purpose:
        'A whole store can be registered from a spreadsheet before anything is photographed. That is only safe if an unpublished product is absent from the home page, the shop grid and search — not merely unbuyable.',
      reproduce: [
        'Import a product with Listing Status "Draft" (or with no Image URL).',
        'Open the home page, /shop and the search bar: it appears in none of them.',
        'Admin → Inventory shows it with a Draft badge and can publish it.',
      ],
    });

    try {
      await page.goto('/');
      // Content wait, not networkidle: the Firestore listener keeps a long-poll
      // channel open, so the network never goes idle.
      await page.locator('.card-product').first().waitFor({ timeout: 30_000 });
      await expect(page.getByText(DRAFT, { exact: false })).toHaveCount(0);
      await rec.step(page, 'Home page', 'The draft is not merchandised on any rail.');

      await page.goto('/shop');
      await page.locator('.card-product').first().waitFor({ timeout: 30_000 });
      await expect(page.getByText(DRAFT, { exact: false })).toHaveCount(0);
      await rec.step(page, 'Shop grid', 'The draft is absent from the full catalogue grid too — unlike a sold-out piece, which stays listed.');

      // Sanity: the grid is genuinely populated, so "not found" means hidden
      // rather than "nothing loaded".
      expect(await page.locator('.card-product').count()).toBeGreaterThan(0);

      await page.goto('/search?q=E2E');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByText(DRAFT, { exact: false })).toHaveCount(0);
      await rec.step(page, 'Search results', 'Search runs over the same published catalogue, so a draft cannot surface here either.');

      rec.finish('passed');
    } catch (err) {
      rec.finish('failed', err instanceof Error ? err.message : String(err));
      throw err;
    }
  });
});
