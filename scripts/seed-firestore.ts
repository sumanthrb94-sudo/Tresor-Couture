/**
 * One-shot Firestore seeder. Run from the repo root:
 *
 *   # one-time:
 *   gcloud auth application-default login   # OR set GOOGLE_APPLICATION_CREDENTIALS
 *   npm install -D firebase-admin tsx
 *
 *   # every time you want to (re)seed:
 *   npm run seed
 *
 * The script uses the Firebase Admin SDK, which bypasses Firestore rules,
 * so you don't need an admin custom claim on your user to run it. It pulls
 * the in-repo FABRICS array and writes one product document per entry.
 *
 * Pass --force to wipe the products collection first; otherwise the script
 * bails out if the collection already has documents.
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, type WriteBatch } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { FABRICS } from '../src/constants';

const PROJECT_ID = 'tresor-couture';
const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force') || args.has('-f');

initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID
});

const db = getFirestore();

async function seedProducts() {
  console.log(`▸ Project: ${PROJECT_ID}`);
  console.log(`▸ FABRICS in repo: ${FABRICS.length}`);

  const existing = await db.collection('products').limit(1).get();

  if (!existing.empty && !FORCE) {
    console.log('• products collection already has documents — skipping (pass --force to wipe and reseed).');
    return;
  }

  if (!existing.empty && FORCE) {
    console.log('▸ --force: wiping existing products...');
    let wiped = 0;
    while (true) {
      const snap = await db.collection('products').limit(400).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      wiped += snap.size;
    }
    console.log(`  wiped ${wiped} documents.`);
  }

  console.log('▸ Seeding...');
  const CHUNK = 400; // Firestore batch limit is 500; leave headroom
  let written = 0;
  for (let i = 0; i < FABRICS.length; i += CHUNK) {
    const slice = FABRICS.slice(i, i + CHUNK);
    const batch: WriteBatch = db.batch();
    for (const fabric of slice) {
      const ref = db.collection('products').doc();
      batch.set(ref, {
        ...fabric,
        id: ref.id,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
    await batch.commit();
    written += slice.length;
    console.log(`  ${written}/${FABRICS.length}`);
  }
  console.log(`✓ Done. ${written} products seeded.`);
}

// Coupons advertised in the cart/checkout UI. Doc id MUST be the uppercase
// code — couponsApi.get()/validate() look up by document id. Idempotent.
const COUPONS = [
  {
    code: 'WEDDING50',
    description: 'Extra 10% off bridal silks',
    kind: 'percent' as const,
    value: 10,
    maxDiscount: 10000,
    minSubtotal: 0,
    active: true,
  },
  {
    code: 'UPI10',
    description: '10% UPI cashback (up to ₹500)',
    kind: 'percent' as const,
    value: 10,
    maxDiscount: 500,
    minSubtotal: 0,
    active: true,
  },
];

async function seedCoupons() {
  console.log('▸ Seeding coupons...');
  const batch = db.batch();
  for (const c of COUPONS) {
    batch.set(db.collection('coupons').doc(c.code), { ...c }, { merge: true });
  }
  await batch.commit();
  console.log(`✓ ${COUPONS.length} coupons seeded: ${COUPONS.map(c => c.code).join(', ')}`);
}

// The demo admin account the login page advertises. Admin access is gated by
// the `admin: true` custom claim (see isAdminUser in src/lib/firebase.ts).
const ADMIN_EMAIL = 'admin@tresor.test';
const ADMIN_PASSWORD = 'tresor-admin';

async function seedAdmin() {
  console.log('▸ Ensuring admin user...');
  const auth = getAuth();
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(ADMIN_EMAIL);
    uid = existing.uid;
    await auth.updateUser(uid, { password: ADMIN_PASSWORD, emailVerified: true });
    console.log(`  • admin user already existed (${uid}) — password reset to default.`);
  } catch {
    const created = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      emailVerified: true,
      displayName: 'Tresor Admin',
    });
    uid = created.uid;
    console.log(`  • created admin user ${uid}.`);
  }
  // Grant the admin custom claim and mirror a users/{uid} profile doc.
  await auth.setCustomUserClaims(uid, { admin: true });
  await db.collection('users').doc(uid).set(
    {
      uid,
      email: ADMIN_EMAIL,
      fullName: 'Tresor Admin',
      role: 'admin',
      createdAt: new Date().toISOString(),
    },
    { merge: true }
  );
  console.log(`✓ admin claim set for ${ADMIN_EMAIL} (sign in with ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}).`);
}

async function main() {
  await seedProducts();
  await seedCoupons();
  await seedAdmin();
}

main().catch(err => {
  console.error('✗ Seed failed:', err);
  process.exit(1);
});
