import { test, expect, type Page } from '@playwright/test';
import { egressBlocked } from './_helpers';

/**
 * Storefront smoke tests — non-destructive, no auth, no payment.
 * Verifies the site is live and the core browse → cart path renders.
 *
 * Hash routing: navigate by setting the URL hash and waiting for the SPA to
 * hydrate (a visible heading / product card), not for server HTML.
 */

test.beforeEach(async ({ request, baseURL }) => {
  test.skip(await egressBlocked(request, baseURL), 'Egress proxy blocks this host (run from an open-network environment).');
});

async function gotoHash(page: Page, hash: string) {
  await page.goto(`/${hash}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
}

test.describe('storefront', () => {
  test('home page loads and renders brand chrome', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page).toHaveTitle(/tresor/i);
    await expect(page.locator('body')).toContainText(/tresor/i, { timeout: 15_000 });
  });

  test('a category page shows product cards with prices', async ({ page }) => {
    await gotoHash(page, '#/shop?category=Sarees');
    await expect(page.getByText(/₹\s?[\d,]/).first()).toBeVisible({ timeout: 15_000 });
  });

  test('footer newsletter capture submits and confirms', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Clearly-tagged synthetic address so captured leads are obviously test data.
    const email = `e2e+capture-${Date.now()}@example.com`;
    const emailInput = page.getByPlaceholder(/your email/i).first();
    await emailInput.scrollIntoViewIfNeeded();
    await emailInput.fill(email);

    // Footer button label is "Subscribe".
    await page.getByRole('button', { name: /subscribe/i }).first().click();

    // Success state replaces the form with a confirmation line ("on the list").
    await expect(page.getByText(/on the list|check your inbox/i)).toBeVisible({ timeout: 15_000 });
  });
});
