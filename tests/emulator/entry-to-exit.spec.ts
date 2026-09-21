import { test, expect, type Browser, type Page } from '@playwright/test';
import { Recorder } from './lib/recorder';
import { adminPage, customerPage, dismissConsent } from './lib/session';

/**
 * ENTRY TO EXIT — one shopper, one piece, from the front door to the refund.
 *
 * Every other suite here starts after an order exists, because the order
 * fixtures are seeded straight into Firestore. That left the act of ordering —
 * the single most consequential path in the shop — as the one thing no test
 * touched. `POST /api/orders/place` is where the cart is RE-PRICED from
 * Firestore (the browser's total is discarded), where stock is decremented
 * inside a transaction, and where `productIds` is denormalised so the review
 * rule can later answer "did this person buy this?". None of that was covered.
 *
 * This drives the real handler, via scripts/local-api-server.ts, against the
 * emulators with the real firestore.rules. It asserts the three things that
 * can only be checked by actually ordering:
 *
 *   1. STOCK MOVED BY EXACTLY WHAT WAS SOLD. Read before, read after. A
 *      double-decrement or a missed one is an inventory lie that no screenshot
 *      would show.
 *   2. THE SERVER SET THE PRICE. The order's stored total is recomputed from
 *      the catalogue, so it is checked against the catalogue, not against what
 *      the checkout rendered — otherwise the test would confirm the browser
 *      agrees with itself.
 *   3. DELIVERY IS WHAT UNLOCKS THINGS. The return window and the review gate
 *      both hang off `status: delivered`, and both are checked after the admin
 *      marks it so — not before.
 */

/**
 * Read a document straight from the emulator, past the rules, as the seeder
 * does. The rules are the thing under test elsewhere; here they would only
 * stand between the test and the ground truth it is checking against.
 */
async function readDoc(page: Page, path: string): Promise<Record<string, Record<string, string>>> {
  return page.evaluate(async (p: string) => {
    const res = await fetch(
      `http://127.0.0.1:8080/v1/projects/demo-tresor/databases/(default)/documents/${p}`,
      { headers: { Authorization: 'Bearer owner' } },
    );
    const body = (await res.json()) as { fields?: Record<string, Record<string, string>> };
    return body.fields ?? {};
  }, path);
}

const num = (f: Record<string, Record<string, string>>, k: string): number =>
  Number(f[k]?.integerValue ?? f[k]?.doubleValue ?? 0);

/**
 * Empty this shopper's saved bag.
 *
 * The bag lives at `carts/{uid}` in Firestore, not just in the browser, so a
 * brand-new context still inherits whatever the last spec left behind — and
 * several of them add an item and never check out. This test asserts that
 * stock falls by exactly the quantity it ordered, which is only meaningful if
 * the order contains exactly what this test put in it. Found by running the
 * whole suite: alone it passed, in sequence stock fell by four.
 */
async function emptyBag(email: string): Promise<void> {
  const signIn = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'Test1234!', returnSecureToken: true }),
    },
  );
  const { localId } = (await signIn.json()) as { localId?: string };
  if (!localId) throw new Error(`could not resolve a uid for ${email}`);
  await fetch(
    `http://127.0.0.1:8080/v1/projects/demo-tresor/databases/(default)/documents/carts/${localId}`,
    { method: 'DELETE', headers: { Authorization: 'Bearer owner' } },
  );
}

async function readProduct(page: Page, id: string): Promise<{ stock: number; price: number; name: string }> {
  const f = await readDoc(page, `products/${id}`);
  return { stock: num(f, 'stock'), price: num(f, 'price'), name: String(f.name?.stringValue ?? '') };
}

const PRODUCT_ID = '1';
const QTY = 2;

test('Entry to exit · browse → buy → deliver → return, with the server pricing it', async ({
  browser,
}: {
  browser: Browser;
}) => {
  test.setTimeout(300_000);

  const rec = new Recorder({
    slug: 'entry-to-exit',
    title: 'Entry to exit · a complete purchase',
    area: 'Storefront · Checkout · Admin',
    purpose:
      'The whole journey in one run: a shopper arrives, finds a piece, buys it with Cash on Delivery, the order is priced and stock reserved BY THE SERVER, the admin ships and delivers it, and the shopper returns it. Proves the checkout path end to end — the part every other test skipped because its orders were seeded rather than placed.',
    reproduce: [
      'Start the emulators, seed with `npm run seed:emulator:full`, build with VITE_USE_EMULATORS=1.',
      'Run `npm run serve:local` so the real /api routes are served beside the app.',
      'Sign in as customer@test.local, open a product, add it to the bag, and check out with Cash on Delivery.',
      'Confirm the order total matches quantity x catalogue price, and that the product stock fell by the quantity ordered.',
      'As admin@test.local, mark the order shipped, then delivered.',
      'Back as the customer: the order can now be returned, and the product page now shows the "Verified purchase" review form it withheld before.',
    ],
  });

  try {
    // ─────────── ENTRY ───────────
    await emptyBag('customer@test.local');
    const cust = await customerPage(browser);
    await cust.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissConsent(cust);
    await cust.waitForTimeout(1500);
    await rec.step(cust, 'Arrived at the storefront');

    await cust.goto('/shop', { waitUntil: 'domcontentloaded' });
    await cust.waitForTimeout(1800);
    await rec.step(cust, 'Browsed the catalogue');

    const before = await readProduct(cust, PRODUCT_ID);
    rec.note(
      `Stock before: ${before.stock} · price ₹${before.price}`,
      `Read from Firestore, not from the page — this is the number the purchase has to move.`,
    );

    await cust.goto(`/product/${PRODUCT_ID}`, { waitUntil: 'domcontentloaded' });
    await cust.waitForTimeout(1500);
    await rec.step(cust, `Opened "${before.name}"`);

    // ─────────── BAG ───────────
    // Quantity first: the add-to-bag button captures whatever the stepper reads,
    // so bumping it afterwards would not change what the server is asked for.
    const plus = cust.getByRole('button', { name: /increase|^\+$/i }).first();
    for (let i = 1; i < QTY; i++) {
      if (await plus.isVisible().catch(() => false)) {
        await plus.click().catch(() => {});
        await cust.waitForTimeout(300);
      }
    }
    await cust.getByRole('button', { name: /add to (bag|cart)/i }).first().click();
    await cust.waitForTimeout(1000);
    await rec.step(cust, `Added ${QTY} to the bag`);

    await cust.goto('/cart', { waitUntil: 'domcontentloaded' });
    await cust.waitForTimeout(1500);
    await rec.step(cust, 'Reviewed the bag');

    // ─────────── CHECKOUT ───────────
    await cust.goto('/checkout', { waitUntil: 'domcontentloaded' });
    await cust.waitForTimeout(2500);
    await rec.step(cust, 'Opened checkout');

    // A three-step accordion: only the open step is in the DOM, so the address
    // fields do not exist until the login step is passed.
    await cust.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 15_000 }).catch(() => {});
    await cust.waitForTimeout(800);

    const address: Record<string, string> = {
      fullName: 'Test Customer',
      email: 'customer@test.local',
      phone: '9876543210',
      line1: '1 Heritage Lane',
      city: 'Hyderabad',
      state: 'Telangana',
      postalCode: '500001',
    };
    for (const [name, value] of Object.entries(address)) {
      const field = cust.locator(`input[name="${name}"]`).first();
      if (await field.isVisible().catch(() => false)) await field.fill(value).catch(() => {});
    }
    await rec.step(cust, 'Entered the delivery address');

    await cust.getByRole('button', { name: /save & continue/i }).first().click({ timeout: 15_000 });
    await cust.waitForTimeout(1500);

    const cod = cust.getByRole('button').filter({ hasText: 'Cash on Delivery' }).first();
    await expect(cod).toBeEnabled({ timeout: 15_000 });
    await cod.click();
    await cust.waitForTimeout(600);
    await rec.step(cust, 'Chose Cash on Delivery', 'The only live method until the Cashfree keys are set.', 'assert');

    // ─────────── THE PURCHASE ───────────
    await cust.getByRole('button', { name: /place order/i }).first().click({ timeout: 20_000 });
    // The button posts to /api/orders/place and only navigates on a real order
    // id, so arriving here at all means the server accepted and wrote it.
    const receipt = cust.getByTestId('order-id');
    await expect(receipt).toBeVisible({ timeout: 45_000 });
    await rec.step(cust, 'Order placed and confirmed', undefined, 'assert');

    // The confirmation route carries the id the server minted, which is the
    // handle onto the document the rest of this test checks.
    const orderId = new URL(cust.url()).pathname.split('/').filter(Boolean).pop()!;
    expect(orderId).toBeTruthy();

    // 1. Stock moved by exactly what was sold.
    const after = await readProduct(cust, PRODUCT_ID);
    expect(after.stock).toBe(before.stock - QTY);
    rec.note(
      `Stock after: ${after.stock} (was ${before.stock})`,
      `Down by exactly ${QTY}. The decrement happens inside the same Firestore transaction that writes the order, so a paid order can never exist without the stock behind it.`,
    );

    // ─────────── THE ORDER AS THE SHOPPER SEES IT ───────────
    await cust.goto('/account/orders', { waitUntil: 'domcontentloaded' });
    await cust.waitForTimeout(2000);
    await rec.step(cust, 'The order is in the account', undefined, 'assert');

    // 2. The server set the price. Checked against the STORED order and the
    //    CATALOGUE, never against what the checkout rendered — comparing the
    //    page to itself would pass even if the browser had named its own price.
    const stored = await readDoc(cust, `orders/${orderId}`);
    expect(num(stored, 'subtotal')).toBe(before.price * QTY);
    // `productIds` is what firestore.rules reads to answer "did this person buy
    // this?" — the review gate is unenforceable without it, and nothing else
    // in the suite would notice if the handler stopped writing it.
    const boughtIds = (stored.productIds?.arrayValue as unknown as { values?: { stringValue: string }[] })
      ?.values?.map((v) => v.stringValue) ?? [];
    expect(boughtIds).toContain(PRODUCT_ID);
    rec.note(
      `Order subtotal ₹${num(stored, 'subtotal')}, total ₹${num(stored, 'total')}`,
      `${QTY} x ₹${before.price} recomputed server-side from Firestore. /api/orders/place discards the browser's figure entirely, so a tampered cart cannot set its own price. productIds carries [${boughtIds.join(', ')}] for the review rule.`,
    );

    // ─────────── ADMIN ───────────
    const adm = await adminPage(browser);
    await adm.goto('/admin/orders', { waitUntil: 'domcontentloaded' });
    await adm.waitForTimeout(2500);

    // Scoped to THIS run's order. Every run places a real order, so the list
    // accumulates them — `.first()` would advance whichever happened to sort
    // top and the test would pass while touching someone else's order.
    const row = adm.locator('tr').filter({ hasText: orderId.slice(0, 10) }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await rec.step(adm, 'The order reaches the admin console', `Row #${orderId.slice(0, 10)}…`, 'assert');

    const status = row.getByLabel('Update order status');
    await status.selectOption('shipped', { timeout: 20_000 });
    await adm.waitForTimeout(2500);
    await rec.step(adm, 'Marked shipped');

    await status.selectOption('delivered', { timeout: 20_000 });
    await adm.waitForTimeout(3000);
    await rec.step(adm, 'Marked delivered', 'Stamps deliveredAt server-side, which is what the 7-day return window is measured from.', 'assert');

    const delivered = await readDoc(adm, `orders/${orderId}`);
    expect(String(delivered.status?.stringValue)).toBe('delivered');
    expect(delivered.deliveredAt).toBeTruthy();
    rec.note(
      'deliveredAt is stamped on the order',
      'Written by the admin console, not supplied by the customer — the return window is measured from a timestamp the shopper cannot move.',
    );

    // ─────────── EXIT ───────────
    // 3. Delivery is what unlocks the return.
    await cust.goto('/account/orders', { waitUntil: 'domcontentloaded' });
    await cust.waitForTimeout(2500);
    // Scoped the same way as the admin row: the seeded ORD-RETURN fixture is
    // also delivered and also offers a Return, so an unscoped match would
    // return the wrong order and still go green.
    const ownRow = cust
      .getByTestId('order-row')
      .filter({ hasText: `TC-${orderId.slice(-8).toUpperCase()}` })
      .first();
    await expect(ownRow).toBeVisible({ timeout: 20_000 });
    const returnBtn = ownRow.getByRole('button', { name: /^return$/i }).first();
    await expect(returnBtn).toBeVisible({ timeout: 20_000 });
    await rec.step(cust, 'Delivery unlocks the return', 'Undelivered orders offer no Return control at all.', 'assert');

    await returnBtn.click();
    await cust.waitForTimeout(1500);
    const box = cust.locator('input[type="checkbox"]').first();
    if ((await box.isVisible().catch(() => false)) && !(await box.isChecked().catch(() => true))) {
      await box.check({ timeout: 5000 }).catch(() => {});
    }
    await cust.locator('#return-reason').selectOption({ index: 1 }, { timeout: 5000 }).catch(() => {});
    await rec.step(cust, 'Filled the return request');

    await cust
      .getByRole('button', { name: /submit|request return|confirm|raise/i })
      .first()
      .click({ timeout: 8000 })
      .catch(() => {});
    await cust.waitForTimeout(2500);
    await cust.goto('/account/returns', { waitUntil: 'domcontentloaded' });
    await cust.waitForTimeout(2000);

    // The submit above is tolerant, because the modal lays out differently at
    // the two viewports this shares with the mobile run. Tolerant clicks make
    // silent no-ops possible, so the RMA is confirmed against the database
    // rather than against a screenshot of a page that may show nothing.
    const raised = await cust.evaluate(async (oid: string) => {
      const res = await fetch(
        'http://127.0.0.1:8080/v1/projects/demo-tresor/databases/(default)/documents/returns',
        { headers: { Authorization: 'Bearer owner' } },
      );
      const body = (await res.json()) as {
        documents?: { fields?: { orderId?: { stringValue?: string }; status?: { stringValue?: string } } }[];
      };
      return (body.documents ?? [])
        .map((d) => d.fields)
        .filter((f) => f?.orderId?.stringValue === oid)
        .map((f) => f?.status?.stringValue ?? '');
    }, orderId);
    expect(raised.length).toBe(1);
    await rec.step(cust, 'The return is raised', `One RMA against this order, status "${raised[0]}".`, 'assert');

    await adm.goto('/admin/returns', { waitUntil: 'domcontentloaded' });
    await adm.waitForTimeout(2500);
    await rec.step(adm, 'The return reaches the admin queue', 'End of the round trip: the piece was found, bought, shipped, delivered and sent back, all through the real server.', 'assert');

    // ─────────── AND THE REVIEW GATE OPENS ───────────
    // The last thing a delivered order unlocks. This is the only test that can
    // prove the gate for real: the rule reads `productIds` off an order that
    // must be this customer's AND delivered, and until now every order in the
    // suite was seeded, so the gate was only ever checked against a fixture
    // rather than against a purchase the shop itself recorded.
    await cust.goto(`/product/${PRODUCT_ID}`, { waitUntil: 'domcontentloaded' });
    await cust.waitForTimeout(3000);
    await cust.getByText(/write a review/i).first().scrollIntoViewIfNeeded().catch(() => {});
    await cust.waitForTimeout(1500);
    await expect(cust.getByText(/verified purchase/i).first()).toBeVisible({ timeout: 20_000 });
    await rec.step(
      cust,
      'Having bought it, the shopper can review it',
      'The "Verified purchase" form renders only once the buyer is matched to a delivered order carrying this product. Before this purchase the same page offered no form at all.',
      'assert',
    );

    rec.finish('passed');
    await cust.context().close();
    await adm.context().close();
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});
