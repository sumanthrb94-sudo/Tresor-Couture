/**
 * TEST ONLY — seed two users into the local Firebase Auth + Firestore emulators
 * for the live-chat end-to-end test:
 *   - customer@test.local (role customer)
 *   - admin@test.local    (role admin, `admin: true` custom claim)
 *
 * Requires the emulators to be running and these env vars set:
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-tresor';
if (!getApps().length) initializeApp({ projectId: PROJECT_ID });

const auth = getAuth();
const db = getFirestore();

const PASSWORD = 'Test1234!';

async function ensureUser(email: string, fullName: string, admin: boolean) {
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
  await db.collection('users').doc(uid).set({
    uid,
    email,
    fullName,
    role: admin ? 'admin' : 'customer',
    createdAt: new Date().toISOString(),
  }, { merge: true });
  console.log(`  ✓ ${email} (${uid})${admin ? ' [admin]' : ''}`);
  return uid;
}

async function main() {
  console.log('Seeding emulator users…');
  const customerUid = await ensureUser('customer@test.local', 'Test Customer', false);
  await ensureUser('admin@test.local', 'Atelier Admin', true);

  // Seed a delivered order for the customer so the per-order chat (opened from
  // an order in the account) has something to attach to. Fixed id for the test.
  await db.collection('orders').doc('EMUTESTORDER1').set({
    userId: customerUid,
    status: 'placed',
    total: 999,
    subtotal: 999,
    shipping: 0,
    placedAt: new Date().toISOString(),
    paymentMethod: 'cod',
    shippingAddress: { fullName: 'Test Customer', line1: '1 Test St', city: 'Hyderabad', state: 'Telangana', postalCode: '500001', country: 'India' },
    items: [{ fabricId: 'demo', quantity: 1, fabricSnapshot: { id: 'demo', name: 'Demo Lace', brand: 'TRESOR', price: 999, photo: '', image: '', masterCategory: 'Laces' } }],
  }, { merge: true });
  console.log('  ✓ order EMUTESTORDER1 for customer');
  console.log('Done.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
