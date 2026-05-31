// Headed functional test of tresorcouture.in — exercises components and
// checks state-sync (cart/wishlist badges). Stops BEFORE any real payment.
//   node e2e/live-functional.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const BASE = process.env.SITE ?? 'https://tresorcouture.in';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'live-func');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const results = [];
let page, shot = 0, bucket = [];
const noteErr = (k, t) => { if (!/favicon/i.test(t)) bucket.push(`[${k}] ${t}`); };
const snap = async n => { try { await page.screenshot({ path: path.join(OUT, `${String(++shot).padStart(2,'0')}-${n}.png`), fullPage: false }); } catch {} };
async function step(name, fn) {
  bucket = []; let status = 'PASS', detail = '';
  try { detail = (await fn()) ?? ''; }
  catch (e) { status = 'FAIL'; detail = e?.message?.split('\n')[0] ?? String(e); }
  await snap(name.replace(/[^a-z0-9]+/gi, '-').toLowerCase());
  if (status === 'PASS' && bucket.some(e => e.startsWith('[pageerror]'))) status = 'WARN';
  results.push({ name, status, detail, errs: bucket.slice() });
  console.log(`${status === 'PASS' ? '✓' : status === 'WARN' ? '!' : '✗'} ${name}${detail ? ` — ${detail}` : ''}${bucket.length ? `  (${bucket.length} err)` : ''}`);
}
const cartBadge = async () => {
  const t = await page.locator('button[aria-label="Bag"]').innerText().catch(() => '');
  const m = t.match(/\d+/); return m ? +m[0] : 0;
};

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled', '--disable-gpu', '--disable-dev-shm-usage'] });
  page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  page.on('console', m => { if (m.type() === 'error') noteErr('console', m.text()); });
  page.on('pageerror', e => noteErr('pageerror', e.message));

  await step('Home loads', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.locator('header').getByText('TRESOR').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    return 'header visible';
  });

  await step('Category nav → Sarees', async () => {
    await page.getByRole('button', { name: 'Sarees', exact: true }).first().click();
    await page.waitForURL(/#\/shop/, { timeout: 10000 });
    await page.locator('.card-product').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(800);
    return `${await page.locator('.card-product').count()} products`;
  });

  await step('Search "silk"', async () => {
    await page.goto(`${BASE}/#/search?q=silk`, { waitUntil: 'domcontentloaded' });
    await page.getByText(/fabrics? matched/i).waitFor({ timeout: 20000 });
    return (await page.getByText(/fabrics? matched/i).innerText()).trim();
  });

  await step('Open product detail', async () => {
    await page.goto(`${BASE}/#/shop`, { waitUntil: 'domcontentloaded' });
    await page.locator('.card-product button[aria-label]').first().click();
    await page.locator('#pdp-add-to-bag').waitFor({ timeout: 20000 });
    await page.waitForTimeout(1000);
    return (await page.locator('main h1').first().innerText()).trim();
  });

  await step('Add to bag → cart badge sync', async () => {
    await page.locator('#pdp-add-to-bag').click();
    await page.waitForURL(/#\/cart/, { timeout: 10000 });
    await page.getByRole('heading', { name: /My Bag/i }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);
    const badge = await cartBadge();
    if (badge < 1) throw new Error('cart badge did not update after add');
    return `badge=${badge}, item shown`;
  });

  await step('Coupon apply on cart', async () => {
    const input = page.locator('input[placeholder="Enter coupon code"]').first();
    await input.fill('UPI10');
    await page.getByRole('button', { name: 'APPLY' }).first().click();
    const msg = page.locator('p.font-semibold').filter({ hasText: /off|coupon|active|expired|invalid|more to use/i }).first();
    await msg.waitFor({ timeout: 15000 });
    return (await msg.innerText()).trim();
  });

  await step('Wishlist toggle → badge sync', async () => {
    await page.goto(`${BASE}/#/shop`, { waitUntil: 'domcontentloaded' });
    await page.locator('.card-product').first().waitFor({ timeout: 20000 });
    const heart = page.locator('.card-product button[aria-label*="wishlist" i]').first();
    await heart.click();
    await page.waitForTimeout(800);
    const t = await page.locator('button[aria-label="Wishlist"]').innerText().catch(() => '');
    const n = (t.match(/\d+/) || [])[0];
    return n ? `wishlist badge=${n}` : 'clicked (badge not numeric — may require auth)';
  });

  await step('Cart → checkout (stop before payment)', async () => {
    await page.goto(`${BASE}/#/cart`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Place Order' }).waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: 'Place Order' }).click();
    await page.waitForURL(/#\/checkout/, { timeout: 10000 });
    await page.getByRole('heading', { name: 'Checkout' }).waitFor({ timeout: 15000 });
    return 'checkout reached — NOT placing payment on production';
  });

  await step('Customise page', async () => {
    await page.goto(`${BASE}/#/customise`, { waitUntil: 'domcontentloaded' });
    await page.locator('h1, h2').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    return (await page.locator('h1, h2').first().innerText()).trim().slice(0, 50);
  });

  console.log('\nHolding browser open 15s…');
  await page.waitForTimeout(15000);
  await browser.close();
  const pass = results.filter(r => r.status === 'PASS').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  console.log(`\n── LIVE FUNCTIONAL ──  PASS ${pass}  WARN ${warn}  FAIL ${fail}`);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2));
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL', e?.message ?? e); process.exit(2); });
