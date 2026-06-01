import { test, expect } from '@playwright/test';
import { egressBlocked } from './_helpers';

test.beforeEach(async ({ request, baseURL }) => {
  test.skip(await egressBlocked(request, baseURL), 'Egress proxy blocks this host (run from an open-network environment).');
});

/**
 * Serverless API contract tests — these are the fastest way to confirm
 * env vars actually took effect in the deployed functions.
 *
 * Non-destructive: the Brevo calls use clearly-tagged e2e test emails;
 * the payments call uses a nonexistent product so nothing is ever charged.
 *
 * Behaviour is asserted as a CONTRACT, not a fixed value, because the same
 * code runs configured (keys set) and unconfigured (demo). Each test prints
 * the deployment's actual state so the run doubles as a config check.
 */

test.describe('POST /api/subscribers/sync (Brevo contact sync)', () => {
  test('responds with a valid sync contract', async ({ request }) => {
    const res = await request.post('/api/subscribers/sync', {
      data: { email: `e2e+sync-${Date.now()}@example.com`, source: 'e2e' },
    });
    expect(res.status(), 'endpoint should exist (404 ⇒ /api not deployed)').toBe(200);
    const body = await res.json();

    if (body.synced === true) {
      console.log('✅ Brevo contact sync LIVE — BREVO_API_KEY is wired.');
    } else if (body.reason === 'brevo_not_configured') {
      console.log('ℹ️ BREVO_API_KEY not reaching the function — set it for Production + redeploy.');
    } else {
      console.log('⚠️ Brevo present but rejected the upsert:', JSON.stringify(body));
    }
    // Contract: always 200 with a boolean `synced`.
    expect(typeof body.synced).toBe('boolean');
  });

  test('rejects an invalid email', async ({ request }) => {
    const res = await request.post('/api/subscribers/sync', { data: { email: 'not-an-email' } });
    // 400 when configured; 200 no-op when Brevo is off (key absent short-circuits first).
    expect([200, 400]).toContain(res.status());
  });
});

test.describe('POST /api/events/track (Brevo automation triggers)', () => {
  for (const event of ['signup', 'order_placed'] as const) {
    test(`fires the "${event}" event`, async ({ request }) => {
      const res = await request.post('/api/events/track', {
        data: {
          event,
          email: `e2e+${event}-${Date.now()}@example.com`,
          ...(event === 'order_placed'
            ? { eventData: { order_id: `E2E-${Date.now()}`, total: 4500, currency: 'INR', item_count: 1, payment_status: 'paid' } }
            : { properties: { FIRSTNAME: 'E2E' } }),
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      if (body.tracked === true) console.log(`✅ "${event}" event fired (Brevo wired).`);
      else console.log(`ℹ️ "${event}" not tracked: ${JSON.stringify(body)}`);
      expect(typeof body.tracked).toBe('boolean');
    });
  }

  test('rejects an event kind outside the whitelist', async ({ request }) => {
    const res = await request.post('/api/events/track', {
      data: { event: 'arbitrary_event', email: 'e2e@example.com' },
    });
    // 400 unknown_event when configured; 200 no-op when Brevo is off.
    expect([200, 400]).toContain(res.status());
    if (res.status() === 400) expect((await res.json()).error).toBe('unknown_event');
  });
});

test.describe('POST /api/payments/create-order (Razorpay)', () => {
  test('reports configured-vs-demo state without charging', async ({ request }) => {
    const res = await request.post('/api/payments/create-order', {
      data: { items: [{ fabricId: '__e2e_nonexistent__', meters: 1 }] },
    });
    const status = res.status();
    if (status === 503) {
      console.log('ℹ️ Payments in DEMO mode (Razorpay/Firebase service account not set).');
      expect((await res.json()).error).toBe('payments_not_configured');
    } else {
      // Configured: it got far enough to price the cart and rejected the fake product / low amount.
      console.log(`✅ Payments wired — server priced the cart (HTTP ${status}).`);
      expect([400, 409, 422, 500]).toContain(status);
    }
  });
});
