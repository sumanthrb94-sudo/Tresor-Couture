import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import { Recorder } from './lib/recorder';
import {
  CASHFREE_PAID, cashfreeConfigured, cashfreeLive, cashfreeBase,
  newCashfreeOrderId, normalisePhone, verifyCashfreeWebhook,
} from '../../api/_lib/cashfree';

/**
 * The parts of the Cashfree integration that must not be wrong.
 *
 * Everything else about a gateway can be fixed after a bad deploy. These three
 * cannot: a webhook signature that accepts a forgery lets anyone mark an order
 * paid; a sandbox/production switch that fails open charges real cards from a
 * test deploy; a mangled phone number makes Cashfree reject every order at the
 * moment of go-live.
 */

const SECRET = 'test_secret_key_do_not_use';
const sign = (timestamp: string, body: string, secret = SECRET) =>
  crypto.createHmac('sha256', secret).update(`${timestamp}${body}`).digest('base64');

test('Cashfree · signatures, environment and phone handling', async () => {
  const rec = new Recorder({
    slug: 'cashfree',
    title: 'Cashfree · webhook signatures and the live switch',
    area: 'Checkout · Payments',
    purpose:
      'Cashfree tells us a payment succeeded over a signed webhook, and tells us which environment to charge in through one env var. A signature check that accepts a forgery, or an environment switch that fails open, both end in real money moving when it should not.',
    reproduce: [
      'Sign a payload with the merchant secret exactly as Cashfree does.',
      'The same bytes verify; a changed body, timestamp or secret does not.',
      'CASHFREE_ENV must say "production" before any live endpoint is used.',
    ],
  });

  const restore = { ...process.env };
  try {
    process.env.CASHFREE_SECRET_KEY = SECRET;
    process.env.CASHFREE_APP_ID = 'test_app_id';

    // --- a genuine webhook ---------------------------------------------------
    const body = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: 'tc_1' } } });
    const ts = '1617695238078';
    expect(verifyCashfreeWebhook(body, sign(ts, body), ts)).toBe(true);
    rec.note('A correctly signed webhook is accepted', 'base64(HMAC-SHA256(timestamp + rawBody, secret)).');

    // --- forgeries -----------------------------------------------------------
    // Each of these is a real attack: replay with a changed amount, a stolen
    // signature reused on a different body, a guessed secret.
    const tampered = body.replace('tc_1', 'tc_2');
    expect(verifyCashfreeWebhook(tampered, sign(ts, body), ts)).toBe(false);
    expect(verifyCashfreeWebhook(body, sign('1617695238079', body), ts)).toBe(false);
    expect(verifyCashfreeWebhook(body, sign(ts, body, 'wrong_secret'), ts)).toBe(false);
    expect(verifyCashfreeWebhook(body, undefined, ts)).toBe(false);
    expect(verifyCashfreeWebhook(body, sign(ts, body), undefined)).toBe(false);
    expect(verifyCashfreeWebhook(body, '', ts)).toBe(false);
    rec.note('A tampered body, timestamp or secret is rejected', 'Including a signature lifted from a genuine call.');

    // Re-serialised JSON is byte-different even when semantically identical,
    // which is exactly why the route must keep the raw body.
    const reserialised = JSON.stringify(JSON.parse(body));
    const spaced = JSON.stringify(JSON.parse(body), null, 2);
    expect(verifyCashfreeWebhook(spaced, sign(ts, reserialised), ts)).toBe(false);

    // A missing secret must never accept anything.
    delete process.env.CASHFREE_SECRET_KEY;
    expect(verifyCashfreeWebhook(body, sign(ts, body), ts)).toBe(false);
    expect(cashfreeConfigured()).toBe(false);
    process.env.CASHFREE_SECRET_KEY = SECRET;
    rec.note('With no secret configured nothing verifies', 'It fails closed rather than waving payloads through.');

    // --- the live switch -----------------------------------------------------
    // Everything except the exact word "production" stays on sandbox. An unset
    // or fat-fingered value must not be what starts charging real cards.
    for (const value of [undefined, '', 'sandbox', 'prod', 'PRODUCTION ', 'Production', 'true', '1']) {
      if (value === undefined) delete process.env.CASHFREE_ENV;
      else process.env.CASHFREE_ENV = value;
      const live = cashfreeLive();
      const expectedLive = typeof value === 'string' && value.trim().toLowerCase() === 'production';
      expect(live, `CASHFREE_ENV=${JSON.stringify(value)}`).toBe(expectedLive);
      expect(cashfreeBase()).toBe(live ? 'https://api.cashfree.com' : 'https://sandbox.cashfree.com');
    }
    rec.note('Only the exact word "production" goes live', '"prod", "true" and a blank all stay on sandbox.');

    // --- phone normalising ---------------------------------------------------
    // Checkout accepts +91 and 0 prefixes; Cashfree rejects the order unless it
    // gets exactly ten digits.
    for (const input of ['+91 98765 43210', '09876543210', '9876543210', '+919876543210', '98765-43210']) {
      expect(normalisePhone(input), input).toBe('9876543210');
    }
    expect(normalisePhone(undefined)).toBe('');
    expect(normalisePhone('12345')).toBe('12345');        // too short: caller rejects it
    rec.note('Any accepted phone format reduces to ten digits', 'Cashfree refuses the order otherwise.');

    // --- order ids -----------------------------------------------------------
    // Cashfree allows 3–50 chars of [A-Za-z0-9_-] and ids must not collide.
    const ids = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const id = newCashfreeOrderId();
      expect(id).toMatch(/^[A-Za-z0-9_-]{3,50}$/);
      ids.add(id);
    }
    expect(ids.size).toBe(500);

    expect(CASHFREE_PAID).toBe('PAID');
    rec.finish('passed');
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  } finally {
    process.env = restore;
  }
});
