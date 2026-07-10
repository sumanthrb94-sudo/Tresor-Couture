import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'tresor-couture' });
const db = getFirestore();

async function main() {
  const snap = await db.collection('products').get();
  console.log('Total products:', snap.size);
  const cats: Record<string, number> = {};
  snap.docs.forEach((d) => {
    const c = d.data().masterCategory || d.data().category || 'unknown';
    cats[c] = (cats[c] || 0) + 1;
  });
  console.log('By category:', cats);
  console.log('First 5 IDs:', snap.docs.slice(0, 5).map((d) => d.data().id));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
