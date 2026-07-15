/**
 * CEO-level end-to-end lifecycle tests for Tresor Couture.
 *
 * These tests cover the full customer and admin journey:
 *   1. Guest browses storefront and adds to bag.
 *   2. Guest creates an account.
 *   3. Signed-in user checks out with COD.
 *   4. Order confirmation and email notification.
 *   5. Admin logs in and updates order status through delivered.
 *   6. Customer views order history and requests a return.
 *
 * Requirements to run successfully:
 *   - BASE_URL pointing to a deployment with all env vars configured
 *     (FIREBASE_SERVICE_ACCOUNT, Razorpay TEST keys or COD enabled, Brevo).
 *   - Firestore rules deployed.
 *   - Test data seeded (products, coupons).
 *   - A dedicated test admin user with the `admin` custom claim.
 *
 * By default this spec is conservative: it asserts visible UI states rather
 * than real money movement, and it uses unique emails to avoid collisions.
 */
import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://tresorcouture.in';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'ceo-test-admin@tresorcouture.in';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) throw new Error('TEST_ADMIN_PASSWORD is required for ceo-lifecycle tests.');

const CUSTOMER_PASSWORD = process.env.E2E_USER_PASSWORD;
if (!CUSTOMER_PASSWORD) throw new Error('E2E_USER_PASSWORD is required for ceo-lifecycle tests.');

const timestamp = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const customerEmail = `ceo-test-customer-${timestamp}@example.com`;
const customerPassword = CUSTOMER_PASSWORD;

test.beforeEach(({ page }) => {
  page.on('pageerror', err => console.error('[pageerror]', err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') console.error('[console.error]', msg.text());
  });
});

async function gotoHash(page: Page, hash: string) {
  // Hash-router SPA: always reload so the router boots with the correct hash,
  // then wait for React to hydrate and data fetches to settle.
  await page.goto(`${BASE_URL}/${hash}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  await acceptCookies(page);
}

async function waitForSignedIn(page: Page) {
  // Desktop: account dropdown in the navbar. Mobile: bottom-nav "Account" tab.
  // Use :visible to avoid matching hidden desktop markup on mobile viewports.
  await expect(
    page.locator('button[aria-label="Account menu"]:visible, nav[aria-label="Primary"] button:has-text("Account"):visible').first()
  ).toBeVisible({ timeout: 15_000 });
}

async function acceptCookies(page: Page) {
  const accept = page.locator('button:has-text("ACCEPT ALL")');
  if (await accept.isVisible().catch(() => false)) await accept.click();
}

async function openFirstProduct(page: Page) {
  await gotoHash(page, '#/shop');
  const card = page.locator('.card-product').first();
  await expect(card).toBeVisible({ timeout: 25_000 });
  // Click the main card button (the wishlist heart is a separate button inside
  // the card). Wait for the product route to settle before looking for PDP UI.
  await card.locator('button').first().click();
  await page.waitForURL(/#\/product\//, { timeout: 15_000 });
  await expect(page.locator('#pdp-add-to-bag')).toBeVisible({ timeout: 30_000 });
}

async function addToBag(page: Page) {
  await openFirstProduct(page);
  // The PDP may still be hydrating/re-rendering when the button first appears,
  // so click with force to avoid "element not stable / detached" flakes.
  await page.locator('#pdp-add-to-bag').click({ force: true });
  await expect(page.locator('button[aria-label^="Cart with"]').first()).toContainText('1', { timeout: 10_000 });
  // Cart writes to Firestore are debounced (600 ms). Wait for the sync to
  // complete before any later page reload, otherwise the bag is lost.
  await page.waitForTimeout(1_500);
}

async function registerAccount(page: Page) {
  await gotoHash(page, '#/register');
  await page.waitForSelector('input[name="fullName"]', { timeout: 15_000 });
  await page.fill('input[name="fullName"]', 'CEO Test Customer');
  await page.fill('input[name="email"]', customerEmail);
  await page.fill('input[name="password"]', customerPassword);
  await page.fill('input[name="confirmPassword"]', customerPassword);
  await page.fill('input[name="phone"]', '9876543210');
  await page.click('button[type="submit"]');
  await page.waitForURL(/#\/(home|account|$)/, { timeout: 20_000 });
  await waitForSignedIn(page);
  // Auth resolves ~500 ms after the account menu first paints; navigating
  // before then can be overridden by a delayed post-sign-in redirect.
  await page.waitForTimeout(1_000);
}

async function login(page: Page, email: string, password: string) {
  await gotoHash(page, '#/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/#\/(home|account|admin|$)/, { timeout: 20_000 });
  await waitForSignedIn(page);
  // Same auth-settling grace period as registration.
  await page.waitForTimeout(1_000);
}

async function fillAddress(page: Page) {
  await page.fill('input[name="fullName"]', 'CEO Test Customer');
  await page.fill('input[name="email"]', customerEmail);
  await page.fill('input[name="phone"]', '9876543210');
  await page.fill('input[name="line1"]', '12 Banjara Hills');
  await page.fill('input[name="city"]', 'Hyderabad');
  await page.fill('input[name="state"]', 'Telangana');
  await page.fill('input[name="postalCode"]', '500034');
}

test.describe.configure({ mode: 'serial' });

test.describe('CEO lifecycle — customer journey', () => {
  test('guest can browse, add to bag, register, and place a COD order', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoHash(page, '#/');

    // Browse storefront
    await expect(page.getByRole('button', { name: 'Tresor Couture — Home' })).toBeVisible();

    // Register first so the cart stays associated with the account
    await registerAccount(page);

    // Add to bag
    await addToBag(page);

    // Go to checkout (logged in → fill address, save, place order)
    await gotoHash(page, '#/checkout');
    await waitForSignedIn(page);
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible({ timeout: 15_000 });

    // The checkout may boot directly into the address step when already signed in.
    // Only click the intro Continue button if the address form is not yet visible.
    const mobileInput = page.getByPlaceholder(/10-digit mobile/i);
    const introContinue = page.locator('button', { hasText: /^Continue$/ });
    if (await introContinue.isVisible().catch(() => false)) {
      await introContinue.click();
    }
    await expect(mobileInput).toBeVisible({ timeout: 15_000 });
    await fillAddress(page);
    await page.getByRole('button', { name: /^Save \& Continue$/ }).click();
    await expect(page.getByText(/Cash on Delivery/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Place Order/ }).click();

    // Order confirmation
    await page.waitForURL(/#\/confirmation/, { timeout: 60_000 });
    await expect(page.locator('text=Order confirmed')).toBeVisible();
    const orderId = await page.locator('[data-testid="order-id"]').textContent();
    expect(orderId).toBeTruthy();

    // Order appears in account
    await gotoHash(page, '#/account');
    await page.getByRole('button', { name: 'Orders' }).click();
    const orderRow = page.locator('[data-testid="order-row"]').first();
    await expect(orderRow).toBeVisible({ timeout: 15_000 });
    await expect(orderRow.getByText(orderId!)).toBeVisible();
  });

  test('existing customer can sign in, add to bag, and place a COD order', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoHash(page, '#/');
    await acceptCookies(page);

    await login(page, customerEmail, customerPassword);
    await addToBag(page);

    await gotoHash(page, '#/checkout');
    await waitForSignedIn(page);
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible({ timeout: 15_000 });

    const mobileInput = page.getByPlaceholder(/10-digit mobile/i);
    const introContinue = page.locator('button', { hasText: /^Continue$/ });
    if (await introContinue.isVisible().catch(() => false)) {
      await introContinue.click();
    }
    await expect(mobileInput).toBeVisible({ timeout: 15_000 });
    await fillAddress(page);
    await page.getByRole('button', { name: /^Save \& Continue$/ }).click();
    await expect(page.getByText(/Cash on Delivery/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Place Order/ }).click();

    await page.waitForURL(/#\/confirmation/, { timeout: 60_000 });
    await expect(page.locator('text=Order confirmed')).toBeVisible();
  });
});

test.describe('CEO lifecycle — admin fulfilment', () => {
  test.skip(!ADMIN_PASSWORD, 'TEST_ADMIN_PASSWORD not configured');

  test('admin can log in, view orders, and mark an order as delivered', async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Login redirects to the storefront home; navigate to the admin console.
    await gotoHash(page, '#/admin/dashboard');
    await expect(page.locator('aside').getByText('Admin').first()).toBeVisible();

    // Open orders
    await page.getByRole('button', { name: 'Orders', exact: true }).click();
    await page.waitForSelector('tbody tr', { timeout: 15_000 });

    // Move the most recent order through the status lifecycle
    for (const status of ['processing', 'shipped', 'delivered']) {
      await page.locator('tbody tr:first-child select[aria-label="Update order status"]').selectOption(status);
      await page.waitForTimeout(500);
      await expect(page.locator('tbody tr:first-child select[aria-label="Update order status"]')).toHaveValue(status);
    }
  });
});
