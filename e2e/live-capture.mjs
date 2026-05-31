// Capture tresorcouture.in across desktop + mobile for a UI/production review.
// Headless + low-memory (this box is RAM-tight).  node e2e/live-capture.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const BASE = process.env.SITE ?? 'https://tresorcouture.in';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'live');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const VIEWS = [
  { tag: 'desktop', w: 1366, h: 900 },
  { tag: 'mobile', w: 390, h: 844 },
];
const ROUTES = [
  ['home', ''],
  ['shop', '#/shop'],
  ['cart', '#/cart'],
  ['login', '#/login'],
  ['register', '#/register'],
  ['customise', '#/customise'],
  ['search', '#/search?q=silk'],
];

const errors = {};
const log = (...a) => console.log(...a);

(async () => {
  for (const v of VIEWS) {
    // Fresh browser per viewport — --single-process doesn't survive context recycling.
    const browser = await chromium.launch({
      headless: true,
      args: ['--single-process', '--no-zygote', '--disable-gpu', '--disable-dev-shm-usage', '--renderer-process-limit=1'],
    });
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const bucket = [];
    page.on('console', m => { if (m.type() === 'error') bucket.push(m.text()); });
    page.on('pageerror', e => bucket.push('PAGEERROR ' + e.message));

    // discover a product id from the shop page (first run only)
    let productId = null;

    for (const [name, route] of ROUTES) {
      const url = `${BASE}/${route}`;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(name === 'shop' || name === 'search' ? 4000 : 2500);
        if (name === 'shop' && !productId) {
          const btn = page.locator('.card-product button[aria-label]').first();
          if (await btn.count()) productId = await btn.getAttribute('aria-label');
        }
        const file = path.join(OUT, `${v.tag}-${name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        log(`✓ ${v.tag} ${name}`);
      } catch (e) {
        log(`✗ ${v.tag} ${name} — ${e.message.split('\n')[0]}`);
      }
    }

    // a product detail page
    try {
      await page.goto(`${BASE}/#/shop`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3500);
      const btn = page.locator('.card-product button[aria-label]').first();
      if (await btn.count()) {
        await btn.click();
        await page.locator('#pdp-add-to-bag').waitFor({ timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(OUT, `${v.tag}-product.png`), fullPage: true });
        log(`✓ ${v.tag} product`);
      }
    } catch (e) { log(`✗ ${v.tag} product — ${e.message.split('\n')[0]}`); }

    errors[v.tag] = bucket.slice();
    await ctx.close();
    await browser.close();
  }

  fs.writeFileSync(path.join(OUT, 'console-errors.json'), JSON.stringify(errors, null, 2));
  log('\nConsole errors:', JSON.stringify(errors, null, 2));
  log('Saved to', OUT);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
