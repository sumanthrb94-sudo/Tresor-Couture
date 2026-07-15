import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9223');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();

  await page.waitForTimeout(5_000);

  const displayName = await page.locator('[data-testid="account-name"], .account-name, h1').first().textContent().catch(() => 'not found');
  const url = page.url();
  console.log('Admin URL:', url);
  console.log('Display name:', displayName.trim());

  await page.screenshot({ path: 'cdp-admin-after-signin.png', fullPage: true });
  console.log('Screenshot saved to cdp-admin-after-signin.png');

  process.exit(0);
})();
