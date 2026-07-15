import { chromium } from '@playwright/test';

async function checkWindow(port, label) {
  const browser = await chromium.connectOverCDP(`http://localhost:${port}`);
  const context = browser.contexts()[0];
  const page = context.pages()[context.pages().length - 1] || await context.newPage();

  await page.goto('https://tresorcouture.in/#/account');
  await page.waitForTimeout(2_000);

  const url = page.url();
  const displayName = await page.locator('[data-testid="account-name"], .account-name, h1').first().textContent().catch(() => 'not found');
  const bodyText = await page.locator('body').textContent().catch(() => '');

  console.log(`\n--- ${label} (port ${port}) ---`);
  console.log('URL:', url);
  console.log('Display name:', displayName.trim());
  console.log('Contains "admin":', bodyText.toLowerCase().includes('admin'));
  console.log('Contains "orders":', bodyText.toLowerCase().includes('orders'));

  await page.screenshot({ path: `cdp-${label.toLowerCase().replace(/ /g, '-')}-account.png`, fullPage: true });
  console.log(`Screenshot saved to cdp-${label.toLowerCase().replace(/ /g, '-')}-account.png`);
}

(async () => {
  await checkWindow(9222, 'Customer');
  await checkWindow(9223, 'Admin');
  process.exit(0);
})();
