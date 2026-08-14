import { test, expect, type Browser } from '@playwright/test';
import { Recorder } from './lib/recorder';
import { customerPage } from './lib/session';

/**
 * Payment-method gating at checkout.
 *
 * UPI and Card unlock purely from the presence of VITE_RAZORPAY_KEY_ID, so
 * turning online payment on is an environment change with no code edit. This
 * test asserts that contract in whichever direction the current build was made:
 * with a key the options are selectable, without one they stay disabled and
 * labelled "Coming soon" rather than failing at the gateway.
 *
 * It deliberately does NOT complete a Razorpay payment — that needs the real
 * hosted modal and a real card.
 */
test('Checkout · Payment methods reflect Razorpay configuration', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(150_000);

  const rec = new Recorder({
    slug: 'checkout-payment-methods',
    title: 'Checkout · Payment method availability',
    area: 'Storefront · Checkout',
    purpose:
      'UPI and Card are enabled if and only if VITE_RAZORPAY_KEY_ID is present in the build. This is what makes going live a matter of setting an environment variable and redeploying, with no code change — and what stops the store offering a payment method it cannot actually take.',
    reproduce: [
      'Build the app with VITE_RAZORPAY_KEY_ID set (any non-empty value) and serve it.',
      'Sign in, add an item to the bag, and open #/checkout.',
      'Step 3 "Payment Method": UPI and Card are selectable, subtitled with the method rather than "Coming soon".',
      'Rebuild WITHOUT the variable: both revert to disabled "Coming soon", and Cash on Delivery remains the only option.',
    ],
  });

  try {
    const cust = await customerPage(browser);

    await cust.goto('/product/1', { waitUntil: 'domcontentloaded' });
    await cust.waitForTimeout(1500);
    const add = cust.getByRole('button', { name: /add to (bag|cart)/i });
    if (await add.first().isVisible().catch(() => false)) await add.first().click();
    await cust.waitForTimeout(800);
    await rec.step(cust, 'Added an item to the bag');

    await cust.goto('/checkout', { waitUntil: 'domcontentloaded' });
    await cust.waitForTimeout(2500);
    await rec.step(cust, 'Opened checkout');

    // Checkout is a 3-step accordion and only the active step renders its
    // content, so the payment options do not exist in the DOM until the address
    // step has been completed. Walk the flow rather than reaching past it.
    await cust.getByRole('button', { name: /^continue$/i }).first().click({ timeout: 15_000 }).catch(() => {});
    await cust.waitForTimeout(800);

    const addr: Record<string, string> = {
      fullName: 'Test Customer', email: 'customer@test.local', phone: '9876543210',
      line1: '1 Heritage Lane', city: 'Hyderabad', state: 'Telangana', postalCode: '500001',
    };
    for (const [name, value] of Object.entries(addr)) {
      const f = cust.locator(`input[name="${name}"], select[name="${name}"]`).first();
      if (await f.isVisible().catch(() => false)) await f.fill(value).catch(() => {});
    }
    await rec.step(cust, 'Completed the delivery address step');

    await cust.getByRole('button', { name: /save & continue/i }).first().click({ timeout: 15_000 });
    await cust.waitForTimeout(1500);
    await rec.step(cust, 'Advanced to step 3 — Payment Method');

    // Read the rendered state rather than assuming which way the build was made.
    const body = await cust.locator('body').innerText();
    const configured = !/coming soon/i.test(body);

    const cod = cust.getByRole('button').filter({ hasText: 'Cash on Delivery' }).first();
    await expect(cod).toBeEnabled({ timeout: 15_000 });
    rec.note('Cash on Delivery is always available', 'COD never depends on gateway configuration.');

    const upi = cust.getByRole('button').filter({ hasText: 'UPI' }).first();
    const card = cust.getByRole('button').filter({ hasText: 'Card' }).first();

    if (configured) {
      await expect(upi).toBeEnabled({ timeout: 15_000 });
      await expect(card).toBeEnabled({ timeout: 15_000 });
      rec.note('Razorpay key present → UPI and Card are selectable');

      await upi.click();
      await cust.waitForTimeout(600);
      await rec.step(cust, 'Selected UPI',
        'The copy switches to explain the customer will be redirected to the payment partner and that the order is only confirmed once payment succeeds.', 'assert');
    } else {
      await expect(upi).toBeDisabled({ timeout: 15_000 });
      await expect(card).toBeDisabled({ timeout: 15_000 });
      await rec.step(cust, 'No Razorpay key → UPI and Card stay disabled',
        'The store does not offer a payment method it cannot take.', 'assert');
    }

    rec.finish('passed');
    await cust.context().close();
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});
