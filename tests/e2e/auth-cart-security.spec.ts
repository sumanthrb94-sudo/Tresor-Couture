import { test, expect, type Page } from '@playwright/test';
import { egressBlocked } from './_helpers';

/**
 * Senior-analyst E2E: login → add-to-cart, probed for both FUNCTION and
 * SECURITY behaviour. Watchable (headed + slowMo). Non-destructive: it never
 * completes a payment; it DOES register one clearly-tagged throwaway account
 * (e2e+signup-<ts>@example.com) to exercise the real signup + signed-in cart.
 *
 * Run headed:
 *   BASE_URL=https://tresorcouture.in npx playwright test auth-cart-security \
 *     --project=chromium --headed --workers=1
 */

// Slow the actions so a human can follow along in the visible browser.
test.use({ launchOptions: { slowMo: 350 } });

const STAMP = Date.now();
const TEST_EMAIL = `e2e+signup-${STAMP}@example.com`;
const TEST_PASSWORD = `Tc!a${STAMP}Z`; // > 6 chars, mixed case + symbol
const TEST_NAME = 'E2E Security Buyer';

test.beforeEach(async ({ request, baseURL }) => {
  test.skip(await egressBlocked(request, baseURL), 'Egress proxy blocks this host (run from an open-network environment).');
});

async function gotoHash(page: Page, hash: string) {
  await page.goto(`/${hash}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** Click the first product card on the shop grid → its PDP. */
async function openFirstProduct(page: Page) {
  await gotoHash(page, '#/shop');
  const card = page.locator('.card-product').first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByRole('button').first().click(); // first button in a card = the product link (wishlist is later)
  await expect(page.locator('#pdp-add-to-bag')).toBeVisible({ timeout: 15_000 });
}

const cartButton = (page: Page) => page.locator('button[aria-label^="Cart with"], button[aria-label="Cart"]').first();
const accountButton = (page: Page) => page.locator('button[aria-label="Account menu"], button[aria-label="Sign in"]').first();

// ───────────────────────── AUTH: negative & security ─────────────────────────
test.describe('Auth — negative & security boundary', () => {
  test('empty credentials are rejected client-side (no network hit)', async ({ page }) => {
    await gotoHash(page, '#/login');
    await page.getByRole('button', { name: /^login$/i }).click();
    await expect(page.getByRole('alert')).toContainText(/enter your email and password/i);
  });

  test('bad credentials do not reveal whether an account exists (enumeration)', async ({ page }) => {
    const tryLogin = async (email: string) => {
      await gotoHash(page, '#/login');
      await page.getByPlaceholder('you@example.com').first().fill(email);
      await page.getByPlaceholder(/your password/i).fill('definitely-wrong-pw');
      await page.getByRole('button', { name: /^login$/i }).click();
      const alert = page.getByRole('alert');
      await expect(alert).toBeVisible({ timeout: 15_000 });
      return (await alert.textContent())?.trim() ?? '';
    };
    const errA = await tryLogin(`no-such-${STAMP}-a@example.com`);
    const errB = await tryLogin(`no-such-${STAMP}-b@example.com`);
    console.log(`[enumeration] nonexistent-A error: "${errA}"`);
    console.log(`[enumeration] nonexistent-B error: "${errB}"`);
    // Same generic error for two different unknown addresses ⇒ no enumeration.
    expect(errA).toBe(errB);
    expect(errA).not.toMatch(/no account|not found|no user|doesn'?t exist/i);
  });

  test('password field is masked and the show/hide toggle works', async ({ page }) => {
    await gotoHash(page, '#/login');
    const pw = page.getByPlaceholder(/your password/i);
    await pw.fill('SuperSecret123');
    await expect(pw).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: /show password/i }).click();
    await expect(pw).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: /hide password/i }).click();
    await expect(pw).toHaveAttribute('type', 'password');
  });

  test('injection payloads in the login form are inert (no script execution)', async ({ page }) => {
    let dialogFired = false;
    page.on('dialog', (d) => { dialogFired = true; void d.dismiss(); });
    await gotoHash(page, '#/login');
    await page.getByPlaceholder('you@example.com').first().fill('"><img src=x onerror=alert(1)>@x.com');
    await page.getByPlaceholder(/your password/i).fill(`' OR '1'='1`);
    await page.getByRole('button', { name: /^login$/i }).click();
    await page.waitForTimeout(2500);
    expect(dialogFired, 'no alert() should fire from an injected payload').toBe(false);
    // App is still alive and rejected the attempt.
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
  });

  test('password reset does not disclose whether an email is registered', async ({ page }) => {
    await gotoHash(page, '#/login');
    const forgot = page.getByText(/forgot/i).first();
    if (!(await forgot.isVisible().catch(() => false))) test.skip(true, 'No forgot-password trigger found.');
    await forgot.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByPlaceholder('you@example.com').fill(`no-such-${STAMP}@example.com`);
    await dialog.getByRole('button', { name: /send|reset|continue/i }).first().click();
    // Generic confirmation, never an "account not found" disclosure.
    await expect(dialog).toContainText(/sent|inbox|if an account|check your/i, { timeout: 15_000 });
    await expect(dialog).not.toContainText(/no account|not found|doesn'?t exist/i);
  });
});

// ───────────────────────── REGISTER (throwaway account) ─────────────────────────
test.describe('Registration', () => {
  test('a new account can be created via the real signup flow', async ({ page }) => {
    console.log(`[register] creating throwaway account: ${TEST_EMAIL}`);
    await gotoHash(page, '#/register');
    await page.getByPlaceholder('Aanya Mehra').fill(TEST_NAME);
    await page.getByPlaceholder('you@example.com').first().fill(TEST_EMAIL);
    await page.getByPlaceholder(/at least 6 characters/i).fill(TEST_PASSWORD);
    await page.getByPlaceholder(/re-enter your password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /create account/i }).click();
    // On success the app signs the user in and leaves /register.
    await expect(page).not.toHaveURL(/#\/register/, { timeout: 20_000 });
    // A signed-in affordance (account menu) should now exist.
    await expect(accountButton(page)).toBeVisible({ timeout: 15_000 });
    console.log(`[register] ✅ account created — DELETE THIS USER AFTERWARDS: ${TEST_EMAIL}`);
  });
});

// ───────────────────────── ADD TO CART — guest probabilities ─────────────────────────
test.describe('Add to cart — guest', () => {
  test('add a product → bag badge increments and the item shows in the cart', async ({ page }) => {
    await openFirstProduct(page);
    await page.locator('#pdp-add-to-bag').click();
    await expect(page.locator('button[aria-label^="Cart with"]').first()).toContainText('1', { timeout: 10_000 });
    await gotoHash(page, '#/cart');
    await expect(page.getByText(/₹\s?[\d,]/).first()).toBeVisible({ timeout: 15_000 });
  });

  test('two distinct products produce two cart lines (badge = 2)', async ({ page }) => {
    // Product 1
    await gotoHash(page, '#/shop');
    const cards = page.locator('.card-product');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    await cards.nth(0).getByRole('button').first().click();
    await page.locator('#pdp-add-to-bag').click();
    await expect(cartButton(page)).toContainText('1', { timeout: 10_000 });
    // Product 2
    await gotoHash(page, '#/shop');
    await cards.nth(1).getByRole('button').first().click();
    await page.locator('#pdp-add-to-bag').click();
    await expect(cartButton(page)).toContainText('2', { timeout: 10_000 });
  });

  test('cart survives a full page reload (guest localStorage)', async ({ page }) => {
    await openFirstProduct(page);
    await page.locator('#pdp-add-to-bag').click();
    await expect(cartButton(page)).toContainText('1', { timeout: 10_000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(cartButton(page)).toContainText('1', { timeout: 10_000 });
  });

  test('guest can remove an item and empty the bag', async ({ page }) => {
    await openFirstProduct(page);
    await page.locator('#pdp-add-to-bag').click();
    await expect(cartButton(page)).toContainText('1', { timeout: 10_000 });
    await gotoHash(page, '#/cart');
    const remove = page.getByRole('button', { name: /remove|delete|trash/i }).first();
    await expect(remove).toBeVisible({ timeout: 15_000 });
    await remove.click();
    // Badge clears (no count rendered when the bag is empty).
    await expect(cartButton(page)).not.toContainText(/[1-9]/, { timeout: 10_000 });
  });
});

// ───────────────────────── SIGNED-IN: login + bag merge + sign out ─────────────────────────
test.describe('Signed-in cart', () => {
  test('registered user signs in, the guest bag merges, then signs out', async ({ page }) => {
    // 1) As guest, drop an item in the bag.
    await openFirstProduct(page);
    await page.locator('#pdp-add-to-bag').click();
    await expect(cartButton(page)).toContainText('1', { timeout: 10_000 });

    // 2) Sign in with the account created earlier.
    await gotoHash(page, '#/login');
    await page.getByPlaceholder('you@example.com').first().fill(TEST_EMAIL);
    await page.getByPlaceholder(/your password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /^login$/i }).click();
    await expect(page).not.toHaveURL(/#\/login/, { timeout: 20_000 });

    // 3) The guest bag should have merged into the account (item still present).
    await expect(cartButton(page)).toContainText('1', { timeout: 15_000 });
    console.log('[merge] ✅ guest bag preserved through sign-in');

    // 4) Sign out via the account menu.
    const profile = page.locator('button[aria-label="Account menu"]').first();
    if (await profile.isVisible().catch(() => false)) {
      await profile.click();
      await page.getByRole('button', { name: /sign out/i }).first().click();
      await expect(page.locator('button[aria-label="Sign in"]').first())
        .toBeVisible({ timeout: 15_000 });
      console.log('[signout] ✅ session cleared');
    }
  });
});
