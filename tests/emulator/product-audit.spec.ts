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

/**
 * The editor's photo previews.
 *
 * They were 48×56 CSS pixels, sitting beside the path field — too small to tell
 * one lace from another, which is the only reason to look at them. The studio
 * is choosing which photographs to replace, and that decision cannot be made
 * from a stamp.
 *
 * The dimensions readout is the point of the full-size view, not decoration:
 * uploads are downscaled to 800px on the long edge before being stored, so this
 * reports what the website will actually serve rather than the file that was
 * picked.
 */
test('Products · A photo in the editor can be seen at its real size', async ({ browser }) => {
  test.setTimeout(120_000);

  const rec = new Recorder({
    slug: 'product-photo-fullsize',
    title: 'Products · Editor photos open at full size',
    area: 'Admin console · Products',
    purpose:
      'Deciding whether a photograph is sharp, straight, or even the right piece is impossible at thumbnail size. Every photo field in the product editor now opens at the image\'s real pixel size and reports those dimensions, which is also how the studio can see that a stored image is smaller than the file they uploaded.',
    reproduce: [
      'Open #/admin/products and edit any product.',
      'Scroll to MEDIA. The preview beside each path field is legible, not a stamp.',
      'Click a preview to open the photograph at full size, with its pixel dimensions.',
      'Esc, Close, or clicking the backdrop returns to the editor.',
    ],
  });

  try {
    const adm = await adminPage(browser);
    await gotoAdmin(adm, 'products');
    await adm.getByRole('button', { name: /^edit/i }).first().click({ timeout: 20_000 });
    await rec.step(adm, 'A product is open in the editor', 'Each photo field carries a preview big enough to identify the piece.');

    await adm.getByRole('button', { name: /view Main Photo at full size/i }).click({ timeout: 15_000 });
    const viewer = adm.getByRole('dialog', { name: /full size/i });
    await expect(viewer).toBeVisible({ timeout: 10_000 });

    // The readout must be the image's real dimensions, not the box it sits in.
    const dims = await viewer.getByText(/^\d+ × \d+ px$/).textContent();
    const [w, h] = (dims ?? '').match(/\d+/g)?.map(Number) ?? [];
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);

    const natural = await viewer.locator('img').evaluate(
      el => [(el as HTMLImageElement).naturalWidth, (el as HTMLImageElement).naturalHeight]);
    expect([w, h]).toEqual(natural);
    await rec.step(adm, 'The photograph opens at full size', `Reported ${w} × ${h} px, which is the image's own resolution — so a soft photograph is visibly soft here.`, 'assert');

    // Esc must close it: the viewer covers the editor it was opened from, and a
    // modal you can only leave by finding the right button is a trap.
    await adm.keyboard.press('Escape');
    await expect(viewer).toBeHidden({ timeout: 10_000 });
    await expect(adm.getByRole('button', { name: /view Main Photo at full size/i })).toBeVisible();
    await rec.step(adm, 'Esc returns to the editor', 'With the form still open and unchanged.', 'assert');

    rec.finish('passed');
    await adm.context().close();
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});
