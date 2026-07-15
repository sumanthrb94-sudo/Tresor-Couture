import { expect } from '@playwright/test';
import {
  signedInTest,
  gotoHash,
  acceptCookies,
  expectCustomerSignedIn,
  expectAdminSignedIn,
} from '../fixtures/signedInProfiles';
import { egressBlocked } from '../_helpers';

/**
 * Signed-in smoke tests using two real Chrome profiles.
 *
 * These tests are non-destructive: they only browse and verify that the
 * customer account and admin console render for already-authenticated users.
 */

signedInTest.describe('signed-in smoke', () => {
  signedInTest.beforeEach(async ({ request, baseURL }) => {
    signedInTest.skip(await egressBlocked(request, baseURL), 'Egress proxy blocks this host.');
  });

  signedInTest('customer profile can access account pages', async ({ customerPage }) => {
    await expectCustomerSignedIn(customerPage);

    // Home should still show the signed-in account menu.
    await gotoHash(customerPage, '#/');
    await acceptCookies(customerPage);
    await expect(customerPage.locator('button[aria-label="Account menu"]').first()).toBeVisible({ timeout: 15_000 });

    // Orders tab
    await gotoHash(customerPage, '#/account/orders');
    await expect(
      customerPage.locator('[data-testid="order-row"]').first()
        .or(customerPage.getByText(/No orders yet/i))
    ).toBeVisible({ timeout: 15_000 });

    // Wishlist tab
    await gotoHash(customerPage, '#/account/wishlist');
    await expect(
      customerPage.getByText(/My Wishlist/i)
        .or(customerPage.getByText(/Save fabrics you love/i))
    ).toBeVisible({ timeout: 15_000 });

    // Addresses tab
    await gotoHash(customerPage, '#/account/addresses');
    await expect(
      customerPage.getByRole('button', { name: /Add Address|Save Address/i }).first()
        .or(customerPage.getByText(/Default/i).first())
    ).toBeVisible({ timeout: 15_000 });
  });

  signedInTest('admin profile can access the admin console', async ({ adminPage }) => {
    await expectAdminSignedIn(adminPage);

    // Dashboard
    await gotoHash(adminPage, '#/admin/dashboard');
    await expect(adminPage.getByRole('heading', { name: /Dashboard/i }).first()).toBeVisible({ timeout: 15_000 });

    // Orders section
    await gotoHash(adminPage, '#/admin/orders');
    await expect(adminPage.getByRole('heading', { name: 'Orders' }).first()).toBeVisible({ timeout: 15_000 });
    await expect(
      adminPage.locator('tbody tr').first()
        .or(adminPage.getByText(/No orders match/i))
    ).toBeVisible({ timeout: 15_000 });
  });
});
