import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const key = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!key) throw new Error('GOOGLE_APPLICATION_CREDENTIALS not set');
initializeApp({ credential: cert(key), projectId: 'tresor-couture' });
const db = getFirestore();

async function main() {
  const collections = await db.listCollections();
  console.log('Collections:');
  for (const col of collections) {
    const snap = await col.limit(1).get();
    console.log(`  - ${col.id} (${snap.size} sampled)`);
  }
}
main().catch((err) => { console.error(err); process.exit(1); });
