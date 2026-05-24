/**
 * SECURITY RULES — the negative cases that prove firestore.rules actually
 * fences off cross-tenant reads/writes. Mirrors postman/Negative & Security.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  register, signOut, login, auth, ordersApi, productsApi, usersApi,
} from '../../src/lib/firebase';
import { uniqueEmail, TEST_PASSWORD, SHIPPING_ADDRESS } from './_helpers';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';

describe('firestore.rules — cross-tenant denials', () => {
  const aliceEmail = uniqueEmail('alice');
  const bobEmail = uniqueEmail('bob');
  let aliceUid: string;
  let bobUid: string;
  let aliceOrderId: string;
  let aliceFabricId: string;

  beforeAll(async () => {
    const a = await register({ email: aliceEmail, password: TEST_PASSWORD, fullName: 'Alice' });
    aliceUid = a.user.uid;
    const list = await productsApi.list({ limit: 1 });
    aliceFabricId = (list[0] as { id: string }).id;
    const placed = await ordersApi.place({
      items: [{ fabricId: aliceFabricId, meters: 1 }],
      shippingAddress: SHIPPING_ADDRESS,
      paymentMethod: 'cod',
    });
    aliceOrderId = placed.id;
    await signOut();

    const b = await register({ email: bobEmail, password: TEST_PASSWORD, fullName: 'Bob' });
    bobUid = b.user.uid;
  });

  afterAll(async () => { await signOut(); });

  it('Bob cannot read Alice\'s order document', async () => {
    expect(auth.currentUser?.uid).toBe(bobUid);
    await expect(getDoc(doc(db, 'orders', aliceOrderId))).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('Bob cannot read Alice\'s /users profile', async () => {
    await expect(getDoc(doc(db, 'users', aliceUid))).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('Bob cannot promote himself to admin via usersApi.updateMe({role:"admin"})', async () => {
    await expect(usersApi.updateMe({ role: 'admin' })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('Bob cannot place an order while spoofing Alice\'s userId', async () => {
    // Bypass ordersApi.place() (which stamps the right uid) and try a raw write
    const { addDoc, collection } = await import('firebase/firestore');
    await expect(
      addDoc(collection(db, 'orders'), {
        userId: aliceUid,
        items: [{ fabricId: aliceFabricId, meters: 1, fabricSnapshot: { pricePerMeter: 1000 } }],
        subtotal: 1000, tax: 50, shipping: 99, total: 1149,
        shippingAddress: SHIPPING_ADDRESS,
        paymentMethod: 'cod',
        placedAt: new Date().toISOString(),
        status: 'placed',
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('an unsigned client cannot create a /products document', async () => {
    await signOut();
    await expect(
      productsApi.create({ brand: 'X', name: 'Y', pricePerMeter: 1, masterCategory: 'Fabrics', category: 'Z' })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
