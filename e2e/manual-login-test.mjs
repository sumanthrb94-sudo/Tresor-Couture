// Manual-login → authenticated E2E.
// You log in by hand in the visible browser; the script detects the session
// and drives the signed-in flows (cart sync, account, admin authz boundary).
//
//   BASE_URL=https://tresorcouture.in node e2e/manual-login-test.mjs
//
// Non-destructive: browses + adds to the bag; never completes a payment.
import { chromium, expect } from '@playwright/test';

const BASE = (process.env.BASE_URL || 'https://tresorcouture.in').replace(/\/$/, '');
const SIGNED_IN = 'button[aria-label="Profile"]';
const SIGNED_OUT = 'button[aria-label="Sign in or sign up"]';
const BAG = 'button[aria-label="Bag"]';

/** Numeric bag badge count (0 when no badge is shown). Robust to an account
 *  that already has a synced cart. */
async function bagCount(page) {
  const txt = (await page.locator(BAG).textContent().catch(() => '')) || '';
  const m = txt.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

let pass = 0, fail = 0;
const log = (m) => console.log(m);
async function check(name, fn) {
  try { await fn(); log(`  ok    ${name}`); pass++; }
  catch (e) { log(`  FAIL  ${name} — ${String(e.message).split('\n')[0]}`); fail++; }
}
const settle = async (page) => { await page.waitForLoadState('networkidle').catch(() => {}); };
const goHash = async (page, h) => { await page.goto(`${BASE}/${h}`, { waitUntil: 'domcontentloaded' }); await settle(page); };

async function openFirstProduct(page) {
  await goHash(page, '#/shop');
  const card = page.locator('.card-product').first();
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.getByRole('button').first().click();
  await expect(page.locator('#pdp-add-to-bag')).toBeVisible({ timeout: 15000 });
}

// Low-memory launch flags — this box is RAM-tight and headed Chromium was
// getting OOM-killed ("Target crashed"). These trim GPU/extension/background use.
const browser = await chromium.launch({
  headless: false,
  slowMo: 200,
  args: [
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-renderer-backgrounding',
    '--js-flags=--max-old-space-size=512',
  ],
});
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1320, height: 860 } });
const page = await ctx.newPage();

try {
  await goHash(page, '#/login');

  const EMAIL = process.env.E2E_EMAIL;
  const PASSWORD = process.env.E2E_PASSWORD;
  let signedIn = false;

  // Optional: drive the app's own email/password form (NOT Google OAuth, which
  // Google blocks in automated browsers). Creds come from env, never the file.
  if (EMAIL && PASSWORD) {
    log('Attempting email/password sign-in with the provided account…');
    try {
      await page.getByPlaceholder('you@example.com').first().fill(EMAIL);
      await page.getByPlaceholder(/your password/i).fill(PASSWORD);
      await page.getByRole('button', { name: /^login$/i }).click();
      await page.locator(SIGNED_IN).first().waitFor({ state: 'visible', timeout: 25000 });
      signedIn = true;
      log('✅  Signed in via email/password.\n');
    } catch {
      const alertTxt = (await page.getByRole('alert').textContent().catch(() => '')) || '';
      log(`⚠️  Auto email/password sign-in did not complete${alertTxt ? ` — app said: "${alertTxt.trim()}"` : ''}.`);
      log('   This account may be Google-only, or the password differs. Falling back to MANUAL login.\n');
    }
  }

  if (!signedIn) {
    log('────────────────────────────────────────────────────────');
    log('👉  PLEASE LOG IN in the browser window.');
    log('    Tip: use PHONE OTP or the EMAIL tab — Google sign-in is often');
    log('    blocked inside this automated test browser.');
    log('    Waiting up to 5 minutes…');
    log('────────────────────────────────────────────────────────\n');
    await page.locator(SIGNED_IN).first().waitFor({ state: 'visible', timeout: 300000 });
  }
  log('✅  Sign-in detected. Running authenticated tests…\n');

  // Who is signed in + admin? (best-effort, informational)
  await goHash(page, '#/account');
  const accountText = (await page.locator('body').innerText().catch(() => '')) || '';
  const emailMatch = accountText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch) log(`    signed in as: ${emailMatch[0]}`);

  // Baseline: this account may already have a synced cart.
  let beforeCount = 0;
  await check('read starting bag count (handles a pre-existing synced cart)', async () => {
    await goHash(page, '#/');
    beforeCount = await bagCount(page);
    log(`    starting bag count: ${beforeCount}`);
  });

  // 1) Signed-in add-to-cart → bag grows (or stays, if the item was already in it).
  await check('add a product while signed in → bag is non-empty', async () => {
    await openFirstProduct(page);
    await page.locator('#pdp-add-to-bag').click();
    await expect.poll(() => bagCount(page), { timeout: 12000 }).toBeGreaterThanOrEqual(Math.max(1, beforeCount));
    log(`    bag count after add: ${await bagCount(page)}`);
  });

  // 2) Cart page renders an item.
  await check('cart page renders an item (₹ price)', async () => {
    await goHash(page, '#/cart');
    await expect(page.getByText(/₹\s?[\d,]/).first()).toBeVisible({ timeout: 15000 });
  });

  // 3) Cart survives a reload (signed-in → Firestore-backed).
  await check('bag persists across a full reload (≥1 item)', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await expect.poll(() => bagCount(page), { timeout: 12000 }).toBeGreaterThan(0);
  });

  // 4) Clear the localStorage mirror, reload → item returns from Firestore
  //    (proves real cross-device sync, not just local cache).
  await check('bag rehydrates from Firestore after clearing localStorage', async () => {
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await expect.poll(() => bagCount(page), { timeout: 15000 }).toBeGreaterThan(0);
  });

  // 5) Account page shows the signed-in user's own area.
  await check('account page loads the signed-in dashboard', async () => {
    await goHash(page, '#/account');
    await expect(page.locator(SIGNED_IN).first()).toBeVisible({ timeout: 12000 });
    await expect(page.getByText(/orders|address|account|profile|sign out/i).first()).toBeVisible({ timeout: 15000 });
  });

  // 6) Authorization boundary: hitting #/admin as a customer must NOT expose
  //    the admin console (AdminGuard redirects). If you logged in as the CEO,
  //    it will legitimately show the dashboard — reported either way.
  await check('admin route is gated (no admin console for a customer)', async () => {
    await goHash(page, '#/admin');
    await page.waitForTimeout(3500);
    const url = page.url();
    const body = (await page.locator('body').innerText().catch(() => '')) || '';
    const looksAdmin = /inventory|coupons|orders dashboard|billing|compliance|CEO/i.test(body) && /#\/admin/.test(url);
    if (looksAdmin) {
      log('    ℹ️  admin console rendered → this account HAS the admin claim (expected for the CEO).');
    } else {
      log(`    ✅ customer bounced from /admin → ended at ${url.replace(BASE, '')}`);
      expect(url).not.toMatch(/#\/admin($|\?)/);
    }
  });

  log(`\n────────────────────────────────────────────────────────`);
  log(`RESULT: ${pass} passed, ${fail} failed.`);
  log(`────────────────────────────────────────────────────────`);
} catch (err) {
  log(`\n✗ Run aborted: ${String(err.message).split('\n')[0]}`);
  if (/Timeout.*waitFor/i.test(String(err.message))) log('  (No sign-in detected within 5 minutes.)');
} finally {
  try { await page.waitForTimeout(1500); } catch { /* page may already be closed */ }
  await browser.close().catch(() => {});
  log('\nBrowser closed.');
}
