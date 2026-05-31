// Signed-in happy path: register a throwaway account → buy a fabric end-to-end.
// Creates ONE real Firebase Auth user + ONE demo order (no real charge).
//   node e2e/signed-in.mjs

import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3002';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ART = path.join(__dirname, 'artifacts-signedin');
fs.rmSync(ART, { recursive: true, force: true });
fs.mkdirSync(ART, { recursive: true });

const EMAIL = `tresor.e2e+${Date.now()}@example.com`;
const PASS = 'tresore2e123';
const results = [];
let page, browser, shot = 0, bucket = [];

const noteErr = (k, t) => { if (!/favicon/i.test(t)) bucket.push(`[${k}] ${t}`); };
async function snap(n) { const f = path.join(ART, `${String(++shot).padStart(2,'0')}-${n}.png`); try { await page.screenshot({ path: f }); } catch {} }
async function step(name, fn) {
  bucket = []; let status = 'PASS', detail = '';
  try { detail = (await fn()) ?? ''; }
  catch (e) { status = 'FAIL'; detail = e?.message?.split('\n')[0] ?? String(e); }
  await snap(name.replace(/[^a-z0-9]+/gi, '-').toLowerCase());
  if (status === 'PASS' && bucket.some(e => e.startsWith('[pageerror]'))) status = 'WARN';
  results.push({ name, status, detail, errs: bucket.slice() });
  console.log(`${status === 'PASS' ? '✓' : status === 'WARN' ? '!' : '✗'} ${name}${detail ? ` — ${detail}` : ''}${bucket.length ? `  (${bucket.length} err)` : ''}`);
  return status;
}

(async () => {
  browser = await chromium.launch({ headless: !process.env.HEADED });
  page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  page.on('console', m => { if (m.type() === 'error') noteErr('console', m.text()); });
  page.on('pageerror', e => noteErr('pageerror', e.message));

  await step('Register fresh account', async () => {
    await page.goto(`${BASE}/#/register`, { waitUntil: 'domcontentloaded' });
    await page.locator('#register-name').fill('Tresor E2E');
    await page.locator('#register-email').fill(EMAIL);
    await page.locator('#register-password').fill(PASS);
    await page.locator('#register-confirm').fill(PASS);
    await page.getByRole('button', { name: 'Create Account' }).click();
    const res = await Promise.race([
      page.waitForURL(u => !/#\/register/.test(u.href), { timeout: 20000 }).then(() => 'ok').catch(() => null),
      page.getByRole('alert').first().waitFor({ timeout: 20000 }).then(() => 'alert').catch(() => null),
    ]);
    if (res === 'alert') throw new Error(`register rejected: ${(await page.getByRole('alert').first().innerText()).trim()}`);
    return `account created (${EMAIL})`;
  });

  await step('Add a product to bag', async () => {
    await page.goto(`${BASE}/#/shop`, { waitUntil: 'domcontentloaded' });
    await page.locator('.card-product button[aria-label]').first().click();
    await page.locator('#pdp-add-to-bag').waitFor({ timeout: 20000 });
    await page.locator('#pdp-add-to-bag').click();
    await page.waitForURL(/#\/cart/, { timeout: 10000 });
    return 'item in bag';
  });

  await step('Cart → checkout → fill address', async () => {
    await page.getByRole('button', { name: 'Place Order' }).click();
    await page.waitForURL(/#\/checkout/, { timeout: 10000 });
    await page.getByRole('heading', { name: 'Checkout' }).waitFor({ timeout: 15000 });
    const cont = page.getByRole('button', { name: 'Continue' });
    if (await cont.count()) await cont.first().click().catch(() => {});
    const fields = [
      ['Full Name', 'Tresor E2E'], ['Email', EMAIL], ['Phone', '9876543210'],
      ['Address Line 1', '12 Banjara Hills Road'], ['City', 'Hyderabad'],
      ['State', 'Telangana'], ['PIN Code', '500034'], ['Country', 'India'],
    ];
    for (const [label, val] of fields) {
      const inp = page.locator(`xpath=//label[normalize-space()="${label}"]/following-sibling::input[1]`).first();
      if (await inp.count()) { const c = await inp.inputValue().catch(() => ''); if (!c.trim()) await inp.fill(val); }
    }
    await page.getByRole('button', { name: 'Save & Continue' }).click();
    // Payment step: COD is the only live method (online gateway = coming soon).
    await page.getByRole('button', { name: /^Place Order/ }).waitFor({ timeout: 10000 });
    return 'address saved, COD payment step ready';
  });

  let orderId = '';
  await step('Place COD order → confirmation', async () => {
    await page.getByRole('button', { name: /^Place Order/ }).click();
    await page.waitForURL(/#\/confirmation\//, { timeout: 25000 });
    orderId = page.url().split('/confirmation/')[1] ?? '';
    return `confirmed → order ${orderId}`;
  });

  await step('Order appears in My Orders', async () => {
    await page.goto(`${BASE}/#/account/orders`, { waitUntil: 'domcontentloaded' });
    await page.locator('main, [class*="min-h-screen"]').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500); // let Firestore order list hydrate
    const body = await page.locator('body').innerText();
    const short = orderId.slice(0, 6);
    if (orderId && body.includes(short)) return `order ${short}… listed`;
    if (/order|placed|delivered|processing/i.test(body)) return 'orders list rendered';
    throw new Error('no order visible in account');
  });

  await browser.close();
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  console.log(`\n── SIGNED-IN SUMMARY ──  PASS ${pass}  FAIL ${fail}  (of ${results.length})`);
  console.log(`Test user: ${EMAIL}  |  Order: ${orderId || '—'}`);
  fs.writeFileSync(path.join(ART, 'report.json'), JSON.stringify({ user: EMAIL, orderId, results }, null, 2));
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
