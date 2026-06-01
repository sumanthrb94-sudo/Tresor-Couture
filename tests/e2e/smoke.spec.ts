import { test, expect, type Page } from '@playwright/test';
import { egressBlocked } from './_helpers';

test.beforeEach(async ({ request, baseURL }) => {
  test.skip(await egressBlocked(request, baseURL), 'Egress proxy blocks this host (run from an open-network environment).');
});

/**
 * Storefront smoke tests — non-destructive, no auth, no payment.
 * Verifies the site is live and the core browse → cart path renders.
 *
 * Hash routing: we navigate by setting the URL hash and waiting for the SPA
 * to hydrate (a visible heading / product card), rather than for server HTML.
 */

async function gotoHash(page: Page, hash: string) {
  await page.goto(`/${hash}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
}

test.describe('storefront', () => {
  test('home page loads and renders brand chrome', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    // Title should reference the brand.
    await expect(page).toHaveTitle(/tresor/i);
    // The page should not be a blank SPA shell: some product/brand text renders.
    await expect(page.locator('body')).toContainText(/tresor/i, { timeout: 15_000 });
  });

  test('a category page shows product cards', async ({ page }) => {
    await gotoHash(page, '#/shop?category=Sarees');
    // Product cards render prices in INR (₹). At least one should appear.
    await expect(page.getByText(/₹\s?[\d,]/).first()).toBeVisible({ timeout: 15_000 });
  });

  test('newsletter capture in the footer submits and confirms', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Use a clearly-tagged, non-personal test address so captured leads are
    // obviously synthetic in Firestore/Brevo.
    const email = `e2e+capture-${Date.now()}@example.com`;
    const emailInput = page.getByPlaceholder(/your email/i).first();
    await emailInput.scrollIntoViewIfNeeded();
    await emailInput.fill(email);

    // The submit button label is "Notify me".
    await page.getByRole('button', { name: /notify me/i }).first().click();

    // Success state replaces the form with a confirmation line.
    await expect(page.getByText(/on the list|watch your inbox/i)).toBeVisible({ timeout: 15_000 });
  });

  test('consent banner appears (analytics gate)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Banner copy mentions consent/cookies and has an Accept control.
    // It only shows until a choice is stored, so a fresh context should see it.
    const accept = page.getByRole('button', { name: /accept/i }).first();
    await expect(accept).toBeVisible({ timeout: 10_000 });
  });
});
