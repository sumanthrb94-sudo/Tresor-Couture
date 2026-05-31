// Headed, watchable end-to-end run against PRODUCTION (tresorcouture.in).
// You sign in manually (Google or phone) when it reaches the login page; the
// script detects the signed-in state and continues through a real COD order,
// then verifies the cart empties (the fix shipped today).
//
//   node e2e/live-e2e-watch.mjs
//
// Screenshots land in e2e/watch/. Real Chrome is used (channel:'chrome') so
// Google OAuth is less likely to be blocked than in bundled Chromium.

import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const BASE = process.env.SITE ?? 'https://tresorcouture.in';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'watch');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
let page, n = 0;
const snap = async label => { try { await page.screenshot({ path: path.join(OUT, `${String(++n).padStart(2, '0')}-${label}.png`), fullPage: true }); log(`  📸 ${label}`); } catch {} };
const step = async (label, fn) => { try { log(`▶ ${label}`); await fn(); await snap(label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()); log(`  ✓ ${label}`); return true; } catch (e) { log(`  ✗ ${label} — ${String(e.message).split('\n')[0]}`); await snap(`FAIL-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`); return false; } };
const goto = (route) => page.goto(`${BASE}/${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--disable-blink-features=AutomationControlled', '--disable-gpu', '--disable-dev-shm-usage', '--start-maximized'] });
    log('Launched real Chrome.');
  } catch {
    browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled', '--disable-gpu', '--disable-dev-shm-usage'] });
    log('Launched bundled Chromium (real Chrome unavailable).');
  }
  const ctx = await browser.newContext({ viewport: null });
  page = await ctx.newPage();
  page.on('pageerror', e => log('  [pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') log('  [console.error]', m.text().slice(0, 200)); });

  log(`=== GUEST FLOW on ${BASE} ===`);
  await step('home', async () => { await goto(''); await page.waitForTimeout(2500); });
  await step('shop', async () => { await goto('#/shop'); await page.waitForTimeout(3000); });
  await step('open first product', async () => {
    await page.locator('.card-product').first().click({ timeout: 15000 });
    await page.waitForURL(/#\/product\//, { timeout: 15000 });
    await page.waitForTimeout(2000);
  });
  await step('select length + add to bag', async () => {
    // Pick the first length pill (Add to Bag is disabled until a length is chosen).
    const pill = page.locator('button').filter({ hasText: /^\s*\d+\s*m\s*$/ }).first();
    if (await pill.count()) await pill.click().catch(() => {});
    await page.waitForTimeout(500);
    await page.locator('#pdp-add-to-bag').click({ timeout: 8000 });
    await page.waitForTimeout(1500);
  });
  await step('cart', async () => { await goto('#/cart'); await page.waitForTimeout(2500); });
  await step('checkout (guest sees login gate)', async () => { await goto('#/checkout'); await page.waitForTimeout(2500); });

  // ---- SIGN-IN CHECKPOINT (manual) ----
  log('');
  log('============================================================');
  log('  PLEASE SIGN IN NOW in the Chrome window.');
  log('  Go to the Login page, tap "Continue with Google" (or use');
  log('  the Phone tab). The test continues automatically once you');
  log('  are signed in. Waiting up to 7 minutes…');
  log('============================================================');
  await goto('#/login');
  const signedIn = await page.waitForURL(u => !/#\/login/.test(u.href) && !/#\/register/.test(u.href), { timeout: 7 * 60 * 1000 })
    .then(() => true).catch(() => false);
  await snap('after-signin');
  if (!signedIn) { log('✗ Did not detect sign-in within 7 min. Stopping.'); await page.waitForTimeout(8000); await browser.close(); process.exit(1); }
  log('✓ Signed in — continuing.');
  await page.waitForTimeout(1500);

  log('=== LOGGED-IN FLOW ===');
  await step('account · profile', async () => { await goto('#/account/profile'); await page.waitForTimeout(2500); });
  await step('account · orders', async () => { await goto('#/account/orders'); await page.waitForTimeout(2000); });
  await step('account · wishlist', async () => { await goto('#/account/wishlist'); await page.waitForTimeout(2000); });
  await step('account · addresses', async () => { await goto('#/account/addresses'); await page.waitForTimeout(2000); });

  log('=== BUILD CART + PLACE COD ORDER ===');
  await step('shop → product → add to bag', async () => {
    await goto('#/shop'); await page.waitForTimeout(2500);
    await page.locator('.card-product').first().click({ timeout: 15000 });
    await page.waitForURL(/#\/product\//, { timeout: 15000 });
    await page.waitForTimeout(1500);
    const pill = page.locator('button').filter({ hasText: /^\s*\d+\s*m\s*$/ }).first();
    if (await pill.count()) await pill.click().catch(() => {});
    await page.waitForTimeout(400);
    await page.locator('#pdp-add-to-bag').click({ timeout: 8000 });
    await page.waitForTimeout(1500);
  });

  await step('go to checkout', async () => { await goto('#/checkout'); await page.waitForTimeout(2500); });

  // Best-effort: advance the steps and fill the address if it isn't saved.
  await step('fill address + continue', async () => {
    // Step 1 (login) — click Continue if shown.
    const cont1 = page.getByRole('button', { name: /^Continue$/ });
    if (await cont1.count()) await cont1.first().click().catch(() => {});
    await page.waitForTimeout(800);
    const fill = async (labelText, value) => {
      const inp = page.locator(`label:has-text("${labelText}") + input`).first();
      if (await inp.count()) { await inp.fill(value).catch(() => {}); }
    };
    // Leave Email untouched so the confirmation email goes to your real address.
    await fill('Full Name', 'Tresor Tester');
    await fill('Phone', '9876543210');
    await fill('Address Line 1', '12 Heritage Lane');
    await fill('City', 'Hyderabad');
    await fill('State', 'Telangana');
    await fill('PIN Code', '500001');
    await fill('Country', 'India');
    await page.waitForTimeout(400);
    const saveCont = page.getByRole('button', { name: /Save & Continue/i });
    if (await saveCont.count()) await saveCont.first().click().catch(() => {});
    await page.waitForTimeout(1000);
  });

  await step('place COD order', async () => {
    const place = page.getByRole('button', { name: /Place Order/i });
    if (await place.count()) await place.first().click({ timeout: 8000 }).catch(() => {});
  });

  // Wait for the confirmation page — automated OR completed by you manually.
  log('Waiting up to 5 min for the order confirmation (complete it manually in the window if needed)…');
  const confirmed = await page.waitForURL(/#\/confirmation\//, { timeout: 5 * 60 * 1000 }).then(() => true).catch(() => false);
  await snap('after-place-order');
  if (confirmed) log('✓ Order confirmed.'); else log('⚠ No confirmation URL detected (order may not have been placed).');

  // ---- VERIFY THE CART-CLEAR FIX ----
  await page.waitForTimeout(2500);
  await step('verify cart is EMPTY after order', async () => {
    await goto('#/cart'); await page.waitForTimeout(3000);
  });
  const bodyText = (await page.locator('body').innerText().catch(() => '')) || '';
  const emptyCart = /empty/i.test(bodyText) && !/Order Summary|Place Order/i.test(bodyText);
  log(`CART-CLEAR CHECK: ${emptyCart ? 'PASS ✓ (cart is empty)' : 'FAIL ✗ (cart still has items)'}`);

  log('=== DONE. Window stays open 25s for inspection. Screenshots in e2e/watch/ ===');
  await page.waitForTimeout(25000);
  await browser.close();
  process.exit(0);
})().catch(e => { log('FATAL', e?.message ?? e); process.exit(2); });
