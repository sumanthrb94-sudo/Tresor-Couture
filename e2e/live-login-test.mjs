// Headed live test of tresorcouture.in with phone-OTP login.
// reCAPTCHA works on the real registered domain (unlike localhost).
// Handshake: script sends SMS, then waits for the 6 digits in e2e/otp.txt.
//
//   node e2e/live-login-test.mjs

import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const BASE = process.env.SITE ?? 'https://tresorcouture.in';
const PHONE = (process.env.PHONE ?? '7799934943').replace(/[^\d]/g, '');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OTP_FILE = path.join(__dirname, 'otp.txt');
const OUT = path.join(__dirname, 'live-auth');
fs.rmSync(OTP_FILE, { force: true });
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
let page;
const snap = async n => { try { await page.screenshot({ path: path.join(OUT, `${n}.png`), fullPage: true }); } catch {} };

async function waitForOtp(ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fs.existsSync(OTP_FILE)) {
      const c = fs.readFileSync(OTP_FILE, 'utf8').replace(/[^\d]/g, '').slice(0, 6);
      if (c.length === 6) return c;
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  return null;
}

(async () => {
  // Headed, no --single-process (destabilises a visible browser).
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('pageerror', e => log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') log('[console]', m.text()); });

  log(`Live login for +91 ${PHONE} on ${BASE}`);
  await page.goto(`${BASE}/#/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.getByRole('tab', { name: 'Phone' }).click();
  await page.locator('#otp-phone').waitFor({ timeout: 15000 });
  await page.locator('#otp-phone').fill(PHONE);
  await snap('1-phone');

  log('Clicking "Send code"…');
  await page.getByRole('button', { name: 'Send code' }).click();

  const outcome = await Promise.race([
    page.locator('#otp-code').waitFor({ timeout: 120000 }).then(() => 'otp').catch(() => null),
    page.getByRole('alert').first().waitFor({ timeout: 120000 }).then(() => 'alert').catch(() => null),
  ]);
  await snap('2-after-send');
  if (outcome === 'alert') {
    log('SEND FAILED ✗ —', (await page.getByRole('alert').first().innerText().catch(() => '')).trim());
    await new Promise(r => setTimeout(r, 15000)); await browser.close(); process.exit(1);
  }
  if (outcome !== 'otp') { log('No OTP step within 120s — solve any reCAPTCHA challenge in the window.'); const late = await page.locator('#otp-code').waitFor({ timeout: 180000 }).then(() => 'otp').catch(() => null); if (late !== 'otp') { log('Aborting.'); await browser.close(); process.exit(1); } }

  log(`CODE_SENT ✓ — SMS sent to +91 ${PHONE}. Write the 6 digits to ${OTP_FILE}`);
  const code = await waitForOtp(10 * 60 * 1000);
  if (!code) { log('Timed out waiting for OTP.'); await browser.close(); process.exit(1); }
  log(`Got OTP ${code} — verifying…`);
  await page.locator('#otp-code').fill(code);
  await page.getByRole('button', { name: /Verify/i }).click();

  const ok = await Promise.race([
    page.waitForURL(u => !/#\/login/.test(u.href), { timeout: 30000 }).then(() => true).catch(() => false),
    page.getByRole('alert').first().waitFor({ timeout: 30000 }).then(() => false).catch(() => false),
  ]);
  await snap('3-after-verify');
  if (!ok) { log('VERIFY FAILED ✗ —', (await page.getByRole('alert').first().innerText().catch(() => '')).trim()); await browser.close(); process.exit(1); }
  log('VERIFIED ✓ — signed in.');

  // Tour the logged-in surfaces and capture them.
  const pages = [
    ['home', ''],
    ['account-profile', '#/account/profile'],
    ['account-orders', '#/account/orders'],
    ['account-wishlist', '#/account/wishlist'],
    ['account-addresses', '#/account/addresses'],
  ];
  for (const [name, route] of pages) {
    try {
      await page.goto(`${BASE}/${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
      await snap(`logged-${name}`);
      log(`captured ${name}`);
    } catch (e) { log(`✗ ${name} — ${e.message.split('\n')[0]}`); }
  }

  log('DONE. Closing in 20s (window stays up briefly for inspection).');
  await new Promise(r => setTimeout(r, 20000));
  await browser.close();
  process.exit(0);
})().catch(e => { log('FATAL', e?.message ?? e); process.exit(2); });
