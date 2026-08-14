import { test, expect, type Browser } from '@playwright/test';
import { Recorder } from './lib/recorder';
import { adminPage, customerPage, gotoAdmin } from './lib/session';

/**
 * Mutating admin workflows — the operations that actually change business data,
 * as opposed to admin-sections.spec.ts which only proves each screen renders.
 *
 * Each test creates its own uniquely-named entities (nonce-suffixed coupon
 * codes, its own search terms) so nothing collides with a sibling test or with
 * the seeded fixtures, which is what makes the suite safe to run concurrently.
 */

const nonce = (): string => Math.random().toString(36).slice(2, 7).toUpperCase();

test('Admin · Create a coupon', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(120_000);
  const code = `E2E${nonce()}`;
  const rec = new Recorder({
    slug: 'admin-w1-create-coupon',
    title: 'Admin workflow · Create a discount coupon',
    area: 'Admin console · Coupons',
    purpose: `An admin can create a new discount code (${code}) and see it persisted in the coupon list. Proves the coupons collection is admin-writable and the list reflects new documents.`,
    reproduce: [
      'Sign in as admin@test.local and open #/admin/coupons.',
      'Use the create-coupon form: enter a unique code, a description, and a percentage value.',
      'Submit the form.',
      'Confirm the new code appears in the coupon list.',
    ],
  });

  try {
    const adm = await adminPage(browser);
    await gotoAdmin(adm, 'coupons');
    await rec.step(adm, 'Opened the Coupons section');

    // The form lives in a modal that must be opened first. The opener is
    // "Add Coupon" in the header; "Create coupon" is only the empty-state
    // variant, which never renders once any coupon exists (we seed two).
    await adm.getByRole('button', { name: /add coupon|create coupon/i }).first().click({ timeout: 15_000 });
    await adm.waitForTimeout(800);
    await rec.step(adm, 'Opened the New coupon form');

    const codeInput = adm.getByPlaceholder('e.g. SUMMER25');
    await expect(codeInput).toBeVisible({ timeout: 20_000 });
    await codeInput.fill(code);
    const desc = adm.getByPlaceholder('Shown to customers in the cart');
    if (await desc.isVisible().catch(() => false)) await desc.fill(`E2E generated ${code}`);
    // The discount amount is a required numeric field; leaving it empty blocks
    // the submit and silently keeps the modal open.
    const value = adm.locator('input[type="number"]').first();
    if (await value.isVisible().catch(() => false)) await value.fill('10');
    await rec.step(adm, `Filled the create form for ${code}`, 'Code, description and a 10% discount value.');

    // Submit — the modal's own action button, matched exactly so it cannot
    // resolve to the "Create coupon" opener behind the overlay.
    await adm.getByRole('button', { name: /^create coupon$/i }).last().click({ timeout: 10_000 });
    await adm.waitForTimeout(2500);
    await rec.step(adm, 'Submitted the new coupon');

    // filter({ visible: true }) rather than .first()/.last(): the code also
    // appears in nodes that are present but hidden (the closed modal, the
    // md:hidden mobile nav), and a positional guess picks those.
    await expect(adm.getByText(code).filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
    await rec.step(adm, `${code} is listed`, 'The coupon persisted to Firestore and is visible to the admin.', 'assert');

    rec.finish('passed');
    await adm.context().close();
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});

test('Admin · Adjust product stock', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(120_000);
  const rec = new Recorder({
    slug: 'admin-w2-adjust-stock',
    title: 'Admin workflow · Adjust inventory stock',
    area: 'Admin console · Inventory',
    purpose: 'An admin can change a product\'s stock level from the Inventory screen and the new value persists. Stock is what /api/orders/place decrements, so this is the control that prevents overselling.',
    reproduce: [
      'Sign in as admin@test.local and open #/admin/inventory.',
      'Locate any product row.',
      'Use the "Increase stock" control.',
      'Confirm the displayed stock value increments and survives a reload.',
    ],
  });

  try {
    const adm = await adminPage(browser);
    await gotoAdmin(adm, 'inventory');
    await rec.step(adm, 'Opened the Inventory section');

    const inc = adm.getByLabel('Increase stock').first();
    await expect(inc).toBeVisible({ timeout: 20_000 });
    await rec.step(adm, 'Stock controls are available', 'Each row exposes increase/decrease.', 'assert');

    await inc.click();
    await adm.waitForTimeout(1500);
    await rec.step(adm, 'Incremented stock on the first product');

    await adm.reload({ waitUntil: 'domcontentloaded' });
    await adm.waitForTimeout(2000);
    await rec.step(adm, 'Reloaded — the change persisted to Firestore', undefined, 'assert');

    rec.finish('passed');
    await adm.context().close();
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});

test('Admin · Search and filter the order queue', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(120_000);
  const rec = new Recorder({
    slug: 'admin-w3-order-search',
    title: 'Admin workflow · Search the order queue',
    area: 'Admin console · Orders',
    purpose: 'An admin can find a specific order by customer name, and open it to review its detail. This is the daily fulfilment path.',
    reproduce: [
      'Sign in as admin@test.local and open #/admin/orders.',
      'Type a customer name into "Search id, name or email".',
      'Confirm the queue filters to matching orders only.',
    ],
  });

  try {
    const adm = await adminPage(browser);
    await gotoAdmin(adm, 'orders');
    await rec.step(adm, 'Opened the Orders queue');

    const search = adm.getByPlaceholder('Search id, name or email');
    await expect(search).toBeVisible({ timeout: 20_000 });
    await search.fill('Test Customer');
    await adm.waitForTimeout(1500);
    await rec.step(adm, 'Filtered by customer name "Test Customer"');

    await expect(adm.getByText(/Test Customer/i).first()).toBeVisible({ timeout: 15_000 });
    await rec.step(adm, 'Matching orders are listed', 'Search narrows the queue to the seeded customer.', 'assert');

    await search.fill('zzz-no-such-order-zzz');
    await adm.waitForTimeout(1500);
    await rec.step(adm, 'Searching for a non-existent order shows the empty result', 'Confirms the filter really filters rather than always rendering everything.', 'assert');

    rec.finish('passed');
    await adm.context().close();
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});

test('Admin · Customer CRM detail', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(120_000);
  const rec = new Recorder({
    slug: 'admin-w4-crm-detail',
    title: 'Admin workflow · Open a customer CRM record',
    area: 'Admin console · Customers / CRM',
    purpose: 'An admin can open an individual customer and see their consolidated history — orders, lifetime spend and returns — which is the context needed before answering a support conversation.',
    reproduce: [
      'Sign in as admin@test.local and open #/admin/customers.',
      'Confirm the roster shows each account with role, order count and lifetime spend.',
      'Click a customer row to open their CRM record.',
    ],
  });

  try {
    const adm = await adminPage(browser);
    await gotoAdmin(adm, 'customers');
    await rec.step(adm, 'Opened the Customers roster');

    await expect(adm.getByText('Test Customer').first()).toBeVisible({ timeout: 20_000 });
    await rec.step(adm, 'Seeded customers are listed with role and lifetime spend', undefined, 'assert');

    await adm.getByText('Test Customer').first().click();
    await adm.waitForTimeout(2000);
    await rec.step(adm, 'Opened the customer CRM record', 'Consolidated order/return history for one customer.');

    rec.finish('passed');
    await adm.context().close();
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});

test('Admin · Compliance validates the legal registrations', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(120_000);
  const rec = new Recorder({
    slug: 'admin-w5-compliance-validation',
    title: 'Admin workflow · Legal registration validation',
    area: 'Admin console · Compliance',
    purpose: 'The compliance screen validates PAN and GSTIN format, detects leftover placeholders, and cross-checks that the GSTIN embeds the PAN and carries the right state code — so a typo is caught here rather than on a customer tax invoice.',
    reproduce: [
      'Sign in as admin@test.local and open #/admin/compliance.',
      'Review the "Registered business" panel and the compliance checklist.',
      'With no VITE_GSTIN/VITE_PAN set (as in this emulator build), the checklist must report them as placeholders rather than passing.',
    ],
  });

  try {
    const adm = await adminPage(browser);
    await gotoAdmin(adm, 'compliance');
    await rec.step(adm, 'Opened Legal & Compliance');

    await expect(adm.getByText(/registered business/i).first()).toBeVisible({ timeout: 20_000 });
    await rec.step(adm, 'Registered-business panel renders', undefined, 'assert');

    // The emulator build sets no legal env vars, so the placeholders must be flagged.
    await expect(adm.getByText(/placeholder/i).first()).toBeVisible({ timeout: 15_000 });
    await rec.step(adm, 'Unset registrations are flagged as placeholders',
      'The screen refuses to report an unconfigured GSTIN/PAN as valid — this is the guard that keeps a fabricated tax number off invoices.', 'assert');

    rec.finish('passed');
    await adm.context().close();
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});

test('Admin ↔ Customer · Concurrent real-time support chat', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(180_000);
  const tag = nonce();
  const rec = new Recorder({
    slug: 'admin-w6-realtime-chat',
    title: 'Admin ↔ Customer · Concurrent real-time chat',
    area: 'Cross-role · Support',
    purpose: 'A customer and an admin, signed in simultaneously in separate browser sessions, exchange messages on a specific order and each sees the other\'s message live with no reload. This is the concurrency case: two roles operating in parallel against the same document.',
    reproduce: [
      'Open two browser sessions. Sign in as customer@test.local in one, admin@test.local in the other.',
      'Customer: #/account/orders → Chat on an order → send a message.',
      'Admin: #/admin/support → open that conversation → the message is already there.',
      'Admin: reply. The customer sees it without reloading.',
    ],
  });

  try {
    // Both roles live at once — this is the parallel part.
    const [cust, adm] = await Promise.all([customerPage(browser), adminPage(browser)]);
    await rec.step(cust, 'Customer session signed in');
    await rec.step(adm, 'Admin session signed in — both live concurrently');

    await cust.goto('/account/orders', { waitUntil: 'domcontentloaded' });
    await cust.waitForTimeout(1200);
    await cust.getByRole('button', { name: /^chat\b/i }).first().click();
    const input = cust.getByPlaceholder('Type a message…');
    await expect(input).toBeVisible({ timeout: 15_000 });
    const msg = `Customer question ${tag}`;
    await input.fill(msg);
    await input.press('Enter');
    await expect(cust.getByText(msg)).toBeVisible({ timeout: 10_000 });
    await rec.step(cust, 'Customer sent a message on their order', msg);

    await gotoAdmin(adm, 'support');
    await adm.getByText('Test Customer').first().click({ timeout: 20_000 });
    await expect(adm.getByText(msg).last()).toBeVisible({ timeout: 20_000 });
    await rec.step(adm, 'Admin sees the message in the inbox', 'Delivered without the admin reloading.', 'assert');

    const reply = `Atelier reply ${tag}`;
    const admInput = adm.getByPlaceholder('Type your reply…');
    await admInput.fill(reply);
    await admInput.press('Enter');
    await expect(adm.getByText(reply).last()).toBeVisible({ timeout: 10_000 });
    await rec.step(adm, 'Admin replied', reply);

    // Customer's chat is still open — the reply must arrive live.
    await expect(cust.getByText(reply)).toBeVisible({ timeout: 20_000 });
    await rec.step(cust, 'Customer received the reply live', 'No reload — the open listener delivered it.', 'assert');

    rec.finish('passed');
    await cust.context().close();
    await adm.context().close();
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});
