/**
 * PRODUCTS — public read, gated write. Reads work anonymously; create() as a
 * non-admin must be denied by the rules.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { productsApi, register, signOut } from '../../src/lib/firebase';
import { uniqueEmail, TEST_PASSWORD } from './_helpers';

describe('products', () => {
  afterAll(async () => { await signOut(); });

  let firstId: string;

  it('list() returns at least one product with the required schema fields', async () => {
    const list = await productsApi.list({ limit: 5 });
    expect(list.length).toBeGreaterThan(0);
    const p = list[0] as { id: string; name: string; brand?: string; pricePerMeter: number; masterCategory: string; category: string };
    expect(p.id).toBeTruthy();
    expect(p.name).toBeTruthy();
    expect(typeof p.pricePerMeter).toBe('number');
    expect(p.pricePerMeter).toBeGreaterThanOrEqual(0);
    expect(p.masterCategory).toBeTruthy();
    expect(p.category).toBeTruthy();
    firstId = p.id;
  });

  it('get(id) round-trips the same document the list returned', async () => {
    const p = await productsApi.get(firstId);
    expect(p).not.toBeNull();
    expect(p!.id).toBe(firstId);
  });

  it('create() as a signed-in non-admin is rejected by firestore.rules', async () => {
    await register({ email: uniqueEmail('prod-neg'), password: TEST_PASSWORD, fullName: 'NonAdmin' });
    await expect(
      productsApi.create({
        brand: 'TestBrand',
        name: 'Should Not Persist',
        pricePerMeter: 100,
        masterCategory: 'Fabrics',
        category: 'Test',
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
