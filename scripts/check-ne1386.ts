import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const key = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!key) throw new Error('GOOGLE_APPLICATION_CREDENTIALS not set');
initializeApp({ credential: cert(key), projectId: 'tresor-couture' });
const db = getFirestore();

async function main() {
  const ids = ['NE1386', 'NE1386-S31', 'HA6373', 'NO-CODE-S23'];
  for (const id of ids) {
    const snap = await db.collection('products').where('id', '==', id).limit(1).get();
    if (snap.empty) { console.log(`\n${id}: NOT FOUND`); continue; }
    const d = snap.docs[0].data();
    console.log(`\n${id}:`);
    console.log('  price:', d.price);
    console.log('  unitType:', d.unitType);
    console.log('  stock:', d.stock);
    console.log('  subCategory:', d.subCategory);
    console.log('  description:', (d.description || '').slice(0, 160));
  }
}
main().catch((err) => { console.error(err); process.exit(1); });
