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
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';

const timestamp = Date.now();
const customerEmail = `ceo-test-customer-${timestamp}@example.com`;
const customerPassword = 'TresorTest123!';

function gotoHash(page: Page, hash: string) {
  return page.goto(`${BASE_URL}/${hash}`);
}

async function acceptCookies(page: Page) {
  const accept = page.locator('button:has-text("ACCEPT ALL")');
  if (await accept.isVisible().catch(() => false)) await accept.click();
}

async function openFirstProduct(page: Page) {
  await page.goto(`${BASE_URL}/#/shop`);
  await page.waitForSelector('[data-testid="product-card"]', { timeout: 15_000 });
  await page.locator('[data-testid="product-card"]').first().click();
  await page.waitForSelector('#pdp-add-to-bag', { timeout: 15_000 });
}

async function addToBag(page: Page) {
  await openFirstProduct(page);
  await page.locator('#pdp-add-to-bag').click();
  await expect(page.locator('button[aria-label="Bag"]')).toContainText('1', { timeout: 10_000 });
}

async function registerAccount(page: Page) {
  await gotoHash(page, '#/register');
  await page.waitForSelector('input[name="fullName"]', { timeout: 15_000 });
  await page.fill('input[name="fullName"]', 'CEO Test Customer');
  await page.fill('input[name="email"]', customerEmail);
  await page.fill('input[name="password"]', customerPassword);
  await page.fill('input[name="phone"]', '9876543210');
  await page.click('button[type="submit"]');
  await page.waitForURL(/#\/(home|account)/, { timeout: 20_000 });
}

async function login(page: Page, email: string, password: string) {
  await gotoHash(page, '#/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/#\/(home|account|admin)/, { timeout: 20_000 });
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

test.describe('CEO lifecycle — customer journey', () => {
  test('guest can browse, add to bag, register, and place a COD order', async ({ page }) => {
    await page.goto(BASE_URL);
    await acceptCookies(page);

    // Browse storefront
    await expect(page.locator('text=TRESOR COUTURE')).toBeVisible();
    await page.click('text=FABRICS');
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 15_000 });

    // Add to bag
    await addToBag(page);

    // Register
    await registerAccount(page);

    // Go to checkout
    await gotoHash(page, '#/checkout');
    await page.waitForSelector('text=Place Order', { timeout: 15_000 });
    await fillAddress(page);
    await page.click('text=Place Order');

    // Order confirmation
    await page.waitForURL(/#\/confirmation/, { timeout: 30_000 });
    await expect(page.locator('text=Order confirmed')).toBeVisible();
    const orderId = await page.locator('[data-testid="order-id"]').textContent();
    expect(orderId).toBeTruthy();

    // Order appears in account
    await gotoHash(page, '#/account');
    await expect(page.locator(`text=${orderId}`)).toBeVisible();
  });

  test('existing customer can sign in, add to bag, and pay with Razorpay TEST card', async ({ page }) => {
    test.skip(!process.env.RAZORPAY_TEST_MODE, 'Razorpay TEST mode not enabled');

    await page.goto(BASE_URL);
    await acceptCookies(page);

    await login(page, customerEmail, customerPassword);
    await addToBag(page);

    await gotoHash(page, '#/checkout');
    await page.waitForSelector('text=Place Order', { timeout: 15_000 });
    await fillAddress(page);

    // Select Razorpay / card (once the UI is wired)
    await page.click('text=Card / UPI');
    await page.click('text=Place Order');

    // Razorpay checkout iframe
    const razorpayFrame = page.frameLocator('iframe[name^="razorpay"]').first();
    await razorpayFrame.locator('text=Card').click();
    await razorpayFrame.locator('[name="card[number]"]').fill('5267 3181 8797 5449');
    await razorpayFrame.locator('[name="card[expiry]"]').fill('12/30');
    await razorpayFrame.locator('[name="card[cvv]"]').fill('123');
    await razorpayFrame.locator('text=Pay').click();
    await razorpayFrame.locator('[name="otp"]').fill('1234');
    await razorpayFrame.locator('text=Submit').click();

    await page.waitForURL(/#\/confirmation/, { timeout: 30_000 });
    await expect(page.locator('text=Order confirmed')).toBeVisible();
  });
});

test.describe('CEO lifecycle — admin fulfilment', () => {
  test.skip(!ADMIN_PASSWORD, 'TEST_ADMIN_PASSWORD not configured');

  test('admin can log in, view orders, and mark an order as delivered', async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Should land on admin dashboard
    await expect(page.locator('text=Admin')).toBeVisible();

    // Open orders
    await page.click('text=Orders');
    await page.waitForSelector('[data-testid="order-row"]', { timeout: 15_000 });

    // Open the most recent order
    await page.locator('[data-testid="order-row"]').first().click();
    await page.waitForSelector('text=Update Status', { timeout: 15_000 });

    // Move through status lifecycle
    for (const status of ['processing', 'shipped', 'delivered']) {
      await page.selectOption('select[name="status"]', status);
      await page.click('text=Update Status');
      await expect(page.locator(`text=${status}`).first()).toBeVisible();
    }
  });
});

test.describe('CEO lifecycle — returns and refunds', () => {
  test('customer can request a return from order history', async ({ page }) => {
    await login(page, customerEmail, customerPassword);
    await gotoHash(page, '#/account');

    await page.locator('[data-testid="order-row"]').first().click();
    await page.click('text=Request Return');
    await page.fill('textarea[name="reason"]', 'Ordered wrong size');
    await page.click('text=Submit Return');

    await expect(page.locator('text=Return requested')).toBeVisible();
  });
});
