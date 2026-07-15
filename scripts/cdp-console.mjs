import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();

  const logs = [];
  page.on('console', msg => logs.push(`${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => logs.push(`pageerror: ${err.message}`));

  await page.goto('https://tresorcouture.in/#/login');
  await page.evaluate(() => location.reload(true)); // hard reload
  await page.waitForTimeout(2_500);

  await page.click('button:has-text("PHONE")');
  await page.waitForTimeout(500);
  await page.fill('input[name="phone"], input[placeholder*="phone" i], input[type="tel"]', '9700144003');
  await page.waitForTimeout(300);

  const otpBtn = page.locator('button:has-text("SEND CODE"), button:has-text("GET OTP"), button:has-text("Request OTP"), button[type="submit"]').first();
  await otpBtn.click();

  await page.waitForTimeout(4_000);
  console.log('--- Console logs ---');
  logs.forEach(l => console.log(l));
  console.log('--- End logs ---');

  await page.screenshot({ path: 'cdp-otp-console.png', fullPage: true });
  console.log('Screenshot saved to cdp-otp-console.png');

  process.exit(0);
})();
