import { test, expect } from '@playwright/test';
import { Recorder } from './lib/recorder';
import { CashfreeStub } from './lib/cashfree-stub';
import type { ApiRequest, ApiResponse } from '../../api/_lib/http';

/**
 * `/api/payments/verify` — the one place that decides a payment happened.
 *
 * The existing Cashfree spec proves the crypto: signatures verify, forgeries
 * do not, the live switch fails closed. What it cannot reach is the HANDLER,
 * and the handler is where the money decision is actually made. Three things
 * have to hold there, and none of them can be checked against the real sandbox
 * because the real sandbox will not tell you what you need it to tell you:
 *
 *   1. AN UNPAID ORDER IS NOT AN ORDER. The browser calls verify when the modal
 *      closes — including when the shopper closed it without paying. If the
 *      handler believed the caller, every abandoned checkout would ship goods.
 *   2. PAID FOR THE WRONG AMOUNT IS NOT PAID. The cart is re-priced from
 *      Firestore and compared against what Cashfree is actually holding. A
 *      shopper who paid ₹1 for a ₹9,000 order must be refused.
 *   3. PAYING ONCE BUYS ONE. Verify runs from the browser and the webhook runs
 *      from Cashfree, and both can land for the same payment. The second must
 *      return the first order rather than write a second and decrement stock
 *      twice.
 *
 * The handlers are called directly rather than over HTTP: the stub has to be in
 * front of them before they load, and their contract is a plain (req, res)
 * function, so this exercises exactly the code Vercel runs.
 */

const EMU_FIRESTORE = '127.0.0.1:8080';
const EMU_AUTH = '127.0.0.1:9099';
const CSRF = 'test-csrf-token';

/** Capture what a handler responded, in the shape Vercel gives it. */
function capture(): { res: ApiResponse; out: { code: number; body: unknown } } {
  const out = { code: 200, body: undefined as unknown };
  const res = {
    status(c: number) {
      out.code = c;
      return res;
    },
    json(data: unknown) {
      out.body = data;
      return res;
    },
    send(data: unknown) {
      out.body = data;
      return res;
    },
    setHeader() {},
    end(data?: unknown) {
      if (data !== undefined) out.body = data;
    },
  } as unknown as ApiResponse;
  return { res, out };
}

function request(body: unknown, token: string): ApiRequest {
  return {
    method: 'POST',
    headers: {
      origin: 'http://127.0.0.1:4173',
      cookie: `tresor_csrf=${CSRF}`,
      'x-csrf-token': CSRF,
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    query: {},
    body,
  };
}

async function customerToken(): Promise<string> {
  const res = await fetch(
    `http://${EMU_AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'customer@test.local',
        password: 'Test1234!',
        returnSecureToken: true,
      }),
    },
  );
  const body = (await res.json()) as { idToken?: string };
  if (!body.idToken) throw new Error('could not sign in against the auth emulator');
  return body.idToken;
}

async function productStock(id: string): Promise<number> {
  const res = await fetch(
    `http://${EMU_FIRESTORE}/v1/projects/demo-tresor/databases/(default)/documents/products/${id}`,
    { headers: { Authorization: 'Bearer owner' } },
  );
  const body = (await res.json()) as { fields?: { stock?: { integerValue?: string } } };
  return Number(body.fields?.stock?.integerValue ?? 0);
}

test('Cashfree · verify believes the processor, not the browser', async () => {
  test.setTimeout(180_000);

  const rec = new Recorder({
    slug: 'cashfree-verify',
    title: 'Cashfree · what counts as paid',
    area: 'Checkout · Payments',
    purpose:
      'The browser calls /api/payments/verify when the Cashfree modal closes — whether or not anyone paid. The handler therefore asks Cashfree directly and writes an order only for a real payment of the right amount, exactly once. This drives that handler against a stand-in Cashfree that can be made to report an unpaid order, a short payment, or a repeat.',
    reproduce: [
      'Start the emulators and seed with `npm run seed:emulator:full`.',
      'Run `npx playwright test --config=playwright.emulator.config.ts tests/emulator/cashfree-verify.spec.ts`.',
      'The stub reports ACTIVE → verify returns 409 payment_not_completed and writes nothing.',
      'The stub reports PAID for ₹1 → verify returns 409 amount_mismatch and writes nothing.',
      'The stub reports PAID for the right amount → an order is written and stock falls once.',
      'Calling verify again with the same Cashfree order id returns the SAME order id and stock does not move.',
    ],
  });

  const stub = new CashfreeStub();
  const restore = { ...process.env };

  try {
    const base = await stub.start();

    // Point the SANDBOX base at the stub. cashfreeBase() ignores this whenever
    // CASHFREE_ENV is "production", so this seam cannot exist on a live deploy.
    process.env.CASHFREE_API_BASE = base;
    process.env.CASHFREE_ENV = 'sandbox';
    process.env.CASHFREE_APP_ID = 'test_app_id';
    process.env.CASHFREE_SECRET_KEY = 'test_secret_key_do_not_use';
    process.env.FIRESTORE_EMULATOR_HOST = EMU_FIRESTORE;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = EMU_AUTH;
    process.env.GCLOUD_PROJECT = 'demo-tresor';
    process.env.FIREBASE_PROJECT_ID = 'demo-tresor';
    process.env.ALLOWED_ORIGIN = 'http://127.0.0.1:4173';

    const { default: verify } = await import('../../api/payments/verify.js');
    const token = await customerToken();

    const PRODUCT = '1';
    const QTY = 2;
    const order = {
      items: [{ fabricId: PRODUCT, quantity: QTY }],
      paymentMethod: 'upi' as const,
      shippingAddress: { fullName: 'Test Customer', phone: '9876543210', city: 'Hyderabad' },
    };

    const stockBefore = await productStock(PRODUCT);
    rec.note(`Stock before any of this: ${stockBefore}`);

    // ── 1. Not paid ────────────────────────────────────────────────────────
    // The shopper opened the modal and closed it. The page calls verify all the
    // same, because the page cannot tell the difference.
    const unpaidId = 'tc_stub_unpaid';
    stub.set(unpaidId, { order_status: 'ACTIVE', order_amount: 9050 });
    {
      const { res, out } = capture();
      await verify(request({ cashfree_order_id: unpaidId, order }, token), res);
      expect(out.code).toBe(409);
      expect((out.body as { error?: string }).error).toBe('payment_not_completed');
    }
    expect(await productStock(PRODUCT)).toBe(stockBefore);
    rec.note(
      'An ACTIVE (unpaid) order is refused',
      'Returns 409 payment_not_completed, writes no order and moves no stock — an abandoned checkout costs nothing.',
    );

    // ── 2. Paid, but not enough ────────────────────────────────────────────
    // The dangerous case: Cashfree genuinely says PAID, so a handler that
    // stopped at the status check would ship the goods for ₹1.
    const shortId = 'tc_stub_short';
    stub.set(shortId, { order_status: 'PAID', order_amount: 1 });
    {
      const { res, out } = capture();
      await verify(request({ cashfree_order_id: shortId, order }, token), res);
      expect(out.code).toBe(409);
      expect((out.body as { error?: string }).error).toBe('amount_mismatch');
    }
    expect(await productStock(PRODUCT)).toBe(stockBefore);
    rec.note(
      'PAID for the wrong amount is refused',
      'Cashfree said PAID and it was still rejected: the amount is re-derived from Firestore and compared with what Cashfree actually holds.',
    );

    // ── 3. Actually paid ───────────────────────────────────────────────────
    // Ask the pricing engine what this cart really costs rather than restating
    // a number here, or the test would only prove the stub agrees with itself.
    const { getDb } = await import('../../api/_lib/firebaseAdmin.js');
    const { computeBreakdown } = await import('../../api/_lib/pricing.js');
    const truth = await computeBreakdown(getDb(), { items: order.items, paymentMethod: 'upi' });

    const paidId = 'tc_stub_paid_' + Date.now().toString(36);
    stub.set(paidId, { order_status: 'PAID', order_amount: truth.total });
    let orderId = '';
    {
      const { res, out } = capture();
      await verify(request({ cashfree_order_id: paidId, order }, token), res);
      expect(out.code).toBe(200);
      orderId = String((out.body as { orderId?: string }).orderId ?? '');
      expect(orderId).toBeTruthy();
    }
    const stockAfter = await productStock(PRODUCT);
    expect(stockAfter).toBe(stockBefore - QTY);
    rec.note(
      `A real payment of ₹${truth.total} writes the order and takes ${QTY} off the shelf`,
      `Stock ${stockBefore} → ${stockAfter}, in the same transaction that wrote the order.`,
    );

    // ── 4. Paying once buys one ────────────────────────────────────────────
    // Verify and the webhook both land for a single payment. The second must
    // find the first rather than sell the same piece twice.
    {
      const { res, out } = capture();
      await verify(request({ cashfree_order_id: paidId, order }, token), res);
      expect(out.code).toBe(200);
      const body = out.body as { orderId?: string; alreadyProcessed?: boolean };
      expect(body.orderId).toBe(orderId);
      expect(body.alreadyProcessed).toBe(true);
    }
    expect(await productStock(PRODUCT)).toBe(stockAfter);
    rec.note(
      'A repeat verify returns the same order and moves no stock',
      'Keyed on the Cashfree order id. Without this the webhook arriving after a normal return from the modal would double-decrement every paid order.',
    );

    // The handler asked Cashfree about every order id it was given, and never
    // took the caller's word for any of them.
    const asked = stub.calls.filter((c) => c.method === 'GET').map((c) => c.path);
    expect(asked).toContain(`/pg/orders/${unpaidId}`);
    expect(asked).toContain(`/pg/orders/${shortId}`);
    expect(asked).toContain(`/pg/orders/${paidId}`);
    rec.note(
      'Every decision was preceded by asking Cashfree',
      'Three order ids in, three server-to-server status lookups out. There is no client-side success token to forge because there is no client-side success token.',
    );

    rec.finish('passed');
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  } finally {
    await stub.stop();
    process.env = restore;
  }
});
