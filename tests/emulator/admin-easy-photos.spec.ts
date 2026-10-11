import { test, expect } from '@playwright/test';
import path from 'path';
import { adminPage, gotoAdmin } from './lib/session';

/**
 * Listing a piece should take one photo pick, not four dialogs — and the
 * destructive tools must not sit next to "Add Product".
 */
const PHOTO = (n: string) => path.join(process.cwd(), 'public/products', n);

test('Admin · pick several photos once and they fill Main + gallery in order', async ({ browser }) => {
  test.setTimeout(120_000);
  const adm = await adminPage(browser);
  await gotoAdmin(adm, 'products');
  await adm.getByRole('button', { name: /add product/i }).first().click({ timeout: 15_000 });

  await adm.locator('#bulk-photos').setInputFiles([
    PHOTO('TC00049-main.webp'), PHOTO('TC00049-g1.webp'), PHOTO('TC00066-main.webp'),
  ]);
  await expect(adm.getByRole('status')).toContainText('3 photos added', { timeout: 30_000 });

  // Main + two gallery slots filled; the third gallery slot is still empty.
  for (const l of ['Main Photo', 'Gallery 1', 'Gallery 2'])
    await expect(adm.getByRole('button', { name: `View ${l} at full size` })).toBeVisible();
  await expect(adm.getByRole('button', { name: 'View Gallery 3 at full size' })).toHaveCount(0);

  // An uploaded photo reads as a status, not a 100KB base64 string.
  await expect(adm.getByPlaceholder('Drop a photo here, or use Upload').first()).toHaveValue(/^Photo uploaded · \d+ KB$/);

  // A photograph publishes a draft, as the single-slot upload does.
  await expect(adm.getByLabel('Listing status')).toHaveValue('Active');

  // Remove one, add one more: only the freed slot is used.
  await adm.getByRole('button', { name: 'Remove Gallery 1' }).click();
  await adm.locator('#bulk-photos').setInputFiles([PHOTO('TC00066-g1.webp'), PHOTO('TC00073-g1.webp'), PHOTO('TC00049-g1.webp')]);
  await expect(adm.getByRole('status')).toContainText('2 photos added');
  await expect(adm.getByRole('status')).toContainText('1 not added');
  await adm.context().close();
});

test('Admin · Wipe DB and Seed Laces are behind Advanced, not in the daily toolbar', async ({ browser }) => {
  test.setTimeout(90_000);
  const adm = await adminPage(browser);
  await gotoAdmin(adm, 'products');
  await expect(adm.getByRole('button', { name: /add product/i }).first()).toBeVisible({ timeout: 15_000 });
  await expect(adm.getByRole('button', { name: /wipe db/i })).toBeHidden();
  await expect(adm.getByRole('button', { name: /seed laces/i })).toBeHidden();
  await adm.getByText('Advanced', { exact: true }).click();
  await expect(adm.getByRole('button', { name: /wipe db/i })).toBeVisible();
  await adm.context().close();
});
