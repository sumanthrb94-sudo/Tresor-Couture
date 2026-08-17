/**
 * TEST ONLY — rich seed for the full end-to-end emulator run.
 *
 * Seeds into the local Auth + Firestore emulators (keyless projectId init, which
 * is all the emulator needs):
 *   - customer@test.local   (role customer)  — the primary shopper
 *   - customer2@test.local  (role customer)  — used to prove per-user isolation
 *   - admin@test.local      (role admin, `admin:true` custom claim)
 *   - the real FABRICS catalogue as `products` (storefront/PDP/cart render)
 *   - coupons (WEDDING50, UPI10) so checkout coupon UI works
 *   - orders for the customer:
 *       ORD-CHAT      status placed     → per-order chat lives here
 *       ORD-RETURN    status delivered  → deliveredAt = now → return window OPEN
 *
 * Requires the emulators running and:
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { FABRICS } from '../src/constants';

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-tresor';
if (!getApps().length) initializeApp({ projectId: PROJECT_ID });

const auth = getAuth();
const db = getFirestore();
const PASSWORD = 'Test1234!';

async function ensureUser(email: string, fullName: string, admin: boolean): Promise<string> {
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    await auth.updateUser(uid, { displayName: fullName });
  } catch {
    const created = await auth.createUser({ email, emailVerified: true, password: PASSWORD, displayName: fullName });
    uid = created.uid;
  }
  if (admin) await auth.setCustomUserClaims(uid, { admin: true });
  await db.collection('users').doc(uid).set(
    { uid, email, fullName, role: admin ? 'admin' : 'customer', createdAt: new Date().toISOString() },
    { merge: true },
  );
  console.log(`  ✓ ${email} (${uid})${admin ? ' [admin]' : ''}`);
  return uid;
}

async function seedProducts(): Promise<void> {
  const existing = await db.collection('products').limit(1).get();
  if (!existing.empty) {
    console.log(`  ✓ products already seeded (${(await db.collection('products').count().get()).data().count})`);
    return;
  }
  let written = 0;
  for (let i = 0; i < FABRICS.length; i += 400) {
    const slice = FABRICS.slice(i, i + 400);
    const batch = db.batch();
    for (const fabric of slice) {
      // Preserve the catalogue id so deep links are stable; ensure stock so the
      // add-to-cart / quantity stepper is enabled.
      const id = String(fabric.id);
      batch.set(db.collection('products').doc(id), {
        ...fabric,
        id,
        stock: typeof fabric.stock === 'number' ? fabric.stock : 25,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    written += slice.length;
  }
  console.log(`  ✓ ${written} products`);
}

/**
 * A deliberately sold-out product, so the storefront's stock-out treatment has
 * something to assert against. Written unconditionally (merge) rather than
 * behind the "already seeded" guard, so re-seeding an existing emulator still
 * produces it. `sticker` is set on purpose: the card must suppress the
 * marketing badge in favour of "Sold out".
 */
async function seedSoldOutFixture(): Promise<void> {
  const base = FABRICS[0];
  await db.collection('products').doc('e2e-sold-out').set({
    ...base,
    id: 'e2e-sold-out',
    name: 'E2E Sold Out Fixture',
    sticker: 'Bestseller',
    stock: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('  ✓ sold-out fixture (e2e-sold-out)');
}

/**
 * A product registered but not published — what a bulk import creates for a
 * piece that has no photograph yet. It has stock and a barcode, so the counter
 * can sell it and Inventory can label it, but no shopper may see it.
 *
 * Stock is deliberately non-zero: this must fail for a different reason than
 * `e2e-sold-out` does, or the test would pass on the wrong mechanism.
 */
async function seedDraftFixture(): Promise<void> {
  const base = FABRICS[0];
  await db.collection('products').doc('e2e-draft').set({
    ...base,
    id: 'e2e-draft',
    name: 'E2E Draft Fixture',
    listingStatus: 'Draft',
    barcode: 'TC99001',
    stock: 7,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('  ✓ draft fixture (e2e-draft)');
}

async function seedCoupons(): Promise<void> {
  const coupons = [
    { code: 'WEDDING50', description: 'Extra 10% off bridal silks', kind: 'percent', value: 10, maxDiscount: 10000, minSubtotal: 0, active: true },
    { code: 'UPI10', description: '10% off on prepaid', kind: 'percent', value: 10, maxDiscount: 2000, minSubtotal: 0, active: true },
  ];
  for (const c of coupons) await db.collection('coupons').doc(c.code).set(c, { merge: true });
  console.log(`  ✓ ${coupons.length} coupons`);
}

/** Build an order line snapshot from the real catalogue entry so thumbnails
 *  render (FabricImage falls back photo -> image; empty strings would show a
 *  broken image). */
function snapshot(fabricId: string) {
  const f = FABRICS.find((x) => String(x.id) === fabricId);
  return {
    id: fabricId,
    name: f?.name ?? 'Fabric',
    brand: f?.brand ?? 'TRESOR',
    price: f?.price ?? 0,
    photo: f?.photo ?? '',
    image: f?.image ?? '',
    masterCategory: f?.masterCategory ?? 'Fabrics',
  };
}

async function seedOrders(customerUid: string): Promise<void> {
  const addr = { fullName: 'Test Customer', line1: '1 Heritage Lane', city: 'Hyderabad', state: 'Telangana', postalCode: '500001', country: 'India', phone: '9876543210', email: 'customer@test.local' };

  // Order used for the per-order chat thread.
  await db.collection('orders').doc('ORD-CHAT').set({
    userId: customerUid, status: 'placed', paymentMethod: 'cod',
    subtotal: 4500, shipping: 0, tax: 0, total: 4500,
    placedAt: new Date().toISOString(),
    shippingAddress: addr,
    items: [{ fabricId: '1', quantity: 1, fabricSnapshot: snapshot('1') }],
  }, { merge: true });

  // Delivered order within the 7-day window → return should be allowed.
  await db.collection('orders').doc('ORD-RETURN').set({
    userId: customerUid, status: 'delivered', paymentMethod: 'cod',
    subtotal: 6999, shipping: 0, tax: 0, total: 6999,
    placedAt: new Date(Date.now() - 3 * 864e5).toISOString(),
    deliveredAt: FieldValue.serverTimestamp(),
    shippingAddress: addr,
    items: [{ fabricId: '2', quantity: 1, fabricSnapshot: snapshot('2') }],
  }, { merge: true });

  console.log('  ✓ orders ORD-CHAT (placed), ORD-RETURN (delivered, window open)');
}

async function main(): Promise<void> {
  console.log('Seeding full emulator dataset…');
  const customerUid = await ensureUser('customer@test.local', 'Test Customer', false);
  await ensureUser('customer2@test.local', 'Second Customer', false);
  await ensureUser('admin@test.local', 'Atelier Admin', true);
  await seedProducts();
  await seedSoldOutFixture();
  await seedDraftFixture();
  await seedCoupons();
  await seedOrders(customerUid);
  console.log('Done.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
