import { chromium } from '@playwright/test';
const BASE = process.env.SITE ?? 'http://localhost:3000';
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--single-process','--no-zygote','--disable-gpu','--disable-dev-shm-usage'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  await page.goto(`${BASE}/#/shop`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('.card-product button[aria-label]').first().waitFor({ timeout: 25000 });
  console.log('shop cards rendered:', await page.locator('.card-product').count());
  await page.locator('.card-product button[aria-label]').first().click();
  const found = await page.locator('#pdp-add-to-bag').waitFor({ timeout: 25000 }).then(() => true).catch(() => false);
  console.log('pdp-add-to-bag found:', found);
  if (found) {
    console.log('button text:', (await page.locator('#pdp-add-to-bag').innerText()).trim());
    console.log('disabled:', await page.locator('#pdp-add-to-bag').isDisabled());
  } else {
    // dump the main heading / any error fallback text
    const body = (await page.locator('main, body').first().innerText().catch(() => '')).slice(0, 300);
    console.log('PDP body snippet:', JSON.stringify(body));
  }
  console.log('errors:', JSON.stringify(errs, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(2); });
