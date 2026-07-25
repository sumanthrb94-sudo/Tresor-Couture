import { test, expect, type Page, type Browser } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Focused visual checks for the UI enhancements that the main walkthrough
 * doesn't naturally land on:
 *   - admin section nav EXPANDED on mobile (was a clipped horizontal strip)
 *   - the customer's unread-reply badge on an order's Chat button
 */
const PASSWORD = 'Test1234!';
const OUT = path.resolve(process.cwd(), 'tests/emulator/screens-ui');
fs.mkdirSync(OUT, { recursive: true });

async function signIn(page: Page, email: string) {
  await page.goto('/#/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 20_000 });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(PASSWORD);
  await page.getByRole('main').getByRole('button', { name: /^login$/i }).click();
  await page.waitForFunction(() => !location.hash.includes('login'), null, { timeout: 25_000 });
  const c = page.getByRole('button', { name: /essential only|accept/i });
  if (await c.first().isVisible().catch(() => false)) await c.first().click().catch(() => {});
}

test('admin section nav expands on mobile', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const adm = await ctx.newPage();
  await signIn(adm, 'admin@test.local');
  await adm.goto('/#/admin/returns', { waitUntil: 'domcontentloaded' });
  await adm.waitForTimeout(1500);

  // Collapsed: the disclosure names the current section.
  const toggle = adm.getByRole('button', { name: /returns/i }).first();
  await expect(toggle).toBeVisible({ timeout: 15_000 });
  await adm.screenshot({ path: path.join(OUT, 'admin-nav-collapsed-mobile.png'), fullPage: false });

  // Expanded: every section is reachable without horizontal scrolling.
  await toggle.click();
  await adm.waitForTimeout(500);
  for (const label of ['Dashboard', 'Orders', 'Returns', 'Support', 'Customers', 'Bulk Email']) {
    await expect(adm.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first()).toBeVisible();
  }
  await adm.screenshot({ path: path.join(OUT, 'admin-nav-expanded-mobile.png'), fullPage: false });
  await ctx.close();
});

test('customer sees an unread badge after the atelier replies', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(180_000);
  const nonce = String(Date.now()).slice(-5);

  // Customer opens the chat and asks something, then leaves the page.
  const custCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const cust = await custCtx.newPage();
  await signIn(cust, 'customer@test.local');
  await cust.goto('/#/account/orders', { waitUntil: 'domcontentloaded' });
  await cust.getByRole('button', { name: /^chat\b/i }).first().click();
  const input = cust.getByPlaceholder('Type a message…');
  await expect(input).toBeVisible({ timeout: 15_000 });
  await input.fill(`Badge check ${nonce}`);
  await input.press('Enter');
  await cust.waitForTimeout(1200);
  // Leave the account page entirely so the chat is closed and unread can accrue.
  await cust.goto('/#/', { waitUntil: 'domcontentloaded' });
  await cust.waitForTimeout(500);

  // Admin replies.
  const admCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const adm = await admCtx.newPage();
  await signIn(adm, 'admin@test.local');
  await adm.goto('/#/admin/support', { waitUntil: 'domcontentloaded' });
  await adm.getByText('Test Customer').first().click({ timeout: 20_000 });
  const admInput = adm.getByPlaceholder('Type your reply…');
  await expect(admInput).toBeVisible({ timeout: 15_000 });
  await admInput.fill(`Replying ${nonce}`);
  await admInput.press('Enter');
  await adm.waitForTimeout(1500);

  // Customer returns to Orders — the Chat button should now carry the badge.
  await cust.goto('/#/account/orders', { waitUntil: 'domcontentloaded' });
  const badged = cust.getByRole('button', { name: /chat — \d+ new repl/i }).first();
  await expect(badged).toBeVisible({ timeout: 20_000 });
  await cust.screenshot({ path: path.join(OUT, 'customer-chat-unread-badge.png'), fullPage: false });

  await custCtx.close();
  await admCtx.close();
});
