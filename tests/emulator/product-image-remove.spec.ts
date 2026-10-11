import { test, expect, type Page } from '@playwright/test';
import { adminPage, gotoAdmin } from './lib/session';

/**
 * The product editor must let the operator take a photograph OFF a product.
 *
 * Each image slot used to offer upload, camera and quick-pick — and nothing to
 * remove. The only way to lose a wrong photo was to select the path text and
 * delete it by hand, which on a phone, with a base64 string in the box, is not
 * something anyone discovers. Every slot now has a visible trash control.
 */

const DOC = 'http://127.0.0.1:8080/v1/projects/demo-tresor/databases/(default)/documents/products/e2e-gallery';
const AUTH = { Authorization: 'Bearer owner', 'content-type': 'application/json' };
const s = (v: string) => ({ stringValue: v });
const n = (v: number) => ({ integerValue: String(v) });

async function seed(): Promise<void> {
  const fields = {
    id: s('e2e-gallery'), brand: s('TRESOR COUTURE'), name: s('E2E Gallery Piece'),
    description: s('A piece with a main photograph and three gallery shots, for the remove-image test.'),
    price: n(500), mrp: n(500), stock: n(4), listingStatus: s('Active'),
    category: s('Laces'), masterCategory: s('Laces'), subCategory: s('Trim & Edging'),
    photo: s('/products/TC00049-main.webp'), image: s('/products/TC00049-main.webp'),
    photoGallery: { arrayValue: { values: [
      s('/products/TC00049-g1.webp'), s('/products/TC00066-g1.webp'), s('/products/TC00066-main.webp'),
    ] } },
  };
  const r = await fetch(DOC, { method: 'PATCH', headers: AUTH, body: JSON.stringify({ fields }) });
  expect(r.ok).toBe(true);
}

async function stored(): Promise<{ gallery: string[]; photo: string; status: string }> {
  const r = await fetch(DOC, { headers: AUTH });
  const f = ((await r.json()) as { fields: Record<string, any> }).fields;
  return {
    gallery: (f.photoGallery?.arrayValue?.values ?? []).map((v: { stringValue: string }) => v.stringValue),
    photo: f.photo.stringValue,
    status: f.listingStatus.stringValue,
  };
}

async function openEditor(adm: Page): Promise<void> {
  await gotoAdmin(adm, 'products');
  await adm.getByPlaceholder(/search/i).first().fill('E2E Gallery Piece');
  await adm.getByRole('button', { name: /^edit/i }).first().click({ timeout: 20_000 });
  await expect(adm.getByRole('button', { name: /view Gallery 2 at full size/i })).toBeVisible({ timeout: 15_000 });
}

test('Admin · a single gallery photo can be removed, and the rest stay in order', async ({ browser }) => {
  test.setTimeout(120_000);
  await seed();
  const adm = await adminPage(browser);
  await openEditor(adm);

  // Every filled slot has the control, on the thumbnail and as a labelled button.
  for (const id of ['main', 'gallery1', 'gallery2', 'gallery3']) {
    await expect(adm.getByTestId(`remove-${id}`)).toBeVisible();
  }

  await adm.getByRole('button', { name: 'Remove Gallery 2' }).click();
  await expect(adm.getByRole('button', { name: /view Gallery 2 at full size/i })).toHaveCount(0);
  await expect(adm.getByRole('button', { name: /view Gallery 1 at full size/i })).toBeVisible();
  await expect(adm.getByRole('button', { name: /view Gallery 3 at full size/i })).toBeVisible();

  // Nothing is written until Save.
  expect((await stored()).gallery).toHaveLength(3);

  await adm.getByRole('button', { name: /^(save|update)/i }).last().click();
  await expect.poll(async () => (await stored()).gallery.length, { timeout: 20_000 }).toBe(2);
  const after = await stored();
  expect(after.gallery).toEqual(['/products/TC00049-g1.webp', '/products/TC00066-main.webp']);
  expect(after.photo).toBe('/products/TC00049-main.webp');
  expect(after.status).toBe('Active');
  await adm.context().close();
});

test('Admin · removing the main photo of a live product moves it to Draft', async ({ browser }) => {
  test.setTimeout(120_000);
  await seed();
  const adm = await adminPage(browser);
  await openEditor(adm);

  await expect(adm.getByText(/Removing the main photo moves this piece to Draft/i)).toBeVisible();
  await adm.getByRole('button', { name: 'Remove Main Photo' }).click();
  await expect(adm.getByLabel('Listing status')).toHaveValue('Draft');

  await adm.getByRole('button', { name: /^(save|update)/i }).last().click();
  await expect.poll(async () => (await stored()).status, { timeout: 20_000 }).toBe('Draft');
  await adm.context().close();
});
