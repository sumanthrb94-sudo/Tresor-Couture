import { chromium } from '@playwright/test';

const action = process.argv[2] || 'screenshot';

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();

  if (action === 'prepare-login') {
    await page.goto('https://tresorcouture.in');
    // Accept cookies if present
    const acceptAll = page.locator('button:has-text("ACCEPT ALL")');
    if (await acceptAll.isVisible().catch(() => false)) {
      await acceptAll.click();
      await page.waitForTimeout(500);
    }
    // Close membership modal if present
    const closeModal = page.locator('[aria-label="Close"], button:has-text("✕")').first();
    if (await closeModal.isVisible().catch(() => false)) {
      await closeModal.click();
      await page.waitForTimeout(500);
    }
    await page.goto('https://tresorcouture.in/#/login');
    await page.waitForTimeout(2_000);
  }

  await page.screenshot({ path: `cdp-${action}.png`, fullPage: true });
  console.log(`Screenshot saved to cdp-${action}.png`);
  console.log(`Current URL: ${page.url()}`);

  // Keep Chrome alive; force exit this script
  process.exit(0);
})();
