import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const key = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!key) throw new Error('GOOGLE_APPLICATION_CREDENTIALS not set');

initializeApp({ credential: cert(key), projectId: 'tresor-couture' });
const db = getFirestore();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const collections = args.filter((a) => !a.startsWith('--'));

if (collections.length === 0) {
  console.error('Usage: npx tsx scripts/wipe-collections.ts [--dry-run] <collection1> [collection2] ...');
  process.exit(1);
}

const PROTECTED = ['products'];
for (const name of collections) {
  if (PROTECTED.includes(name)) {
    console.error(`Refusing to wipe protected collection: ${name}`);
    process.exit(1);
  }
}

async function wipeCollection(name: string) {
  const col = db.collection(name);
  let total = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await col.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    if (!dryRun) {
      await batch.commit();
    }
    total += snap.size;
    if (snap.size < 400) break;
  }
  console.log(`${dryRun ? '[DRY RUN] Would delete' : 'Deleted'} ${total} documents from "${name}"`);
}

async function main() {
  for (const name of collections) {
    await wipeCollection(name);
  }
  console.log(dryRun ? 'Dry run complete.' : 'Wipe complete.');
}

main().catch((err) => { console.error(err); process.exit(1); });
