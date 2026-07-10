/**
 * Wipe the Firestore `products` collection and seed it with the catalogue
 * extracted from the PPTX (inventory-from-pptx/inventory_first15_seed.json).
 *
 * Run from the repo root with Firebase Admin credentials:
 *
 *   # Option 1: service account key
 *   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\serviceAccountKey.json
 *   npx tsx scripts/seed-pptx-catalogue.ts
 *
 *   # Option 2: gcloud application-default auth
 *   gcloud auth application-default login
 *   npx tsx scripts/seed-pptx-catalogue.ts
 *
 * Pass --dry-run to preview without writing.
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, type WriteBatch } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ID = 'tresor-couture';
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');

initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
});

const db = getFirestore();

async function main() {
  const seedPath = resolve('inventory-from-pptx/inventory_first15_seed.json');
  const fabrics = JSON.parse(readFileSync(seedPath, 'utf-8')) as any[];

  console.log(`▸ Project: ${PROJECT_ID}`);
  console.log(`▸ Products to seed: ${fabrics.length}`);

  if (DRY_RUN) {
    console.log('▸ DRY RUN — no writes performed');
    fabrics.forEach((f, i) => console.log(`  ${i + 1}. ${f.id} - ₹${f.price} - ${f.name}`));
    return;
  }

  // Wipe existing products
  console.log('▸ Wiping existing products collection...');
  let wiped = 0;
  while (true) {
    const snap = await db.collection('products').limit(400).get();
    if (snap.empty) break;
    const batch: WriteBatch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    wiped += snap.size;
  }
  console.log(`  wiped ${wiped} documents.`);

  // Seed new catalogue
  console.log('▸ Seeding new catalogue...');
  const CHUNK = 400;
  let written = 0;
  for (let i = 0; i < fabrics.length; i += CHUNK) {
    const slice = fabrics.slice(i, i + CHUNK);
    const batch: WriteBatch = db.batch();
    for (const fabric of slice) {
      const ref = db.collection('products').doc(fabric.id);
      batch.set(ref, {
        ...fabric,
        id: fabric.id,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    written += slice.length;
    console.log(`  ${written}/${fabrics.length}`);
  }
  console.log(`✓ Done. ${written} products seeded live.`);
}

main().catch((err) => {
  console.error('✗ Seed failed:', err);
  process.exit(1);
});
