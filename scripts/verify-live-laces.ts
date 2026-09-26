import { initAdmin } from './lib/admin';

const { db, projectId } = initAdmin();

async function main() {
  console.log(`Checking production Firestore "${projectId}"...`);
  const snap = await db.collection('products').where('styleCode', '==', 'TC-LC145').get();
  console.log(`Found ${snap.size} products under styleCode "TC-LC145" in production:`);
  snap.docs.forEach(doc => {
    const d = doc.data();
    console.log(` - ${d.id.padEnd(10)} [${(d.colourName || '').padEnd(16)}] ${d.name} (Stock: ${d.stock}m)`);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
