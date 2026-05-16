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
import { FABRICS } from '../src/constants';

const PROJECT_ID = 'tresor-couture';
const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force') || args.has('-f');

initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID
});

const db = getFirestore();

async function main() {
  console.log(`▸ Project: ${PROJECT_ID}`);
  console.log(`▸ FABRICS in repo: ${FABRICS.length}`);

  const existing = await db.collection('products').limit(1).get();

  if (!existing.empty && !FORCE) {
    console.log('✗ products collection already has documents — pass --force to wipe and reseed.');
    process.exit(0);
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

main().catch(err => {
  console.error('✗ Seed failed:', err);
  process.exit(1);
});
