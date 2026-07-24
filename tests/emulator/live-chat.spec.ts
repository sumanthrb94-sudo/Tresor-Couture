import { test, expect, type Page, type Browser } from '@playwright/test';

/**
 * End-to-end live-chat test against the Firebase Emulator Suite (Auth +
 * Firestore), which loads the real firestore.rules. Two independent browser
 * contexts — a signed-in customer and a signed-in admin — exchange messages
 * and assert real-time delivery in both directions with no page reload.
 *
 * Run sequence (see tests/emulator/README.md):
 *   1) npm run emulators            (Auth 9099 + Firestore 8080)
 *   2) FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *      FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-tresor \
 *      npm run seed:emulator
 *   3) VITE_USE_EMULATORS=1 <emulator firebase config> npm run build && npm run preview -- --port 4173
 *   4) npm run test:chat
 */

const PASSWORD = 'Test1234!';

async function dismissConsent(page: Page) {
  const b = page.getByRole('button', { name: /essential only/i });
  if (await b.isVisible().catch(() => false)) await b.click().catch(() => {});
}

// NB: never wait for 'networkidle' — a live Firestore listener keeps a
// connection open, so the page never reaches network idle. Wait for elements.
async function signIn(page: Page, email: string) {
  await page.goto('/#/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 20_000 });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(PASSWORD);
  await page.getByRole('button', { name: /^login$/i }).click();
  await page.waitForFunction(() => !location.hash.includes('login'), null, { timeout: 25_000 });
  await dismissConsent(page);
}

test('live chat: customer <-> admin real-time, both directions', async ({ browser }: { browser: Browser }) => {
  const nonce = String(Date.now()).slice(-6);
  const custMsg1 = `PING1-${nonce}`;
  const custMsg2 = `PING2-${nonce}`;
  const admMsg = `PONG-${nonce}`;

  // ---- Customer ----
  const custCtx = await browser.newContext();
  const cust = await custCtx.newPage();
  await signIn(cust, 'customer@test.local');
  await cust.getByRole('button', { name: /chat with us/i }).click();
  const custInput = cust.getByPlaceholder('Type a message…');
  await expect(custInput).toBeVisible({ timeout: 15_000 });
  await custInput.fill(custMsg1);
  await custInput.press('Enter');
  await expect(cust.getByText(custMsg1)).toBeVisible({ timeout: 10_000 });

  // ---- Admin (opens AFTER the first customer message) ----
  const admCtx = await browser.newContext();
  const adm = await admCtx.newPage();
  await signIn(adm, 'admin@test.local');
  await adm.goto('/#/admin/support', { waitUntil: 'domcontentloaded' });
  await expect(adm.getByRole('heading', { name: /support/i })).toBeVisible({ timeout: 20_000 });
  await expect(adm.getByText('Test Customer').first()).toBeVisible({ timeout: 20_000 });
  await adm.getByText('Test Customer').first().click();
  await expect(adm.getByText(custMsg1)).toBeVisible({ timeout: 15_000 });

  // ---- Real-time customer -> admin (thread open on admin side) ----
  await custInput.fill(custMsg2);
  await custInput.press('Enter');
  await expect(adm.getByText(custMsg2)).toBeVisible({ timeout: 15_000 });

  // ---- Real-time admin -> customer ----
  const admInput = adm.getByPlaceholder('Type your reply…');
  await expect(admInput).toBeVisible();
  await admInput.fill(admMsg);
  await admInput.press('Enter');
  await expect(adm.getByText(admMsg)).toBeVisible({ timeout: 10_000 });
  await expect(cust.getByText(admMsg)).toBeVisible({ timeout: 15_000 });

  await custCtx.close();
  await admCtx.close();
});
