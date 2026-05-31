// Mobile-viewport MENU/NAV audit against production (headless).
// Captures the navbar, hamburger drawer, expanded submenu, category strip and
// the shop filter drawer at a real phone size so menu PLACEMENT can be judged.
//
//   node e2e/mobile-menu-audit.mjs
//
// Output: e2e/mobile/ — both above-the-fold (viewport) and full-page shots.

import { chromium, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const BASE = process.env.SITE ?? 'https://tresorcouture.in';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'mobile');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
let page, n = 0;
const shot = async (label, full = false) => {
  try { await page.screenshot({ path: path.join(OUT, `${String(++n).padStart(2, '0')}-${label}.png`), fullPage: full }); log(`  📸 ${label}${full ? ' (full)' : ''}`); }
  catch (e) { log(`  ✗ shot ${label} — ${String(e.message).split('\n')[0]}`); }
};
const goto = (route) => page.goto(`${BASE}/${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--disable-dev-shm-usage', '--single-process', '--no-zygote'] });
  const ctx = await browser.newContext({ ...devices['iPhone 13'] }); // 390x844, mobile, touch
  page = await ctx.newPage();
  page.on('pageerror', e => log('  [pageerror]', e.message));

  log(`=== MOBILE MENU AUDIT @ iPhone 13 (390x844) on ${BASE} ===`);

  // 1) Home — navbar above the fold (logo / icons / hamburger placement).
  await goto(''); await page.waitForTimeout(3000);
  await shot('home-navbar-viewport');
  await shot('home-full', true);

  // 2) Open the hamburger drawer.
  try {
    await page.locator('[aria-label="Open menu"]').click({ timeout: 8000 });
    await page.waitForTimeout(800);
    await shot('drawer-open-viewport');
    await shot('drawer-open-full', true);
  } catch (e) { log('  ✗ open menu —', e.message.split('\n')[0]); }

  // 3) Expand the first category row in the drawer (submenu placement).
  try {
    // Category rows are buttons; the first expandable one toggles a submenu.
    const rows = page.locator('nav button, [role="dialog"] button, button');
    // Heuristic: click a button whose text is a known master category.
    const cat = page.getByRole('button', { name: /Sarees|Lehenga|Fabrics|Anarkalis|Western/i }).first();
    if (await cat.count()) { await cat.click({ timeout: 6000 }); await page.waitForTimeout(700); await shot('drawer-submenu-expanded', true); }
    else log('  (no expandable category row found)');
  } catch (e) { log('  ✗ expand category —', e.message.split('\n')[0]); }

  // Close drawer.
  try { await page.locator('[aria-label="Close menu"]').click({ timeout: 5000 }); await page.waitForTimeout(500); } catch {}

  // 4) Category strip on home (scroll a bit to show it under the navbar).
  try { await goto(''); await page.waitForTimeout(2500); await page.mouse.wheel(0, 120); await page.waitForTimeout(500); await shot('home-category-strip'); } catch {}

  // 5) Shop page — navbar + any sticky sub-nav.
  await goto('#/shop'); await page.waitForTimeout(3000);
  await shot('shop-top-viewport');

  // 6) Shop filter drawer (mobile filter trigger).
  try {
    const f = page.getByRole('button', { name: /filter|filters|sort/i }).first();
    if (await f.count()) { await f.click({ timeout: 6000 }); await page.waitForTimeout(800); await shot('shop-filter-drawer', true); }
    else log('  (no filter/sort button found on shop)');
  } catch (e) { log('  ✗ filter drawer —', e.message.split('\n')[0]); }

  // 7) Product page — sticky add-to-bag bar placement.
  try {
    await goto('#/shop'); await page.waitForTimeout(2500);
    await page.locator('.card-product').first().click({ timeout: 12000 });
    await page.waitForURL(/#\/product\//, { timeout: 12000 });
    await page.waitForTimeout(2500);
    await shot('product-top-viewport');
    await page.mouse.wheel(0, 1400); await page.waitForTimeout(800);
    await shot('product-scrolled-sticky-bar');
  } catch (e) { log('  ✗ product —', e.message.split('\n')[0]); }

  // 8) Cart (mobile).
  try { await goto('#/cart'); await page.waitForTimeout(2500); await shot('cart-viewport'); } catch {}

  // 9) Login screen (tab placement) + actual email/password sign-in.
  await goto('#/login'); await page.waitForTimeout(2000);
  await shot('login-viewport');
  const EMAIL = process.env.E2E_EMAIL, PASS = process.env.E2E_PASS;
  let signedIn = false;
  if (EMAIL && PASS) {
    try {
      await page.locator('#login-email').fill(EMAIL, { timeout: 8000 });
      await page.locator('#login-password').fill(PASS);
      await page.getByRole('button', { name: /^Login$/ }).click();
      signedIn = await page.waitForURL(u => !/#\/login/.test(u.href), { timeout: 30000 }).then(() => true).catch(() => false);
      log(signedIn ? '  ✓ signed in (email/password)' : '  ✗ sign-in did not redirect');
      await page.waitForTimeout(2000);
    } catch (e) { log('  ✗ login —', e.message.split('\n')[0]); }
  } else { log('  (no E2E_EMAIL/E2E_PASS env — skipping signed-in captures)'); }

  // 10) Signed-in hamburger drawer (should show Account / Logout).
  if (signedIn) {
    try {
      await goto(''); await page.waitForTimeout(2500);
      await page.locator('[aria-label="Open menu"]').click({ timeout: 8000 });
      await page.waitForTimeout(800);
      await shot('drawer-signedin-full', true);
      await page.locator('[aria-label="Close menu"]').click({ timeout: 5000 }).catch(() => {});
    } catch (e) { log('  ✗ signed-in drawer —', e.message.split('\n')[0]); }
    // 11) Account page (mobile tab/menu placement).
    try { await goto('#/account/profile'); await page.waitForTimeout(2500); await shot('account-mobile-viewport'); await shot('account-mobile-full', true); } catch {}
  }

  log('=== DONE. Screenshots in e2e/mobile/ ===');
  await browser.close();
  process.exit(0);
})().catch(e => { log('FATAL', e?.message ?? e); process.exit(2); });
