// Mobile / phone-OTP login flow (real SMS via Firebase phone auth).
// Runs HEADED so the invisible reCAPTCHA is likely to auto-pass; if Google
// shows an image challenge, solve it in the opened window.
//
// Handshake: the script sends the SMS, then waits for the 6-digit code to
// appear in e2e/otp.txt (written by the operator once the SMS arrives).
//
//   node e2e/phone-otp.mjs            # uses default number below
//   PHONE=7799934943 node e2e/phone-otp.mjs

import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3002';
const PHONE = (process.env.PHONE ?? '7799934943').replace(/[^\d]/g, '');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OTP_FILE = path.join(__dirname, 'otp.txt');
const ART = path.join(__dirname, 'artifacts-phone');
fs.rmSync(OTP_FILE, { force: true });
fs.rmSync(ART, { recursive: true, force: true });
fs.mkdirSync(ART, { recursive: true });

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
let page;
async function snap(n) { try { await page.screenshot({ path: path.join(ART, `${n}.png`) }); } catch {} }

async function waitForOtp(timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (fs.existsSync(OTP_FILE)) {
      const code = fs.readFileSync(OTP_FILE, 'utf8').replace(/[^\d]/g, '').slice(0, 6);
      if (code.length === 6) return code;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  return null;
}

(async () => {
  // HEADED=1 → visible window (invisible reCAPTCHA passes far more reliably).
  // --single-process destabilises a headed browser, so only use the heavy
  // low-memory flags in headless mode.
  const headed = process.env.HEADED === '1';
  const args = ['--disable-blink-features=AutomationControlled', '--disable-gpu', '--disable-dev-shm-usage'];
  if (!headed) args.push('--single-process', '--no-zygote', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=256');
  const browser = await chromium.launch({ headless: !headed, args });
  page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('pageerror', e => log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') log('[console]', m.text()); });

  log(`Phone login for +91 ${PHONE}`);
  await page.goto(`${BASE}/#/login`, { waitUntil: 'domcontentloaded' });

  // Switch to the Phone sign-in tab.
  await page.getByRole('tab', { name: 'Phone' }).click();
  await page.locator('#otp-phone').waitFor({ timeout: 10000 });
  await page.locator('#otp-phone').fill(PHONE);
  await snap('1-phone-entered');

  log('Clicking "Send code" (invisible reCAPTCHA runs now)…');
  await page.getByRole('button', { name: 'Send code' }).click();

  // Outcome A: OTP step appears (#otp-code). Outcome B: an error alert.
  const outcome = await Promise.race([
    page.locator('#otp-code').waitFor({ timeout: 120000 }).then(() => 'otp').catch(() => null),
    page.getByRole('alert').first().waitFor({ timeout: 120000 }).then(() => 'alert').catch(() => null),
  ]);
  await snap('2-after-send');

  if (outcome === 'alert') {
    const txt = await page.getByRole('alert').first().innerText().catch(() => '');
    log('SEND FAILED ✗ —', txt.trim());
    log('Leaving the window open 20s for inspection…');
    await new Promise(r => setTimeout(r, 20000));
    await browser.close();
    process.exit(1);
  }
  if (outcome !== 'otp') {
    log('No OTP field and no error within 120s — reCAPTCHA may be waiting for a manual challenge in the window.');
    // Give the operator time to solve a challenge, then re-check.
    const late = await page.locator('#otp-code').waitFor({ timeout: 120000 }).then(() => 'otp').catch(() => null);
    if (late !== 'otp') { log('Still no OTP step — aborting.'); await browser.close(); process.exit(1); }
  }

  log(`CODE_SENT ✓ — SMS dispatched to +91 ${PHONE}. Waiting for OTP in ${OTP_FILE} (write the 6 digits there).`);
  const code = await waitForOtp(8 * 60 * 1000);
  if (!code) { log('Timed out waiting for OTP.'); await browser.close(); process.exit(1); }

  log(`Got OTP ${code} — submitting…`);
  await page.locator('#otp-code').fill(code);
  await page.getByRole('button', { name: /Verify/i }).click();

  const verified = await Promise.race([
    page.waitForURL(u => !/#\/login/.test(u.href), { timeout: 30000 }).then(() => 'ok').catch(() => null),
    page.getByRole('alert').first().waitFor({ timeout: 30000 }).then(() => 'alert').catch(() => null),
  ]);
  await snap('3-after-verify');

  if (verified === 'ok') {
    log(`VERIFIED ✓ — signed in, redirected to ${new URL(page.url()).hash || '/'}`);
    await snap('4-signed-in');
    await browser.close();
    process.exit(0);
  } else {
    const txt = await page.getByRole('alert').first().innerText().catch(() => '');
    log('VERIFY FAILED ✗ —', txt.trim());
    await browser.close();
    process.exit(1);
  }
})().catch(e => { log('FATAL', e?.message ?? e); process.exit(2); });
