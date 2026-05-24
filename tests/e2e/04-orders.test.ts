/**
 * ORDERS — the full money path:
 *   register → list products → place order → totals math → mine() → security
 *
 * Math the test independently re-derives from the rule in
 * src/lib/firebase.ts:ordersApi.place:
 *   subtotal  = sum(item.pricePerMeter * item.meters)
 *   discount  = 0 (no coupon in this test)
 *   tax       = round((subtotal - discount) * 0.05)
 *   shipping  = (subtotal - discount) >= 1999 ? 0 : 99
 *   total     = (subtotal - discount) + tax + shipping
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  register, signOut, auth, productsApi, ordersApi,
} from '../../src/lib/firebase';
import { uniqueEmail, TEST_PASSWORD, SHIPPING_ADDRESS } from './_helpers';

describe('orders — place + read back', () => {
  let userUid: string;
  let placedOrderId: string;
  let expectedTotals: { subtotal: number; tax: number; shipping: number; total: number };
  let fabricId: string;
  let fabricPrice: number;
  const METERS = 3;

  beforeAll(async () => {
    const { user } = await register({ email: uniqueEmail('order'), password: TEST_PASSWORD, fullName: 'Order Buyer' });
    userUid = user.uid;
    const list = await productsApi.list({ limit: 1 });
    if (list.length === 0) throw new Error('no products in /products — seed first');
    const p = list[0] as { id: string; pricePerMeter: number };
    fabricId = p.id;
    fabricPrice = p.pricePerMeter;

    const subtotal = fabricPrice * METERS;
    const taxable = subtotal;
    const tax = Math.round(taxable * 0.05);
    const shipping = taxable >= 1999 ? 0 : 99;
    expectedTotals = { subtotal, tax, shipping, total: taxable + tax + shipping };
  });

  afterAll(async () => { await signOut(); });

  it('place() persists an order with the correct subtotal/tax/shipping/total', async () => {
    const order = await ordersApi.place({
      items: [{ fabricId, meters: METERS }],
      shippingAddress: SHIPPING_ADDRESS,
      paymentMethod: 'cod',
    });
    placedOrderId = order.id;
    expect(order.userId).toBe(userUid);
    expect(order.status).toBe('placed');
    expect(order.items.length).toBe(1);
    expect(order.subtotal).toBe(expectedTotals.subtotal);
    expect(order.tax).toBe(expectedTotals.tax);
    expect(order.shipping).toBe(expectedTotals.shipping);
    expect(order.total).toBe(expectedTotals.total);
  });

  it('place() with an unknown fabricId throws unknown_product:<id>', async () => {
    await expect(
      ordersApi.place({
        items: [{ fabricId: 'definitely-not-a-real-id', meters: 1 }],
        shippingAddress: SHIPPING_ADDRESS,
        paymentMethod: 'cod',
      })
    ).rejects.toThrow(/^unknown_product:/);
  });

  it('mine() returns the just-placed order at the top of the list', async () => {
    const list = await ordersApi.mine();
    expect(list.length).toBeGreaterThan(0);
    const head = list[0] as { id: string; userId: string; status: string };
    expect(head.id).toBe(placedOrderId);
    expect(head.userId).toBe(userUid);
    expect(head.status).toBe('placed');
  });

  it('place() without auth throws not_signed_in', async () => {
    await signOut();
    expect(auth.currentUser).toBeNull();
    await expect(
      ordersApi.place({
        items: [{ fabricId, meters: 1 }],
        shippingAddress: SHIPPING_ADDRESS,
        paymentMethod: 'cod',
      })
    ).rejects.toThrow(/not_signed_in/);
  });
});
