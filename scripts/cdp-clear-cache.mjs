import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();

  // Clear browser cache and storage
  await context.clearCookies();
  await page.evaluate(async () => {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto('https://tresorcouture.in/#/login');
  await page.waitForTimeout(2_000);

  const hasSW = await page.evaluate(() => 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null);
  console.log('Service worker controlling?', hasSW);

  await page.screenshot({ path: 'cdp-after-cache-clear.png', fullPage: true });
  console.log('Screenshot saved to cdp-after-cache-clear.png');

  process.exit(0);
})();
