import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SITE ?? 'http://localhost:3000';
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--single-process','--no-zygote','--disable-gpu','--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  const banner = page.locator('section', { hasText: 'Radical delivery' }).first();
  await banner.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await banner.screenshot({ path: path.join(__dirname, 'navbar', 'offersbanner-mobile.png') });
  console.log('saved offersbanner-mobile.png');
  await ctx.close(); await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(2); });
