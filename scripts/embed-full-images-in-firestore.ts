/**
 * Embed the full catalogue images as base64 data URLs into Firestore.
 *
 * Run with Firebase Admin credentials:
 *
 *   export GOOGLE_APPLICATION_CREDENTIALS=C:/Users/91779/Downloads/tresor-couture-firebase-adminsdk-fbsvc-11042bbad1.json
 *   npx tsx scripts/embed-full-images-in-firestore.ts
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ID = 'tresor-couture';

initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
});

const db = getFirestore();

async function main() {
  const base64Path = resolve('inventory-from-pptx/images_full_base64.json');
  const images = JSON.parse(readFileSync(base64Path, 'utf-8')) as Record<string, string>;

  console.log(`▸ Embedding ${Object.keys(images).length} product images into Firestore...`);

  for (const [code, dataUrl] of Object.entries(images)) {
    const snap = await db.collection('products').where('id', '==', code).limit(1).get();
    if (snap.empty) {
      console.log(`  X ${code}: product not found in Firestore`);
      continue;
    }
    const doc = snap.docs[0];
    await doc.ref.update({
      photo: dataUrl,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`  OK ${code}: embedded ${(dataUrl.length / 1024).toFixed(1)} KB`);
  }

  console.log('\n✓ Done. Images are now served from Firestore base64 payloads.');
}

main().catch((err) => {
  console.error('✗ Failed:', err);
  process.exit(1);
});
