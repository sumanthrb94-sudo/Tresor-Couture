import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9223');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();

  // Clear cache to pick up latest CSP
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

  await page.goto('https://tresorcouture.in/#/admin');
  await page.waitForTimeout(2_500);

  console.log('Admin URL:', page.url());
  await page.screenshot({ path: 'cdp-admin-login.png', fullPage: true });
  console.log('Screenshot saved to cdp-admin-login.png');

  process.exit(0);
})();
