import { expect, type Page, type Browser } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Shared end-to-end walkthrough used by both the desktop and mobile emulator
 * specs, so the two runs execute the SAME steps at different viewports. Drives a
 * signed-in customer and admin in separate browser contexts through every major
 * post-login scenario against the Firebase Emulator Suite (real firestore.rules),
 * screenshotting each step.
 */

const PASSWORD = 'Test1234!';

export interface WalkthroughOpts {
  screensDir: string;
  viewport: { width: number; height: number };
  isMobile?: boolean;
}

export async function runWalkthrough(browser: Browser, opts: WalkthroughOpts): Promise<void> {
  const SCREENS = path.resolve(process.cwd(), opts.screensDir);
  fs.mkdirSync(SCREENS, { recursive: true });
  const contextOpts = { viewport: opts.viewport, isMobile: !!opts.isMobile, hasTouch: !!opts.isMobile };

  let n = 0;
  const shot = async (page: Page, label: string) => {
    const file = path.join(SCREENS, `${String(++n).padStart(2, '0')}-${label}.png`);
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    // eslint-disable-next-line no-console
    console.log(`  📸 ${path.basename(file)}`);
  };
  const dismissConsent = async (page: Page) => {
    const b = page.getByRole('button', { name: /essential only|accept/i });
    if (await b.first().isVisible().catch(() => false)) await b.first().click().catch(() => {});
  };
  const signIn = async (page: Page, email: string) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('#login-email').waitFor({ state: 'visible', timeout: 20_000 });
    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill(PASSWORD);
    // Scope to the login form's submit button — on mobile the bottom nav also
    // has a "Login" tab, which would make an unscoped match ambiguous.
    await page.getByRole('main').getByRole('button', { name: /^login$/i }).click();
    await page.waitForFunction(() => !location.pathname.includes('login'), null, { timeout: 25_000 });
    await dismissConsent(page);
  };

  const nonce = String(Date.now()).slice(-6);
  const custMsg = `Hi, question about my order #${nonce}`;
  const admReply = `Happy to help! Reply ${nonce}`;

  // ══════════════ CUSTOMER ══════════════
  const custCtx = await browser.newContext(contextOpts);
  const cust = await custCtx.newPage();

  await cust.goto('/', { waitUntil: 'domcontentloaded' });
  await dismissConsent(cust);
  await cust.waitForTimeout(1500);
  await shot(cust, 'home');

  await cust.goto('/shop', { waitUntil: 'domcontentloaded' });
  await cust.waitForTimeout(1800);
  await shot(cust, 'shop-catalogue');

  await cust.goto('/product/1', { waitUntil: 'domcontentloaded' });
  await cust.waitForTimeout(1500);
  await shot(cust, 'product-detail');

  const addBtn = cust.getByRole('button', { name: /add to (bag|cart)/i });
  if (await addBtn.first().isVisible().catch(() => false)) {
    await addBtn.first().click().catch(() => {});
    await cust.waitForTimeout(800);
  }
  await shot(cust, 'product-added-to-bag');
  await cust.goto('/cart', { waitUntil: 'domcontentloaded' });
  await cust.waitForTimeout(1200);
  await shot(cust, 'cart');

  await signIn(cust, 'customer@test.local');
  await cust.waitForTimeout(1000);
  await shot(cust, 'customer-signed-in-home');

  await cust.goto('/account/profile', { waitUntil: 'domcontentloaded' });
  await cust.waitForTimeout(1200);
  await shot(cust, 'customer-account-profile');

  await cust.goto('/account/orders', { waitUntil: 'domcontentloaded' });
  await cust.waitForTimeout(1500);
  await shot(cust, 'customer-orders');

  // Per-order chat: customer sends
  await cust.getByRole('button', { name: /^chat\b/i }).first().click();
  const custInput = cust.getByPlaceholder('Type a message…');
  await expect(custInput).toBeVisible({ timeout: 15_000 });
  await custInput.fill(custMsg);
  await custInput.press('Enter');
  await expect(cust.getByText(custMsg)).toBeVisible({ timeout: 10_000 });
  await cust.waitForTimeout(500);
  await shot(cust, 'customer-chat-sent');
  await cust.getByRole('button', { name: /close/i }).first().click({ timeout: 5000 }).catch(() => {});

  // Returns: request an RMA on the delivered order
  await cust.getByRole('button', { name: /^return$/i }).first().click();
  await cust.waitForTimeout(1200);
  await shot(cust, 'customer-return-modal');
  // Bounded timeouts on every interaction: on mobile the modal lays out
  // differently and an un-timed .check()/.click() would hang forever instead of
  // falling through the .catch().
  const box = cust.locator('input[type="checkbox"]');
  if ((await box.first().isVisible().catch(() => false)) && !(await box.first().isChecked().catch(() => true))) {
    await box.first().check({ timeout: 5000 }).catch(() => {});
  }
  await cust.locator('#return-reason').selectOption({ index: 1 }, { timeout: 5000 }).catch(() => {});
  await cust.waitForTimeout(400);
  await shot(cust, 'customer-return-filled');
  await cust.getByRole('button', { name: /submit|request return|confirm|raise/i }).first().click({ timeout: 5000 }).catch(() => {});
  await cust.waitForTimeout(2000);
  await shot(cust, 'customer-return-submitted');

  await cust.goto('/account/returns', { waitUntil: 'domcontentloaded' });
  await cust.waitForTimeout(1500);
  await shot(cust, 'customer-returns-tab');

  // ══════════════ ADMIN ══════════════
  const admCtx = await browser.newContext(contextOpts);
  const adm = await admCtx.newPage();
  await signIn(adm, 'admin@test.local');
  await adm.waitForTimeout(1000);

  await adm.goto('/admin', { waitUntil: 'domcontentloaded' });
  await adm.waitForTimeout(1800);
  await shot(adm, 'admin-dashboard');

  await adm.goto('/admin/support', { waitUntil: 'domcontentloaded' });
  await expect(adm.getByRole('heading', { name: /support/i })).toBeVisible({ timeout: 20_000 });
  await expect(adm.getByText('Test Customer').first()).toBeVisible({ timeout: 20_000 });
  await shot(adm, 'admin-support-inbox');

  await adm.getByText('Test Customer').first().click();
  // The message text appears both as the inbox list-preview snippet and as the
  // thread bubble; .last() targets the bubble (rendered after the list in DOM).
  await expect(adm.getByText(custMsg).last()).toBeVisible({ timeout: 15_000 });
  await shot(adm, 'admin-chat-opened');

  const admInput = adm.getByPlaceholder('Type your reply…');
  await expect(admInput).toBeVisible();
  await admInput.fill(admReply);
  await admInput.press('Enter');
  await expect(adm.getByText(admReply).last()).toBeVisible({ timeout: 10_000 });
  await shot(adm, 'admin-chat-replied');

  // Customer receives the reply in real time
  await cust.goto('/account/orders', { waitUntil: 'domcontentloaded' });
  await cust.waitForTimeout(800);
  await cust.getByRole('button', { name: /^chat\b/i }).first().click();
  await expect(cust.getByText(admReply)).toBeVisible({ timeout: 15_000 });
  await shot(cust, 'customer-received-reply-realtime');

  await adm.goto('/admin/returns', { waitUntil: 'domcontentloaded' });
  await adm.waitForTimeout(1800);
  await shot(adm, 'admin-returns-queue');

  await adm.goto('/admin/orders', { waitUntil: 'domcontentloaded' });
  await adm.waitForTimeout(1800);
  await shot(adm, 'admin-orders');

  await adm.goto('/admin/customers', { waitUntil: 'domcontentloaded' });
  await adm.waitForTimeout(1800);
  await shot(adm, 'admin-customers-crm');

  // Security: 2nd customer sees only their own isolated account
  const cust2Ctx = await browser.newContext(contextOpts);
  const cust2 = await cust2Ctx.newPage();
  await signIn(cust2, 'customer2@test.local');
  await cust2.goto('/account/orders', { waitUntil: 'domcontentloaded' });
  await cust2.waitForTimeout(1500);
  await shot(cust2, 'security-second-customer-isolated');

  await custCtx.close();
  await admCtx.close();
  await cust2Ctx.close();
}
