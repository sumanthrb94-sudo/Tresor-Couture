import { test, expect } from '@playwright/test';
import { Recorder } from './lib/recorder';
import { computeBreakdown } from '../../api/_lib/pricing';
import posSale from '../../api/pos/sale';
import type { ApiRequest, ApiResponse } from '../../api/_lib/http';
import type { Order } from '../../src/types';

/**
 * The counter: pricing, stock, identity and idempotency.
 *
 * These drive the real `/api/pos/sale` handler against the real emulator, by
 * calling it with plain request/response objects. Vercel functions are
 * ordinary async functions; there is no server to stand up, and testing the
 * handler is testing the thing that actually runs.
 *
 * The security negatives here matter more than the happy path. A counter
 * endpoint that a signed-in customer could reach would let anyone move stock
 * and mint paid orders, so "customer gets 403" is the single most important
 * assertion in this file.
 */

const EMU = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const AUTH_EMU = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const PASSWORD = 'Test1234!';
const CSRF = 'test-csrf-token';

process.env.FIRESTORE_EMULATOR_HOST = EMU;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_EMU;
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-tresor';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'demo-tresor';

/* ── Test doubles for the serverless request/response pair ──────────────── */

interface Captured { status: number; body: Record<string, unknown> }

function makeRes(): { res: ApiResponse; out: Captured } {
  const out: Captured = { status: 0, body: {} };
  const res: ApiResponse = {
    status(code) { out.status = code; return res; },
    json(data) { out.body = (data ?? {}) as Record<string, unknown>; return res; },
    send(data) { out.body = (data ?? {}) as Record<string, unknown>; return res; },
    setHeader() { /* headers are not under test here */ },
    end() { /* no-op */ },
  };
  return { res, out };
}

/** The CSRF check is double-submit: the cookie and the header must agree. */
function makeReq(over: Partial<ApiRequest> & { token?: string; body?: unknown } = {}): ApiRequest {
  const { token, ...rest } = over;
  return {
    method: 'POST',
    query: {},
    headers: {
      'content-type': 'application/json',
      // An allowlisted Origin is the outermost guard — without it every request
      // is 403 before identity is even looked at, which is the point.
      origin: 'https://tresorcouture.in',
      cookie: `tresor_csrf=${CSRF}`,
      'x-csrf-token': CSRF,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(rest.headers ?? {}),
    },
    body: rest.body,
    ...(rest.method !== undefined ? { method: rest.method } : {}),
  } as ApiRequest;
}

async function call(req: ApiRequest): Promise<Captured> {
  const { res, out } = makeRes();
  await (posSale as unknown as (q: ApiRequest, s: ApiResponse) => Promise<void>)(req, res);
  return out;
}

/** Sign in through the Auth emulator's REST API to get a real ID token. */
async function idTokenFor(email: string): Promise<string> {
  const url = `http://${AUTH_EMU}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  const data = (await r.json()) as { idToken?: string; error?: { message?: string } };
  if (!data.idToken) throw new Error(`emulator sign-in failed for ${email}: ${data.error?.message ?? r.status}`);
  return data.idToken;
}

/* ── A fake Firestore, for the arithmetic that must not drift ───────────── */

const fakeDb = (price: number) => ({
  collection: () => ({
    doc: () => ({
      get: async () => ({ exists: true, data: () => ({ price, stock: 10 }) }),
    }),
  }),
});

test('Counter pricing · in-store zeroes carriage without disturbing the web basket', async () => {
  const rec = new Recorder({
    slug: 'pos-pricing-channel',
    title: 'Counter pricing · the channel parameter',
    area: 'API · Pricing',
    purpose:
      'A counter sale carries nothing and collects nothing on delivery, so shipping and the COD surcharge are zero. This must be a parameter of the one pricing function, not an adjustment a handler makes afterwards — and adding it must leave every existing web total byte-identical.',
    reproduce: [
      'Call computeBreakdown with no `channel` and note shipping / codSurcharge / total / amountMinor.',
      'Call it again with channel: "in-store": shipping and codSurcharge are 0 and total drops by exactly that much.',
      'The web figures are unchanged in both directions.',
    ],
  });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = fakeDb(500) as any;
    const items = [{ fabricId: 'p', quantity: 2 }];   // ₹1000 — under the free-shipping threshold

    // --- The tripwire: no channel must behave exactly as it always did ------
    const web = await computeBreakdown(db, { items, paymentMethod: 'cod' });
    expect(web.shipping).toBe(99);
    expect(web.codSurcharge).toBe(50);
    expect(web.total).toBe(1000 + 99 + 50);
    expect(web.amountMinor).toBe(web.total * 100);

    const webExplicit = await computeBreakdown(db, { items, paymentMethod: 'cod', channel: 'web' });
    expect(webExplicit).toEqual(web);
    rec.note('Web checkout untouched', 'Omitting `channel` and passing "web" produce identical breakdowns.');

    // --- In-store ----------------------------------------------------------
    const store = await computeBreakdown(db, { items, channel: 'in-store' });
    expect(store.shipping).toBe(0);
    expect(store.codSurcharge).toBe(0);
    expect(store.total).toBe(1000);
    // The invariant that makes this safe to change in one place.
    expect(store.total).toBe(store.taxable + store.shipping + store.codSurcharge);
    expect(store.amountMinor).toBe(store.total * 100);

    // Even if a caller passed 'cod' by mistake, in-store wins — there is no
    // delivery to collect on.
    const storeCod = await computeBreakdown(db, { items, paymentMethod: 'cod', channel: 'in-store' });
    expect(storeCod.codSurcharge).toBe(0);
    expect(storeCod.total).toBe(1000);
    rec.note('No carriage at the counter', 'Shipping and COD are zero, and the total invariant still holds.');

    // Tax stays a component of the inclusive price, never added on top.
    expect(store.tax).toBe(Math.round((1000 * 0.05) / 1.05));
    expect(store.subtotal).toBe(1000);
    rec.note('GST still inclusive', 'The counter prices the same way the website does.');

    rec.finish('passed');
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});

test('Counter sale · only an admin may ring one up', async () => {
  const rec = new Recorder({
    slug: 'pos-sale-security',
    title: 'Counter sale · who may ring up a sale',
    area: 'API · Counter',
    purpose:
      'The counter endpoint creates paid orders and moves stock, so every request that is not a genuine admin POST with a matching CSRF token must be refused before anything is priced.',
    reproduce: [
      'POST /api/pos/sale with no Authorization header → 401.',
      'POST with a signed-in CUSTOMER token → 403 (the most important one).',
      'GET → 405. Missing or mismatched CSRF header → 403.',
      'A body with no saleKey → 400: without it a retry becomes a second charge.',
    ],
  });

  try {
    const customerToken = await idTokenFor('customer@test.local');
    const adminToken = await idTokenFor('admin@test.local');
    const sale = { items: [{ fabricId: 'e2e-draft', quantity: 1 }], paymentMethod: 'cash', saleKey: 'never-used' };

    // Outermost guard: a request from anywhere but our own origin never gets
    // as far as identity.
    const foreign = makeReq({ token: adminToken, body: { sale } });
    foreign.headers.origin = 'https://evil.example';
    const fromForeignOrigin = await call(foreign);
    expect(fromForeignOrigin.status).toBe(403);
    expect(fromForeignOrigin.body.error).toBe('origin_not_allowed');
    rec.note('Foreign origin refused', 'Even with a valid admin token, a request from another site is rejected first.');

    expect((await call(makeReq({ body: { sale } }))).status).toBe(401);
    rec.note('Anonymous refused', 'No token, no sale.');

    const asCustomer = await call(makeReq({ token: customerToken, body: { sale } }));
    expect(asCustomer.status).toBe(403);
    expect(asCustomer.body.error).toBe('forbidden');
    rec.note('Signed-in customer refused', 'A customer account cannot move stock or mint a paid order.');

    expect((await call(makeReq({ token: adminToken, method: 'GET', body: { sale } }))).status).toBe(405);

    const noCsrf = makeReq({ token: adminToken, body: { sale } });
    delete noCsrf.headers['x-csrf-token'];
    expect((await call(noCsrf)).status).toBe(403);

    const wrongCsrf = makeReq({ token: adminToken, body: { sale } });
    wrongCsrf.headers['x-csrf-token'] = 'a-different-token';
    expect((await call(wrongCsrf)).status).toBe(403);
    rec.note('CSRF enforced', 'The cookie and the header must agree, so a cross-site form cannot ring up a sale.');

    const noKey = await call(makeReq({ token: adminToken, body: { sale: { ...sale, saleKey: '' } } }));
    expect(noKey.status).toBe(400);
    expect(noKey.body.error).toBe('sale_key_required');

    const badPayment = await call(makeReq({ token: adminToken, body: { sale: { ...sale, paymentMethod: 'cod' } } }));
    expect(badPayment.status).toBe(400);
    // COD is meaningless at a counter — the piece is handed over as it is paid for.
    expect(badPayment.body.error).toBe('invalid_payment_method');
    rec.note('Ticket integrity', 'A sale without an idempotency key, or paid by a method the counter cannot take, is refused.');

    rec.finish('passed');
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});

test('Counter sale · stock, invoice and idempotency', async () => {
  const rec = new Recorder({
    slug: 'pos-sale-workflow',
    title: 'Counter sale · one ticket, one order, one unit',
    area: 'API · Counter',
    purpose:
      'A completed counter sale must reduce stock by exactly what was sold, record a delivered and paid in-store order that belongs to no customer account, price the GST as CGST+SGST, and — submitted twice with the same ticket key — produce exactly one order.',
    reproduce: [
      'Sign in as an admin and open Admin → Counter.',
      'Scan a label; the piece joins the ticket with its catalogue price.',
      'Complete the sale: the tax invoice appears and stock has dropped by one.',
      'Submit the same ticket again (double-tap, or a flaky connection): the same invoice reprints and no second order exists.',
    ],
  });

  // Imported lazily so the module picks up the emulator env set at the top.
  const { initAdmin } = await import('../../scripts/lib/admin');
  const { db } = initAdmin([]);

  try {
    const adminToken = await idTokenFor('admin@test.local');
    const productId = 'e2e-draft';   // a Draft: sellable at the counter, invisible online

    const before = (await db.collection('products').doc(productId).get()).data() as { stock: number; price: number };
    const saleKey = `spec-${Date.now()}`;
    const body = {
      sale: {
        items: [{ fabricId: productId, quantity: 1 }],
        paymentMethod: 'cash',
        saleKey,
        customer: { name: 'Walk-in Customer', phone: '9999999999' },
        // Fields a tampered client might smuggle in. Every one must be ignored:
        // the server sets identity, money and settlement state itself.
        userId: 'attacker-uid',
        total: 1,
        paymentStatus: 'pending',
      },
    };

    const first = await call(makeReq({ token: adminToken, body }));
    expect(first.status).toBe(200);
    const orderId = String(first.body.orderId);
    expect(orderId).toBeTruthy();
    expect(first.body.alreadyProcessed).toBe(false);

    // --- Stock moved by exactly one -----------------------------------------
    const after = (await db.collection('products').doc(productId).get()).data() as { stock: number };
    expect(after.stock).toBe(before.stock - 1);
    rec.note('Stock reduced by exactly one', 'The same number the website decrements — one figure for the shelf, whichever channel sold it.');

    // --- The order the counter wrote ----------------------------------------
    const stored = (await db.collection('orders').doc(orderId).get()).data() as Record<string, unknown>;
    expect(stored.channel).toBe('in-store');
    expect(stored.status).toBe('delivered');
    expect(stored.paymentStatus).toBe('paid');
    expect(stored.paymentMethod).toBe('cash');
    // The most damaging plausible mistake: writing the operator's uid would put
    // every walk-in sale in that admin's order history and make it returnable
    // by their account.
    expect(stored.userId).toBeUndefined();
    expect(stored.counterStaffUid).toBeTruthy();
    expect(stored.total).toBe(before.price);          // the smuggled total: 1 was ignored
    expect(stored.shipping).toBe(0);
    rec.note('Belongs to no account', 'A counter sale records who rang it up, never whose order it is.');

    // --- Place of supply, and therefore the tax split ------------------------
    const address = stored.shippingAddress as Record<string, string>;
    expect(address.state).toBe('Telangana');
    const { gstBreakdown } = await import('../../src/lib/invoice');
    const gst = gstBreakdown({ ...stored, id: orderId } as unknown as Order);
    expect(gst.isInterState).toBe(false);
    expect(gst.cgst + gst.sgst).toBe(stored.tax);
    expect(gst.igst).toBe(0);
    rec.note('CGST + SGST, not IGST', 'Goods handed over at the seller\'s premises are supplied there, so the sale is intra-state — and that follows from where the studio is, not from anything the operator typed.');

    // --- The same ticket, submitted again ------------------------------------
    const second = await call(makeReq({ token: adminToken, body }));
    expect(second.status).toBe(200);
    expect(second.body.alreadyProcessed).toBe(true);
    expect(second.body.orderId).toBe(orderId);

    const afterRetry = (await db.collection('products').doc(productId).get()).data() as { stock: number };
    expect(afterRetry.stock).toBe(before.stock - 1);   // unchanged: no second decrement

    const all = await db.collection('orders').where('channel', '==', 'in-store').get();
    const forThisTicket = all.docs.filter(d => d.id === orderId);
    expect(forThisTicket).toHaveLength(1);
    rec.note('Double-submit reprints, never re-charges', 'The ticket key is the whole defence: one UUID per ticket, held across retries.');

    // --- Refusing what is not on the shelf ------------------------------------
    const wanted = before.stock + 40;   // plausible at a counter, but not on the shelf
    const tooMany = await call(makeReq({
      token: adminToken,
      body: { sale: { items: [{ fabricId: productId, quantity: wanted }], paymentMethod: 'cash', saleKey: `${saleKey}-over` } },
    }));
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.fabricId).toBe(productId);
    expect(tooMany.body.requested).toBe(wanted);
    expect(tooMany.body.available).toBe(before.stock - 1);
    rec.note('Out of stock is answered, not just refused', 'The operator is told what is actually on the shelf, so the ticket can be fixed at the counter.');

    // A quantity nobody types at a till is rejected as malformed rather than
    // reaching pricing and stock at all.
    const absurd = await call(makeReq({
      token: adminToken,
      body: { sale: { items: [{ fabricId: productId, quantity: 9999 }], paymentMethod: 'cash', saleKey: `${saleKey}-absurd` } },
    }));
    expect(absurd.status).toBe(400);
    expect(absurd.body.error).toBe('invalid_line');

    // Nothing moved on either refusal.
    const afterRefusals = (await db.collection('products').doc(productId).get()).data() as { stock: number };
    expect(afterRefusals.stock).toBe(before.stock - 1);

    rec.finish('passed');
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});
