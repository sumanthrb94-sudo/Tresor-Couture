import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();
  const page = pages[0] || await context.newPage();

  console.log(`Connected. Pages: ${pages.length}`);
  console.log(`Current URL: ${page.url()}`);

  await page.screenshot({ path: 'cdp-current-page.png', fullPage: true });
  console.log('Screenshot saved to cdp-current-page.png');

  await browser.close();
})();
