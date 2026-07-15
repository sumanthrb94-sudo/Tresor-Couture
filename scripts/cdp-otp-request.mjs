import { chromium } from '@playwright/test';

const phone = process.argv[2] || '9700144003';

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();

  if (!page.url().includes('#/login')) {
    await page.goto('https://tresorcouture.in/#/login');
    await page.waitForTimeout(1_500);
  }

  // Click PHONE tab
  await page.click('button:has-text("PHONE")');
  await page.waitForTimeout(500);

  // Fill phone number
  await page.fill('input[name="phone"], input[placeholder*="phone" i], input[type="tel"]', phone);
  await page.waitForTimeout(300);

  // Click request OTP button (label varies)
  const otpBtn = page.locator('button:has-text("SEND OTP"), button:has-text("GET OTP"), button:has-text("Request OTP"), button[type="submit"]').first();
  await otpBtn.click();

  await page.waitForTimeout(2_000);
  await page.screenshot({ path: 'cdp-otp-request.png', fullPage: true });
  console.log(`OTP requested for ${phone}. Screenshot saved to cdp-otp-request.png`);

  process.exit(0);
})();
