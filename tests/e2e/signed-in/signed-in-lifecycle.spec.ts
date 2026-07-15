import { expect } from '@playwright/test';
import {
  signedInTest,
  gotoHash,
  acceptCookies,
  expectCustomerSignedIn,
  expectAdminSignedIn,
  addToBag,
  fillCheckoutAddress,
  clearBag,
} from '../fixtures/signedInProfiles';
import { egressBlocked } from '../_helpers';

/**
 * Full customer → admin lifecycle using two signed-in Chrome profiles.
 *
 * 1. Customer adds a product and places a COD order.
 * 2. Admin finds the order and advances it through processing → shipped → delivered.
 * 3. Customer verifies the order shows as delivered in account history.
 *
 * This spec is serial because it mutates order state.
 */

const TEST_ADDRESS = {
  fullName: 'E2E Signed-In Customer',
  email: 'e2e-signed-in@example.com',
  phone: '9876543210',
  line1: '12 Banjara Hills',
  city: 'Hyderabad',
  state: 'Telangana',
  postalCode: '500034',
};

function shortOrderId(orderId: string) {
  return `TC-${orderId.slice(-8).toUpperCase()}`;
}

signedInTest.describe.configure({ mode: 'serial' });

signedInTest.describe('signed-in lifecycle', () => {
  signedInTest.beforeEach(async ({ request, baseURL }) => {
    signedInTest.skip(await egressBlocked(request, baseURL), 'Egress proxy blocks this host.');
  });

  signedInTest('customer places a COD order and admin fulfils it', async ({ customerPage, adminPage }) => {
    signedInTest.setTimeout(180_000);

    // ── Verify both profiles are ready ──
    await expectCustomerSignedIn(customerPage);
    await expectAdminSignedIn(adminPage);

    // ── Customer: start with an empty bag ──
    await clearBag(customerPage);

    // ── Customer: add to bag ──
    await addToBag(customerPage);

    // ── Customer: checkout ──
    await gotoHash(customerPage, '#/checkout');
    await expect(customerPage.getByRole('heading', { name: 'Checkout' })).toBeVisible({ timeout: 20_000 });

    // If checkout boots on the login intro, click Continue to reach the address form.
    const introContinue = customerPage.getByRole('button', { name: /^Continue$/ });
    if (await introContinue.isVisible().catch(() => false)) {
      await introContinue.click();
    }

    // If a saved address is shown, choose to enter a different one so we can fill the test address.
    const useDifferent = customerPage.getByRole('button', { name: /Use a different address/i });
    if (await useDifferent.isVisible().catch(() => false)) {
      await useDifferent.click();
    }

    const mobileInput = customerPage.getByPlaceholder(/10-digit mobile/i);
    await expect(mobileInput).toBeVisible({ timeout: 15_000 });
    await fillCheckoutAddress(customerPage, TEST_ADDRESS);

    await customerPage.getByRole('button', { name: 'Save & Continue' }).click();
    await expect(customerPage.getByText(/Cash on Delivery/i)).toBeVisible({ timeout: 15_000 });

    await customerPage.getByRole('button', { name: /Place Order/ }).click();

    // ── Customer: confirmation ──
    await customerPage.waitForURL(/#\/confirmation\//, { timeout: 60_000 });
    await expect(customerPage.locator('text=Order confirmed')).toBeVisible({ timeout: 15_000 });

    const confirmationUrl = customerPage.url();
    const orderIdMatch = confirmationUrl.match(/#\/confirmation\/([^/?#]+)/);
    const orderId = orderIdMatch?.[1];
    expect(orderId, 'could not extract order id from confirmation URL').toBeTruthy();

    console.log(`[lifecycle] placed order ${shortOrderId(orderId!)} (${orderId})`);

    // ── Admin: open orders and find the new order ──
    await gotoHash(adminPage, '#/admin/orders');
    await expect(adminPage.getByRole('heading', { name: 'Orders' }).first()).toBeVisible({ timeout: 20_000 });

    // Search by full Firestore order id to isolate the row.
    const searchInput = adminPage.getByLabel(/Search orders/i);
    await searchInput.fill(orderId!);
    await adminPage.waitForTimeout(500);

    // Wait for the single matching row to appear.
    const row = adminPage.locator('tbody tr').first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText(orderId!, { timeout: 10_000 });

    // ── Admin: advance status lifecycle ──
    const statusSelect = row.locator('select[aria-label="Update order status"]');
    for (const status of ['processing', 'shipped', 'delivered']) {
      await statusSelect.selectOption(status);
      await adminPage.waitForTimeout(750);
      await expect(statusSelect).toHaveValue(status, { timeout: 15_000 });
      console.log(`[lifecycle] admin updated order to ${status}`);
    }

    // ── Customer: verify delivered status in account ──
    await gotoHash(customerPage, '#/account/orders');
    const orderRow = customerPage.locator('[data-testid="order-row"]')
      .filter({ hasText: shortOrderId(orderId!) })
      .first();
    await expect(orderRow).toBeVisible({ timeout: 20_000 });
    await expect(orderRow).toContainText(/delivered/i, { timeout: 15_000 });

    console.log(`[lifecycle] ✅ customer sees order ${shortOrderId(orderId!)} as delivered`);
  });
});
