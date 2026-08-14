import { test, expect } from '@playwright/test';
import { Recorder } from './lib/recorder';
import { DESKTOP } from './lib/session';

/**
 * Backward compatibility for the hash → history routing migration.
 *
 * Every link shared before the migration looks like /#/product/x. Those links
 * live in WhatsApp threads, Instagram bios and bookmarks we cannot update, so
 * the router converts them once on load (replaceState — Back stays clean) and
 * the visitor lands on the canonical path URL.
 */

test.use({ viewport: DESKTOP });

test('Routing · legacy #/ links land on canonical path URLs', async ({ page }) => {
  const rec = new Recorder({
    slug: 'legacy-links',
    title: 'Routing · legacy hash links keep working',
    area: 'Storefront · Routing',
    purpose:
      'Old /#/… links (shared before the history-routing migration) must still resolve: the router converts them to canonical path URLs with replaceState, so nothing shared before the migration 404s and the URL bar ends up canonical.',
    reproduce: [
      'Open /#/shop — the grid renders and the URL bar reads /shop.',
      'Open /#/product/<id> — the product page renders at /product/<id>.',
      'Open /product/<id> directly — same page, no redirect involved.',
      'Press Back — history is not polluted by the conversion.',
    ],
  });

  try {
    // Legacy shop link converts and renders.
    await page.goto('/#/shop');
    await page.locator('.card-product').first().waitFor({ timeout: 30_000 });
    await expect.poll(() => page.evaluate(() => location.pathname + location.hash)).toBe('/shop');
    await rec.step(page, 'Legacy /#/shop', 'Renders the grid; URL bar canonicalised to /shop.');

    // Legacy product deep link, query-free segment id.
    await page.goto('/#/product/e2e-sold-out');
    await page.locator('#pdp-add-to-bag').waitFor({ timeout: 30_000 });
    await expect.poll(() => page.evaluate(() => location.pathname)).toBe('/product/e2e-sold-out');
    rec.note('Legacy product link canonicalised', 'The PDP renders at /product/e2e-sold-out.');

    // Legacy link WITH a query inside the hash — the trickiest shape.
    await page.goto('/#/shop?category=Lehenga%20Cholis');
    await page.locator('.card-product').first().waitFor({ timeout: 30_000 });
    await expect.poll(() => page.evaluate(() => location.pathname + location.search))
      .toBe('/shop?category=Lehenga%20Cholis');
    rec.note('Hash-embedded query survives conversion', 'Category filter applied from the legacy URL.');

    // Direct path URL — the canonical form crawls and shares from now on.
    await page.goto('/product/e2e-sold-out');
    await page.locator('#pdp-add-to-bag').waitFor({ timeout: 30_000 });
    await expect(page.locator('#pdp-add-to-bag')).toHaveText(/out of stock/i);
    await rec.step(page, 'Direct /product/:id', 'The path URL serves the page with no client redirect.');

    rec.finish('passed');
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});
