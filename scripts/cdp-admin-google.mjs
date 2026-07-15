import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9223');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();

  if (!page.url().includes('#/login')) {
    await page.goto('https://tresorcouture.in/#/login');
    await page.waitForTimeout(1_500);
  }

  // Accept cookies if present
  const acceptAll = page.locator('button:has-text("ACCEPT ALL")');
  if (await acceptAll.isVisible().catch(() => false)) {
    await acceptAll.click();
    await page.waitForTimeout(500);
  }

  const googleBtn = page.locator('button:has-text("Continue with Google")');
  await googleBtn.click();
  console.log('Clicked Continue with Google');

  await page.waitForTimeout(4_000);
  await page.screenshot({ path: 'cdp-admin-google.png', fullPage: true });
  console.log('Screenshot saved to cdp-admin-google.png');

  process.exit(0);
})();
