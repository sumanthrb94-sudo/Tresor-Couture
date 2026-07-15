import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9223');
  const context = browser.contexts()[0];
  const pages = context.pages();
  console.log(`Pages: ${pages.length}`);

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    console.log(`Page ${i}: ${p.url()}`);
  }

  // Use the last page (most recent)
  const page = pages[pages.length - 1];
  await page.waitForTimeout(2_000);

  const displayName = await page.locator('[data-testid="account-name"], .account-name, h1').first().textContent().catch(() => 'not found');
  console.log('Display name:', displayName.trim());
  console.log('URL:', page.url());

  await page.screenshot({ path: 'cdp-admin-check.png', fullPage: true });
  console.log('Screenshot saved to cdp-admin-check.png');

  process.exit(0);
})();
