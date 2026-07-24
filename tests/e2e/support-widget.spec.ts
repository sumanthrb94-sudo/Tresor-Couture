import { test, expect, type Page } from '@playwright/test';
import { egressBlocked } from './_helpers';

/**
 * Support widget + returns entry-point smoke tests — non-destructive, no auth,
 * no payment. Verifies the concierge launcher opens, exposes Chat + Call tabs,
 * routes guests to sign-in for live chat, and always offers direct call /
 * WhatsApp channels. Also checks the footer "Returns" link resolves to the
 * refund policy page.
 *
 * Signed-in behaviour (live chat send/receive, raising a return, the admin
 * Returns/Support consoles) is covered by the signed-in project, which needs a
 * real Firebase session — see tests/e2e/SIGNED_IN_README.md.
 */

test.beforeEach(async ({ request, baseURL }) => {
  test.skip(await egressBlocked(request, baseURL), 'Egress proxy blocks this host (run from an open-network environment).');
});

/** Dismiss the one-time DPDP consent card so it doesn't sit over the launcher. */
async function dismissConsent(page: Page) {
  const essential = page.getByRole('button', { name: /essential only/i });
  if (await essential.isVisible().catch(() => false)) {
    await essential.click();
    await essential.waitFor({ state: 'hidden' }).catch(() => {});
  }
}

async function loadHome(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await dismissConsent(page);
}

async function openWidget(page: Page) {
  await loadHome(page);
  await page.getByRole('button', { name: /chat with us/i }).click();
}

test.describe('support widget', () => {
  test('launcher opens the concierge with Chat and Call tabs', async ({ page }) => {
    await openWidget(page);
    await expect(page.getByText('Tresor Couture concierge')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /^chat$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^call$/i })).toBeVisible();
  });

  test('guest is prompted to sign in for live chat', async ({ page }) => {
    await openWidget(page);
    // Default tab is Chat; a signed-out visitor sees a sign-in prompt.
    await expect(page.getByText(/sign in to chat/i)).toBeVisible({ timeout: 15_000 });
  });

  test('Call tab always exposes a phone number and WhatsApp', async ({ page }) => {
    await openWidget(page);
    await page.getByRole('button', { name: /^call$/i }).click();
    // Direct-dial link.
    await expect(page.locator('a[href^="tel:"]').first()).toBeVisible({ timeout: 15_000 });
    // WhatsApp click-to-chat link.
    await expect(page.locator('a[href*="wa.me"]').first()).toBeVisible();
    // Guests are invited to sign in to request a callback.
    await expect(page.getByText(/sign in to request a callback/i)).toBeVisible();
  });
});

test.describe('returns entry point', () => {
  test('footer "Returns" opens the Refund & Returns policy', async ({ page }) => {
    await loadHome(page);
    const returns = page.getByRole('button', { name: /^returns$/i }).first();
    await returns.scrollIntoViewIfNeeded();
    await returns.click();
    await expect(page.getByRole('heading', { name: /refund.*returns policy/i })).toBeVisible({ timeout: 15_000 });
  });
});
