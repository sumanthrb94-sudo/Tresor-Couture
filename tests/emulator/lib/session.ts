import type { Browser, Page } from '@playwright/test';

/** Shared sign-in helpers for the emulator suites. */

export const PASSWORD = 'Test1234!';
export const ADMIN = 'admin@test.local';
export const CUSTOMER = 'customer@test.local';
export const CUSTOMER2 = 'customer2@test.local';

export const DESKTOP = { width: 1280, height: 900 };
export const MOBILE = { width: 390, height: 844 };

export async function dismissConsent(page: Page): Promise<void> {
  const b = page.getByRole('button', { name: /essential only|accept/i });
  if (await b.first().isVisible().catch(() => false)) await b.first().click().catch(() => {});
}

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 20_000 });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(PASSWORD);
  // Scoped to the form: the mobile bottom nav also exposes a "Login" control.
  await page.getByRole('main').getByRole('button', { name: /^login$/i }).click();
  await page.waitForFunction(() => !location.pathname.includes('login'), null, { timeout: 25_000 });
  await dismissConsent(page);
}

/** Open a signed-in admin page in its own context. */
export async function adminPage(browser: Browser, viewport = DESKTOP): Promise<Page> {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await signIn(page, ADMIN);
  return page;
}

/** Open a signed-in customer page in its own context. */
export async function customerPage(browser: Browser, email = CUSTOMER, viewport = DESKTOP): Promise<Page> {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await signIn(page, email);
  return page;
}

/** Navigate to an admin section and wait for it to settle. */
export async function gotoAdmin(page: Page, section: string): Promise<void> {
  await page.goto(`/#/admin/${section}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1600);
}
