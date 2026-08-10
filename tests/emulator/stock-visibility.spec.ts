import { test, expect } from '@playwright/test';
import { Recorder } from './lib/recorder';
import { DESKTOP } from './lib/session';

/**
 * A product with no units left must never be presented as if it can be bought.
 *
 * The server side of this was already safe — /api/orders/place decrements stock
 * inside a Firestore transaction and rejects with `insufficient_stock` — so
 * nothing could ever be oversold. The failure was presentational: the grid card
 * rendered a stock-out identically to everything else, carrying its marketing
 * sticker and a live "add to bag" button, so a customer only discovered the
 * truth at the payment step.
 *
 * Fixture: `e2e-sold-out`, seeded with stock 0 AND sticker 'Bestseller', so
 * this also pins the rule that a stock-out outranks a marketing badge.
 */

const SOLD_OUT = 'E2E Sold Out Fixture';

test.use({ viewport: DESKTOP });

test('Storefront · sold-out product is badged, unbuyable, and off the home rails', async ({ page }) => {
  const rec = new Recorder({
    slug: 'stock-visibility',
    title: 'Storefront · out-of-stock is never presented as buyable',
    area: 'Storefront · Catalogue',
    purpose:
      'A product with zero units must be visibly marked "Sold out", must not offer add-to-bag, must not carry a marketing sticker, and must not be advertised on the home page rails — while remaining reachable at its own URL so shared links keep working.',
    reproduce: [
      'In the admin console, set any product\'s stock to 0 (Inventory → adjust).',
      'Open the home page: the product no longer appears in any rail.',
      'Open #/shop: the product is still listed, greyed, badged "Sold out", and sits below every in-stock piece.',
      'Its add-to-bag button on the card is disabled and does not open the quick-add sheet.',
      'Open the product page directly: it loads, and "Add to Bag" is disabled with an out-of-stock notice.',
    ],
  });

  try {
    // --- Home page: stock-outs are not merchandised -------------------------
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await rec.step(page, 'Home page', 'Rails advertise only pieces that can be shipped.');
    await expect(page.getByText(SOLD_OUT)).toHaveCount(0);
    rec.note('Sold-out product absent from every home rail',
      'Home rails are merchandising, so they filter on availability.');

    // --- Shop grid: still discoverable, clearly marked -----------------------
    await page.goto('/#/shop');
    await page.waitForLoadState('networkidle');
    const card = page.locator('.card-product').filter({ hasText: SOLD_OUT });
    await expect(card).toHaveCount(1);
    await card.scrollIntoViewIfNeeded();
    await rec.step(page, 'Shop grid', 'The stock-out is still listed — hiding it would break shared links.');

    // `exact` matters: this fixture's NAME also contains the words "Sold Out",
    // and getByText is a case-insensitive substring match by default.
    await expect(card.getByText('Sold out', { exact: true })).toBeVisible();
    rec.note('Card is badged "Sold out"', 'Visible before the customer invests any effort.');

    // The seeded sticker must be suppressed: a stock-out outranks marketing.
    await expect(card.getByText('Bestseller')).toHaveCount(0);
    rec.note('Marketing sticker suppressed',
      'The fixture carries sticker "Bestseller"; the card refuses to show it while unbuyable.');

    const addBtn = card.getByRole('button', { name: /is sold out$/i });
    await expect(addBtn).toBeDisabled();
    rec.note('Add-to-bag disabled on the card', 'Clicking it cannot open the quick-add sheet.');

    // --- Ordering: nothing buyable is pushed below a stock-out ---------------
    // The invariant is stronger than "the fixture is last": once sold-out
    // starts, every remaining card must also be sold out.
    const cards = page.locator('.card-product');
    const total = await cards.count();
    const soldOutFlags: boolean[] = [];
    for (let i = 0; i < total; i += 1) {
      soldOutFlags.push(
        (await cards.nth(i).getByText('Sold out', { exact: true }).count()) > 0,
      );
    }
    const firstSoldOut = soldOutFlags.indexOf(true);
    expect(firstSoldOut, 'the sold-out fixture must be in the grid').toBeGreaterThanOrEqual(0);
    expect(
      soldOutFlags.slice(firstSoldOut).every(Boolean),
      'no in-stock card may appear after a sold-out one',
    ).toBe(true);
    rec.note('Sold-out sinks below every in-stock piece',
      `${total} cards; the first sold-out is at position ${firstSoldOut + 1} and everything after it is also sold out.`);

    // --- Product page: reachable, but not purchasable ------------------------
    await page.goto('/#/product/e2e-sold-out');
    await page.waitForLoadState('networkidle');
    await rec.step(page, 'Product page', 'The URL still resolves, so shared links do not 404.');
    await expect(page.getByText(/out of stock — currently unavailable/i)).toBeVisible();
    // Target the PDP's own CTA by id: the "you might also like" rail below it
    // renders in-stock cards whose add-to-bag buttons would otherwise match.
    const pdpCta = page.locator('#pdp-add-to-bag');
    await expect(pdpCta).toBeDisabled();
    await expect(pdpCta).toHaveText(/out of stock/i);
    rec.note('Product page loads but cannot be added to the bag',
      'Deep links keep working; the buy path is closed and the CTA reads "Out of Stock".');

    rec.finish('passed');
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});
