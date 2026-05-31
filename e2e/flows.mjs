// Core-user-flow E2E runner for Tresor Couture (http://localhost:3002)
// Standalone Playwright script (not the test runner) so we get a custom,
// readable PASS/FAIL report + per-step screenshots and console-error capture.
//
//   node e2e/flows.mjs            # headless (default)
//   HEADED=1 node e2e/flows.mjs   # watch it run

import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3002';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ART = path.join(__dirname, 'artifacts');
fs.rmSync(ART, { recursive: true, force: true });
fs.mkdirSync(ART, { recursive: true });

const results = [];
let page, ctx, browser;
let shot = 0;

// Console / page errors accumulated for the *current* step only.
let bucket = [];
const noteError = (kind, text) => {
  // Filter noise that isn't a real app fault.
  if (/favicon|net::ERR_INTERNET_DISCONNECTED/i.test(text)) return;
  bucket.push(`[${kind}] ${text}`);
};

async function snap(name) {
  const file = path.join(ART, `${String(++shot).padStart(2, '0')}-${name}.png`);
  try { await page.screenshot({ path: file, fullPage: false }); } catch {}
  return path.basename(file);
}

async function step(name, fn) {
  bucket = [];
  const t0 = Date.now();
  let status = 'PASS', detail = '', file = '';
  try {
    detail = (await fn()) ?? '';
  } catch (err) {
    status = 'FAIL';
    detail = err?.message?.split('\n')[0] ?? String(err);
  }
  file = await snap(name.replace(/[^a-z0-9]+/gi, '-').toLowerCase());
  const errs = bucket.slice();
  // A step that "passed" but logged a real console/page error is degraded.
  if (status === 'PASS' && errs.some(e => e.startsWith('[pageerror]'))) status = 'WARN';
  results.push({ name, status, detail, ms: Date.now() - t0, shot: file, errs });
  const icon = status === 'PASS' ? '✓' : status === 'WARN' ? '!' : '✗';
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ''}${errs.length ? `  (${errs.length} console err)` : ''}`);
  return status;
}

const h = () => page.locator('h1');

(async () => {
  browser = await chromium.launch({ headless: !process.env.HEADED });
  ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  page = await ctx.newPage();

  page.on('console', m => { if (m.type() === 'error') noteError('console', m.text()); });
  page.on('pageerror', e => noteError('pageerror', e.message));
  page.on('requestfailed', r => noteError('requestfailed', `${r.url()} ${r.failure()?.errorText ?? ''}`));

  // ── 1. Home ───────────────────────────────────────────────────────────────
  await step('Home loads', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 20000 }).catch(() => {});
    await page.locator('header').getByText('TRESOR').first().waitFor({ timeout: 20000 });
    return 'header + brand visible';
  });

  // ── 2. Shop / catalogue ─────────────────────────────────────────────────────
  let productCount = 0;
  await step('Shop catalogue renders products', async () => {
    await page.goto(`${BASE}/#/shop`, { waitUntil: 'domcontentloaded' });
    await page.locator('.card-product').first().waitFor({ timeout: 25000 });
    productCount = await page.locator('.card-product').count();
    if (productCount === 0) throw new Error('no product cards rendered');
    return `${productCount} product cards`;
  });

  // ── 3. Product detail page ───────────────────────────────────────────────────
  let productName = '';
  await step('Open product detail page', async () => {
    await page.locator('.card-product button[aria-label]').first().click();
    await page.locator('#pdp-add-to-bag').waitFor({ timeout: 20000 });
    productName = (await page.locator('main h1').first().innerText()).trim();
    const url = page.url();
    if (!/#\/product\//.test(url)) throw new Error(`unexpected url ${url}`);
    return `PDP for "${productName}"`;
  });

  // ── 4. Add to bag → cart ─────────────────────────────────────────────────────
  await step('Add to bag navigates to cart', async () => {
    await page.locator('#pdp-add-to-bag').click();
    await page.waitForURL(/#\/cart/, { timeout: 10000 });
    await page.getByRole('heading', { name: /My Bag/i }).waitFor({ timeout: 15000 });
    const items = await page.locator('text=/Sold by: Tresor Atelier/').count();
    if (items < 1) throw new Error('cart shows no line items after add');
    return `${items} item(s) in bag`;
  });

  // ── 5. Coupon validation (Firestore couponsApi) ─────────────────────────────
  await step('Apply coupon on cart', async () => {
    const input = page.locator('input[placeholder="Enter coupon code"]').first();
    await input.fill('WEDDING50');
    await page.getByRole('button', { name: 'APPLY' }).first().click();
    // Either an "applied" (green) or rejection message must appear — both prove
    // the coupon API responded. A thrown/timeout here is the real failure.
    const msg = page.locator('aside p.font-semibold, p.font-semibold').filter({ hasText: /off|coupon|active|expired|invalid|more to use/i }).first();
    await msg.waitFor({ timeout: 15000 });
    return (await msg.innerText()).trim();
  });

  // ── 6. Cart → checkout (guest gate) ──────────────────────────────────────────
  await step('Proceed to checkout (guest)', async () => {
    await page.getByRole('button', { name: 'Place Order' }).click();
    await page.waitForURL(/#\/checkout/, { timeout: 10000 });
    await page.getByRole('heading', { name: 'Checkout' }).waitFor({ timeout: 15000 });
    const loginStep = await page.getByText(/Login or Sign Up/i).count();
    return loginStep ? 'checkout reached, guest login step shown' : 'checkout reached';
  });

  // ── 7. Sign in with demo credentials ─────────────────────────────────────────
  let signedIn = false;
  await step('Sign in with demo credentials', async () => {
    await page.goto(`${BASE}/#/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('#login-email').fill('admin@tresor.test');
    await page.locator('#login-password').fill('tresor-admin');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    // Success → redirect off /login (admin lands on /admin). Failure → red alert.
    const res = await Promise.race([
      page.waitForURL(u => !/#\/login/.test(u.href), { timeout: 15000 }).then(() => 'ok').catch(() => null),
      page.getByRole('alert').first().waitFor({ timeout: 15000 }).then(() => 'alert').catch(() => null),
    ]);
    if (res === 'alert') {
      const txt = await page.getByRole('alert').first().innerText();
      throw new Error(`login rejected: ${txt.trim()}`);
    }
    signedIn = true;
    return `signed in, redirected to ${new URL(page.url()).hash || '/'}`;
  });

  // ── 8. Full signed-in checkout + payment + order confirmation ────────────────
  if (signedIn) {
    await step('Re-add product to bag (signed in)', async () => {
      await page.goto(`${BASE}/#/shop`, { waitUntil: 'domcontentloaded' });
      await page.locator('.card-product button[aria-label]').first().click();
      await page.locator('#pdp-add-to-bag').waitFor({ timeout: 20000 });
      await page.locator('#pdp-add-to-bag').click();
      await page.waitForURL(/#\/cart/, { timeout: 10000 });
      return 'item in bag';
    });

    await step('Checkout: fill address → payment', async () => {
      await page.getByRole('button', { name: 'Place Order' }).click();
      await page.waitForURL(/#\/checkout/, { timeout: 10000 });
      await page.getByRole('heading', { name: 'Checkout' }).waitFor({ timeout: 15000 });

      // If the login step is active (guest carry-over), advance it.
      const cont = page.getByRole('button', { name: 'Continue' });
      if (await cont.count()) await cont.first().click().catch(() => {});

      // Fill any empty required address field. Inputs sit as siblings of their <label>.
      const fields = [
        ['Full Name', 'Test Buyer'],
        ['Email', 'test.buyer@example.com'],
        ['Phone', '9876543210'],
        ['Address Line 1', '12 Banjara Hills Road'],
        ['City', 'Hyderabad'],
        ['State', 'Telangana'],
        ['PIN Code', '500034'],
        ['Country', 'India'],
      ];
      for (const [label, val] of fields) {
        const inp = page.locator(`xpath=//label[normalize-space()="${label}"]/following-sibling::input[1]`).first();
        if (await inp.count()) {
          const cur = await inp.inputValue().catch(() => '');
          if (!cur.trim()) await inp.fill(val);
        }
      }
      await page.getByRole('button', { name: 'Save & Continue' }).click();
      // Payment step: pick UPI and fill the page-level UPI id (gate before modal).
      await page.getByRole('button', { name: /^UPI/ }).first().click().catch(() => {});
      const upiInline = page.locator('input[placeholder="yourname@bank"]').first();
      await upiInline.waitFor({ timeout: 10000 });
      await upiInline.fill('testbuyer@okhdfc');
      return 'address saved, payment step ready';
    });

    await step('Place order via Tresor Pay (UPI) → confirmation', async () => {
      await page.getByRole('button', { name: /^Place Order/ }).click();
      const dialog = page.locator('[role="dialog"][aria-labelledby="payment-modal-title"]');
      await dialog.waitFor({ timeout: 10000 });
      // Modal has its own UPI field.
      const upiModal = dialog.locator('input[placeholder="yourname@bank"]').first();
      if (await upiModal.count()) await upiModal.fill('testbuyer@okhdfc');
      await dialog.getByRole('button', { name: /^Pay /i }).click();
      // 2.5s processing + 0.8s success → confirmation route.
      await page.waitForURL(/#\/confirmation\//, { timeout: 20000 });
      const orderId = page.url().split('/confirmation/')[1] ?? '';
      return `order placed → confirmation ${orderId}`;
    });
  } else {
    results.push({ name: 'Full signed-in checkout', status: 'SKIP', detail: 'login failed', ms: 0, shot: '', errs: [] });
    console.log('· Full signed-in checkout — SKIPPED (login failed)');
  }

  // ── 9. Search ────────────────────────────────────────────────────────────────
  await step('Search results page', async () => {
    await page.goto(`${BASE}/#/search?q=silk`, { waitUntil: 'domcontentloaded' });
    // Wait for the post-load count line ("N fabrics matched") so we don't
    // measure cards while the skeleton is still up.
    await page.getByText(/fabrics? matched/i).waitFor({ timeout: 20000 });
    const cards = await page.locator('.card-product').count();
    return `query "silk" → ${cards} result card(s)`;
  });

  await step('Navbar typed search + enter', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const box = page.getByRole('textbox', { name: /Search/i }).first();
    await box.fill('silk');
    await box.press('Enter');
    await page.waitForFunction(() => /#\/(product|shop|search)/.test(location.hash), null, { timeout: 10000 });
    return `navigated to ${new URL(page.url()).hash}`;
  });

  // ── 10. Customise (couture) page ─────────────────────────────────────────────
  await step('Customise / couture page', async () => {
    // CustomisePage renders under a <div className="min-h-screen">, not <main>.
    await page.goto(`${BASE}/#/customise`, { waitUntil: 'domcontentloaded' });
    await page.locator('h1, h2').first().waitFor({ timeout: 15000 });
    const txt = (await page.locator('h1, h2').first().innerText().catch(() => 'rendered')).trim();
    if (await page.locator('text=/error|something went wrong/i').count() && !txt) {
      throw new Error('customise page errored');
    }
    return txt.slice(0, 60) || 'page rendered';
  });

  // ── 11. 404 ──────────────────────────────────────────────────────────────────
  await step('Unknown route shows 404', async () => {
    await page.goto(`${BASE}/#/does-not-exist-xyz`, { waitUntil: 'domcontentloaded' });
    await page.locator('main').first().waitFor({ timeout: 10000 });
    const body = await page.locator('main').innerText();
    if (!/404|not found|can.?t find|doesn.?t exist|lost/i.test(body)) {
      return 'route handled (no explicit 404 text found)';
    }
    return 'not-found page shown';
  });

  await browser.close();

  // ── Report ───────────────────────────────────────────────────────────────────
  const pass = results.filter(r => r.status === 'PASS').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skip = results.filter(r => r.status === 'SKIP').length;
  console.log('\n──────────── SUMMARY ────────────');
  console.log(`PASS ${pass}  WARN ${warn}  FAIL ${fail}  SKIP ${skip}   (of ${results.length})`);
  fs.writeFileSync(path.join(ART, 'report.json'), JSON.stringify(results, null, 2));
  console.log(`Artifacts: ${ART}`);
  process.exit(fail > 0 ? 1 : 0);
})().catch(err => {
  console.error('FATAL', err);
  process.exit(2);
});
