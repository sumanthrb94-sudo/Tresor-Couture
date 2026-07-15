import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();

  await page.goto('https://tresorcouture.in/#/account');
  await page.waitForTimeout(2_000);

  const displayName = await page.locator('[data-testid="account-name"], .account-name, h1').first().textContent().catch(() => 'not found');
  const userEmail = await page.evaluate(() => localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail') || '');
  const uid = await page.evaluate(() => localStorage.getItem('userUid') || sessionStorage.getItem('userUid') || '');

  console.log('Display name:', displayName.trim());
  console.log('userEmail:', userEmail);
  console.log('userUid:', uid);
  console.log('URL:', page.url());

  await page.screenshot({ path: 'cdp-customer-account.png', fullPage: true });
  console.log('Screenshot saved to cdp-customer-account.png');

  process.exit(0);
})();
