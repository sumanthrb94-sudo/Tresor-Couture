import { test, expect } from '@playwright/test';
import { Recorder } from './lib/recorder';
import { adminPage, gotoAdmin } from './lib/session';

/**
 * Products → Photos & codes.
 *
 * Two questions the product grid could not answer, because it interleaves
 * everything into one list: which pieces are photographed, and which carry a
 * scan code. The second is the one that matters most — a barcode is allocated
 * when a piece is registered through the admin, so a piece WITHOUT one was
 * never entered that way and is a seeded row rather than stock on a shelf.
 *
 * These assertions are about the split being honest: exhaustive (every piece
 * lands in exactly one column), and the no-code count matching what is actually
 * flagged, so the headline can never disagree with the list beneath it.
 */
test('Products · Photos and scan codes, split and counted', async ({ browser }) => {
  test.setTimeout(120_000);

  const rec = new Recorder({
    slug: 'product-audit',
    title: 'Products · Photographed vs not, and which pieces are real stock',
    area: 'Admin console · Products',
    purpose:
      'The studio is deciding which photographs to replace, which needs the photographed and unphotographed sets side by side rather than a filter toggled back and forth. It also needs to tell registered stock from seeded rows: every piece entered through the admin is allocated a scan code, so a piece without one never was.',
    reproduce: [
      'Open #/admin/products and press "Photos & codes".',
      'The catalogue splits into two columns: with images, without images.',
      'The per-category table counts both, plus how many carry a scan code.',
      'Ticking "Only pieces with no scan code" narrows both columns to those.',
    ],
  });

  try {
    const adm = await adminPage(browser);
    await gotoAdmin(adm, 'products');
    await rec.step(adm, 'Signed in, on Products', 'The grid alone cannot say what is photographed or registered.');

    await adm.getByRole('button', { name: /photos & codes/i }).click({ timeout: 20_000 });
    await expect(adm.getByRole('heading', { name: /^by category$/i })).toBeVisible({ timeout: 15_000 });
    await rec.step(adm, 'The split view opens', 'Totals, a per-category table, and the two columns.', 'assert');

    // --- The split is exhaustive: nothing falls between the two columns ------
    // Read the counts off the column headers and the totals tile; if a piece
    // could be in neither (or both), these would not reconcile.
    // Read by test id, not by text: "Products" is also the page heading, so
    // matching on the word finds the title rather than the tile.
    const n = async (id: string): Promise<number> =>
      Number(((await adm.getByTestId(id).textContent()) ?? '').replace(/[^\d]/g, '')) || 0;

    const total = await n('audit-value-products');
    const withImg = await n('audit-count-with-images');
    const withoutImg = await n('audit-count-without-images');
    expect(total).toBeGreaterThan(0);
    expect(withImg + withoutImg).toBe(total);
    rec.note('Every piece lands in exactly one column', `${withImg} photographed + ${withoutImg} not = ${total}.`);

    // --- A piece with no scan code is flagged, not silently equivalent -------
    // The seeded catalogue is mostly un-barcoded, which is the same shape as
    // the real one: seeded rows carry no code because nothing allocated them.
    const noCodeBadges = adm.getByText('no scan code', { exact: true });
    expect(await noCodeBadges.count()).toBeGreaterThan(0);
    rec.step(adm, 'Un-registered pieces are called out', 'A missing code is not a blank cell — it is the marker that the piece was never registered through the admin.', 'assert');

    // --- The filter narrows to exactly those ---------------------------------
    await adm.getByLabel(/only pieces with no scan code/i).check();
    await adm.waitForTimeout(600);

    // Every line still shown must carry the badge — that is what the filter claims.
    const shownAfter = (await n('audit-count-with-images')) + (await n('audit-count-without-images'));
    expect(await adm.getByText('no scan code', { exact: true }).count()).toBe(shownAfter);
    expect(shownAfter).toBeLessThanOrEqual(total);
    await rec.step(adm, 'Filtered to pieces with no scan code', 'Every remaining line carries the badge, so the filter and the flag cannot drift apart.', 'assert');

    rec.finish('passed');
    await adm.context().close();
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});
