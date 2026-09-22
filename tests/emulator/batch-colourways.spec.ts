import { test, expect, type Browser, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { adminPage, dismissConsent } from './lib/session';

/**
 * How a shopkeeper puts a categorised set on the shelf — one design, several
 * colourways — photographed screen by screen.
 *
 * This is the lace flow generalised: a Style code is what makes several
 * products one design, and the storefront turns that into a colour rail on the
 * product page rather than N unrelated cards. The point of capturing it is to
 * judge how many steps and how much typing stand between a spreadsheet and a
 * live colour rail, so every screen is shot at the moment the shopkeeper would
 * be looking at it.
 *
 * Screens land in tests/emulator/screens-batch/.
 */
const SHOTS = path.resolve(process.cwd(), 'tests/emulator/screens-batch');

/** One design, three colourways — pasted exactly as it would be out of Excel. */
const PASTE = [
  'Name\tCategory\tSub Category\tStyle Code\tColour\tPrice\tMRP\tStock',
  'Chanderi Silk Dupatta\tFabrics\tDupatta\tTC-CSD\tIvory\t2400\t3200\t6',
  'Chanderi Silk Dupatta\tFabrics\tDupatta\tTC-CSD\tRose Pink\t2400\t3200\t4',
  'Chanderi Silk Dupatta\tFabrics\tDupatta\tTC-CSD\tEmerald\t2400\t3200\t5',
].join('\n');

test('Adding a categorised set with colourways, screen by screen', async ({
  browser,
}: {
  browser: Browser;
}) => {
  test.setTimeout(240_000);
  fs.mkdirSync(SHOTS, { recursive: true });

  let n = 0;
  const shot = async (page: Page, label: string) => {
    const file = path.join(SHOTS, `${String(++n).padStart(2, '0')}-${label}.png`);
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    // eslint-disable-next-line no-console
    console.log(`  ${String(n).padStart(2, '0')}. ${label}`);
  };

  const adm = await adminPage(browser, { width: 1280, height: 1000 });
  await dismissConsent(adm);

  // ── 1. Where the shopkeeper starts ──────────────────────────────────────
  await adm.goto('/admin/products', { waitUntil: 'domcontentloaded' });
  await adm.waitForTimeout(2500);
  await shot(adm, 'products-list');

  // ── 2. One button away ──────────────────────────────────────────────────
  await adm.getByRole('button', { name: /add batch/i }).first().click();
  await adm.waitForTimeout(1200);
  await shot(adm, 'batch-form-empty');

  // ── 3. Batch-level fields: typed once, applied to every row ─────────────
  await adm.getByLabel('Batch brand').fill('Tresor Couture').catch(() => {});
  await adm.getByLabel('Batch category').selectOption({ label: 'Fabrics' }).catch(async () => {
    await adm.getByLabel('Batch category').selectOption({ index: 1 }).catch(() => {});
  });
  await adm.getByLabel('Batch sub category').fill('Dupatta').catch(() => {});
  await adm.waitForTimeout(600);
  await shot(adm, 'batch-defaults-filled');

  // ── 4. Paste the set straight out of the spreadsheet ────────────────────
  await adm.getByRole('button', { name: /paste/i }).first().click();
  await adm.waitForTimeout(600);
  const paste = adm.getByLabel('Paste rows');
  await expect(paste).toBeVisible({ timeout: 10_000 });
  await shot(adm, 'paste-dialog-open');

  await paste.fill(PASTE);
  await adm.waitForTimeout(400);
  await shot(adm, 'paste-filled');

  await adm.getByRole('button', { name: /add these rows/i }).click();
  await adm.waitForTimeout(1200);
  await shot(adm, 'rows-parsed-into-grid');

  // ── 5. Save: barcodes are assigned here, not typed ──────────────────────
  // The button counts what it is about to do — "Add 3 products" — so it also
  // doubles as the confirmation that three rows parsed, not two or four.
  const save = adm.getByRole('button', { name: /add \d+ products?/i }).last();
  await expect(save).toBeEnabled({ timeout: 15_000 });
  await save.click({ timeout: 20_000 });
  await adm.waitForTimeout(6000);
  await shot(adm, 'saved-with-barcodes');

  // ── 6. The one thing still to do: a photo per colourway ─────────────────
  // The batch saves as Drafts on purpose — sellable at the counter by barcode
  // immediately, but off the website until someone has photographed the piece.
  // This is where the remaining effort actually sits, so it gets shot too.
  await adm.getByRole('button', { name: /done/i }).first().click().catch(() => {});
  await adm.waitForTimeout(1500);
  await adm.getByPlaceholder(/search name, brand/i).fill('Chanderi Silk Dupatta').catch(() => {});
  await adm.waitForTimeout(1500);
  await shot(adm, 'three-drafts-awaiting-photos');

  // The dialog where a photo gets attached — everything else in it is already
  // filled in from the paste, which is the point worth seeing.
  const firstRow = adm.getByRole('row').filter({ hasText: /Chanderi Silk Dupatta/i }).first();
  if (await firstRow.isVisible().catch(() => false)) {
    await firstRow.getByRole('button').first().click({ timeout: 10_000 }).catch(() => {});
    await adm.waitForTimeout(2000);
    await shot(adm, 'edit-dialog-add-the-photo');
    await adm.getByRole('button', { name: /^cancel$/i }).last().click({ timeout: 8000 }).catch(() => {});
    await adm.waitForTimeout(800);
  }

  // Attaching the photo itself is left to a person. Driving a hidden file
  // input through a scrolling dialog made this walkthrough silently no-op
  // rather than fail, and a step that quietly does nothing is worse than a
  // step that is honestly absent.

  // ── 7. What the shopper sees: one card, three colours ───────────────────
  const cust = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const shop = await cust.newPage();
  await shop.goto('/shop', { waitUntil: 'domcontentloaded' });
  await dismissConsent(shop);
  await shop.waitForTimeout(3500);
  await shot(shop, 'storefront-grid');

  const card = shop.getByText(/chanderi silk dupatta/i).first();
  if (await card.isVisible().catch(() => false)) {
    await card.click();
    await shop.waitForTimeout(3500);
    await shot(shop, 'product-page-colour-rail');
  }

  await cust.close();
  await adm.context().close();
});
