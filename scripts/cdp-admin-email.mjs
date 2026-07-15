import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9223');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();

  // We are on accounts.google.com sign-in page
  if (page.url().includes('accounts.google.com')) {
    await page.fill('input[type="email"], input[name="identifier"]', 'sumanthbolla97@gmail.com');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Next"), #identifierNext');
    console.log('Entered admin email and clicked Next');
    await page.waitForTimeout(3_000);
  }

  await page.screenshot({ path: 'cdp-admin-password.png', fullPage: true });
  console.log('Screenshot saved to cdp-admin-password.png');
  console.log('URL:', page.url());

  process.exit(0);
})();
