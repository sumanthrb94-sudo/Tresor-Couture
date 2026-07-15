import { test as base, chromium, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * Fixture that launches/connects to signed-in Chrome for E2E tests.
 *
 * Two modes:
 *
 * 1. Persistent profiles (default):
 *      CUSTOMER_CHROME_PROFILE  - path to a Chrome user-data-dir signed in as customer
 *      ADMIN_CHROME_PROFILE     - path to a Chrome user-data-dir signed in as admin
 *
 * 2. Attach to a running Chrome via CDP (useful when normal Chrome loads the
 *    signed-in state but Playwright's automation browser does not):
 *      CDP_URL=http://localhost:9222
 *
 * Optional env:
 *   HEADLESS=1               - run headless (default is headed so you can watch/debug)
 *   CHROME_CHANNEL=chrome    - browser channel (default: chrome)
 */

const CUSTOMER_PROFILE = process.env.CUSTOMER_CHROME_PROFILE;
const ADMIN_PROFILE = process.env.ADMIN_CHROME_PROFILE;
const CDP_URL = process.env.CDP_URL;
const HEADLESS = process.env.HEADLESS === '1';
const CHANNEL = process.env.CHROME_CHANNEL || 'chrome';

export type SignedInFixtures = {
  customerContext: BrowserContext;
  adminContext: BrowserContext;
  customerPage: Page;
  adminPage: Page;
};

async function launchPersistentProfile(
  profileDir: string | undefined,
  role: 'customer' | 'admin'
): Promise<BrowserContext> {
  if (!profileDir) {
    base.skip(true, `${role.toUpperCase()}_CHROME_PROFILE env var is not set`);
  }

  const context = await chromium.launchPersistentContext(profileDir!, {
    channel: CHANNEL,
    headless: HEADLESS,
    args: ['--no-first-run', '--no-default-browser-check'],
    ignoreHTTPSErrors: true,
  });

  // Persistent contexts open with one blank starter page; close it so tests start clean.
  for (const page of context.pages()) {
    await page.close();
  }

  return context;
}

/* ───────────── CDP attach mode ───────────── */

let cdpBrowser: Browser | null = null;
let cdpContext: BrowserContext | null = null;

async function getCdpContext(): Promise<BrowserContext> {
  if (!CDP_URL) {
    throw new Error('CDP_URL is not set');
  }
  if (!cdpBrowser) {
    cdpBrowser = await chromium.connectOverCDP(CDP_URL);
  }
  if (!cdpContext) {
    cdpContext = cdpBrowser.contexts()[0] ?? await cdpBrowser.newContext();
  }
  return cdpContext;
}

/* ───────────── shared persistent context (same profile path) ───────────── */

let sharedContext: BrowserContext | null = null;
let sharedRefCount = 0;

async function acquireSharedContext(profileDir: string | undefined): Promise<BrowserContext> {
  if (!sharedContext) {
    sharedContext = await launchPersistentProfile(profileDir, 'customer');
  }
  sharedRefCount++;
  return sharedContext;
}

async function releaseSharedContext() {
  sharedRefCount--;
  if (sharedRefCount <= 0 && sharedContext) {
    await sharedContext.close();
    sharedContext = null;
  }
}

const SAME_PROFILE =
  CUSTOMER_PROFILE && ADMIN_PROFILE &&
  CUSTOMER_PROFILE.toLowerCase() === ADMIN_PROFILE.toLowerCase();

export const signedInTest = base.extend<SignedInFixtures>({
  customerContext: async ({}, use) => {
    if (CDP_URL) {
      const context = await getCdpContext();
      await use(context);
      return;
    }
    if (SAME_PROFILE) {
      const context = await acquireSharedContext(CUSTOMER_PROFILE);
      await use(context);
      await releaseSharedContext();
    } else {
      const context = await launchPersistentProfile(CUSTOMER_PROFILE, 'customer');
      await use(context);
      await context.close();
    }
  },

  adminContext: async ({}, use) => {
    if (CDP_URL) {
      const context = await getCdpContext();
      await use(context);
      return;
    }
    if (SAME_PROFILE) {
      const context = await acquireSharedContext(ADMIN_PROFILE);
      await use(context);
      await releaseSharedContext();
    } else {
      const context = await launchPersistentProfile(ADMIN_PROFILE, 'admin');
      await use(context);
      await context.close();
    }
  },

  customerPage: async ({ customerContext }, use) => {
    const page = await customerContext.newPage();
    await use(page);
    await page.close();
  },

  adminPage: async ({ adminContext }, use) => {
    const page = await adminContext.newPage();
    await use(page);
    await page.close();
  },
});

const BASE_URL = process.env.BASE_URL || 'https://tresorcouture.in';

/* ───────────────────────── helpers ───────────────────────── */

export async function gotoHash(page: Page, hash: string) {
  await page.goto(`${BASE_URL}/${hash}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
}

export async function acceptCookies(page: Page) {
  const accept = page.locator('button:has-text("ACCEPT ALL")');
  if (await accept.isVisible().catch(() => false)) await accept.click();
}

/** Verifies the customer profile is signed in by loading the account page. */
export async function expectCustomerSignedIn(page: Page) {
  await gotoHash(page, '#/account');
  await acceptCookies(page);

  const accountMenu = page.locator('button[aria-label="Account menu"]').first();

  await expect(accountMenu).toBeVisible({ timeout: 20_000 });

  const url = page.url();
  if (url.includes('#/login')) {
    throw new Error(
      'Customer profile is not signed in. Sign in on the customer Chrome profile, close Chrome, and rerun.'
    );
  }
}

/** Verifies the admin profile is signed in and has the admin claim. */
export async function expectAdminSignedIn(page: Page) {
  await gotoHash(page, '#/admin/dashboard');
  await acceptCookies(page);

  // AdminGuard redirects non-admins to /login or /home.
  await page.waitForTimeout(1_000); // let the guard decide
  const url = page.url();
  if (url.includes('#/login')) {
    throw new Error(
      'Admin profile is not signed in. Sign in on the admin Chrome profile, close Chrome, and rerun.'
    );
  }
  if (url.includes('#/home') || url.endsWith('/#/')) {
    throw new Error(
      'Admin profile is signed in but does not have the admin claim. Grant admin via scripts/set-admin.ts, then sign in again.'
    );
  }

  // The admin console should render.
  await expect(page.locator('aside').getByText('Admin').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('aside').getByRole('button', { name: 'Dashboard' }).first()).toBeVisible({ timeout: 15_000 });
}

export async function openFirstProduct(page: Page) {
  await gotoHash(page, '#/shop');
  const card = page.locator('.card-product').first();
  await expect(card).toBeVisible({ timeout: 25_000 });
  // First button in card navigates to PDP (wishlist heart is a separate button).
  await card.getByRole('button').first().click();
  await expect(page.locator('#pdp-add-to-bag')).toBeVisible({ timeout: 30_000 });
}

export async function addToBag(page: Page) {
  await openFirstProduct(page);
  // Force click avoids flaky "element not stable / detached" errors while the
  // PDP finishes hydration/re-rendering.
  await page.locator('#pdp-add-to-bag').click({ force: true });
  await expect(page.locator('button[aria-label^="Cart with"]').first()).toContainText('1', { timeout: 15_000 });
  // Cart writes to Firestore are debounced; give them time to sync before reloads.
  await page.waitForTimeout(1_500);
}

/** Removes every item from the signed-in user's bag so the lifecycle starts clean. */
export async function clearBag(page: Page) {
  await gotoHash(page, '#/cart');
  await page.waitForLoadState('networkidle').catch(() => {});

  // Unavailable/seeded items expose a bulk "Clear bag" button.
  const clearBagBtn = page.getByRole('button', { name: 'Clear bag' });
  if (await clearBagBtn.isVisible().catch(() => false)) {
    await clearBagBtn.click();
    await expect(page.getByText(/Your bag is empty/i)).toBeVisible({ timeout: 15_000 });
    return;
  }

  // Otherwise click each line's Remove button until the badge clears.
  for (let i = 0; i < 20; i++) {
    const remove = page.getByRole('button', { name: 'Remove' }).first();
    if (!(await remove.isVisible().catch(() => false))) break;
    await remove.click();
    await page.waitForTimeout(400);
  }

  const cartBtn = page.locator('button[aria-label="Cart"], button[aria-label^="Cart with"]').first();
  await expect(cartBtn).not.toContainText(/[1-9]/, { timeout: 10_000 });
}

export async function fillCheckoutAddress(page: Page, address: {
  fullName: string;
  email: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
}) {
  await page.fill('input[name="fullName"]', address.fullName);
  await page.fill('input[name="email"]', address.email);
  await page.fill('input[name="phone"]', address.phone);
  await page.fill('input[name="line1"]', address.line1);
  await page.fill('input[name="city"]', address.city);
  await page.fill('input[name="state"]', address.state);
  await page.fill('input[name="postalCode"]', address.postalCode);
}
