/**
 * Upload the extracted PPTX product images to Firebase Storage and update the
 * corresponding Firestore product documents to use the public Storage URLs.
 *
 * Run with Firebase Admin credentials:
 *
 *   export GOOGLE_APPLICATION_CREDENTIALS=C:/Users/91779/Downloads/tresor-couture-firebase-adminsdk-fbsvc-11042bbad1.json
 *   npx tsx scripts/upload-pptx-images-to-storage.ts
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync } from 'fs';
import { resolve, basename } from 'path';

const PROJECT_ID = 'tresor-couture';
const BUCKET_NAME = 'tresor-couture.firebasestorage.app';

initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
  storageBucket: BUCKET_NAME,
});

const db = getFirestore();
const bucket = getStorage().bucket();

async function main() {
  const seedPath = resolve('inventory-from-pptx/inventory_first15.json');
  const rows = JSON.parse(readFileSync(seedPath, 'utf-8')) as any[];
  const imgDir = resolve('inventory-from-pptx/images');

  console.log(`▸ Uploading ${rows.length} product images to gs://${BUCKET_NAME}/products/pptx/...`);

  for (const row of rows) {
    const code = row.code || `SLIDE${String(row.slide).padStart(2, '0')}`;
    const imageFile = row.image_files?.split(';')[0];
    if (!imageFile) {
      console.log(`  ✗ ${code}: no image file`);
      continue;
    }

    const localPath = resolve(imgDir, imageFile);
    const dest = `products/pptx/${basename(imageFile)}`;

    // Upload to Firebase Storage
    await bucket.upload(localPath, {
      destination: dest,
      metadata: {
        contentType: imageFile.endsWith('.png') ? 'image/png' : 'image/jpeg',
        metadata: {
          productCode: code,
          source: 'pptx-catalogue-extraction',
        },
      },
    });

    // Make public
    const file = bucket.file(dest);
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${dest}`;

    // Find the Firestore product doc by code and update photo URL
    const snap = await db.collection('products').where('id', '==', code).limit(1).get();
    if (snap.empty) {
      console.log(`  ✗ ${code}: product not found in Firestore`);
      continue;
    }

    const doc = snap.docs[0];
    await doc.ref.update({
      photo: publicUrl,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`  ✓ ${code}: ${publicUrl}`);
  }

  console.log('\n✓ Done. Product images are now served from Firebase Storage.');
}

main().catch((err) => {
  console.error('✗ Upload failed:', err);
  process.exit(1);
});
