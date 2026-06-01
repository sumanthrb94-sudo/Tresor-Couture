import { test, expect } from '@playwright/test';
import { egressBlocked } from './_helpers';

/**
 * Serverless API contract tests — the fastest way to confirm env vars actually
 * took effect in the deployed functions.
 *
 * Non-destructive: the contact call uses a clearly-tagged e2e test email; the
 * payments call uses a nonexistent product so nothing is ever charged.
 *
 * Behaviour is asserted as a CONTRACT, not a fixed value, because the same code
 * runs configured (keys set) and unconfigured. Each test prints the
 * deployment's actual state so the run doubles as a config check.
 */

test.beforeEach(async ({ request, baseURL }) => {
  test.skip(await egressBlocked(request, baseURL), 'Egress proxy blocks this host (run from an open-network environment).');
});

test.describe('POST /api/contact (Brevo capture)', () => {
  test('accepts a valid email and reports Brevo state', async ({ request }) => {
    const res = await request.post('/api/contact', {
      data: { email: `e2e+contact-${Date.now()}@example.com`, source: 'e2e' },
    });
    expect(res.status(), 'endpoint should exist (404 ⇒ /api not deployed)').toBe(200);
    const body = await res.json();
    if (body.ok === true) {
      console.log('✅ /api/contact LIVE — BREVO_API_KEY is wired; contact upserted.');
    } else {
      console.log('ℹ️ /api/contact reachable but Brevo upsert did not succeed (key not set or rejected).');
    }
    // Contract: 200 with a boolean `ok`.
    expect(typeof body.ok).toBe('boolean');
  });

  test('rejects a request with neither a valid email nor a phone', async ({ request }) => {
    const res = await request.post('/api/contact', { data: { source: 'e2e' } });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe('invalid_contact');
  });
});

test.describe('POST /api/payments/create-order (Razorpay)', () => {
  test('reports configured-vs-demo state without charging', async ({ request }) => {
    const res = await request.post('/api/payments/create-order', {
      data: { items: [{ fabricId: '__e2e_nonexistent__', quantity: 1 }] },
    });
    const status = res.status();
    if (status === 503) {
      console.log('ℹ️ Payments in DEMO mode (Razorpay/Firebase Admin not configured).');
      expect((await res.json()).error).toBe('payments_not_configured');
    } else {
      // Configured: it got far enough to price the cart and rejected the fake product.
      console.log(`✅ Payments wired — server priced the cart (HTTP ${status}).`);
      expect([400, 409, 422, 500]).toContain(status);
    }
  });
});

test.describe('POST /api/payments/verify (anti-tamper)', () => {
  test('rejects a missing/invalid signature', async ({ request }) => {
    const res = await request.post('/api/payments/verify', {
      data: { order: { items: [{ fabricId: 'x', quantity: 1 }] } },
    });
    // 503 when unconfigured; 400 missing_payment_fields when configured.
    expect([400, 503]).toContain(res.status());
  });
});
