import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();

  await page.goto('https://tresorcouture.in/');
  // Hard reload to bypass cache
  await page.evaluate(() => location.reload(true));
  await page.waitForTimeout(3_000);

  const csp = await page.evaluate(() => {
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    return meta ? meta.content : 'no meta CSP';
  });
  console.log('Meta CSP:', csp);

  // Capture response headers via CDP
  const client = await page.context().newCDPSession(page);
  // Not available directly, skip

  await page.screenshot({ path: 'cdp-hard-reload.png', fullPage: true });
  console.log('Screenshot saved to cdp-hard-reload.png');

  process.exit(0);
})();
