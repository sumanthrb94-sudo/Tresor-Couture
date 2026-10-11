/**
 * Replace placeholder product descriptions ("test", empty, "demo"…) with plain
 * copy built from the product's own record.
 *
 *   npx tsx scripts/fix-placeholder-descriptions.ts                 # emulator, dry run
 *   npx tsx scripts/fix-placeholder-descriptions.ts --prod          # LIVE, dry run (lists only)
 *   npx tsx scripts/fix-placeholder-descriptions.ts --prod --apply  # LIVE, writes
 *
 * Dry run is the default and writes nothing. Only the `description` field is
 * touched, and only where it is a placeholder — hand-written copy is never
 * overwritten. Needs FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS
 * for --prod (see scripts/lib/admin.ts).
 */
import { initAdmin } from './lib/admin';
import { isPlaceholderDescription, fallbackDescription } from '../src/lib/productCopy';
import type { Fabric } from '../src/types';

async function main() {
  const apply = process.argv.includes('--apply');
  const { db, prod, projectId } = initAdmin();
  console.log(`${prod ? 'LIVE' : 'emulator'} project ${projectId} — ${apply ? 'APPLYING' : 'dry run'}`);

  const snap = await db.collection('products').get();
  const hits = snap.docs.filter(d => isPlaceholderDescription((d.data() as Fabric).description));
  console.log(`${hits.length} of ${snap.size} products have a placeholder description.\n`);

  let batch = db.batch(), pending = 0, written = 0;
  for (const d of hits) {
    const f = d.data() as Fabric;
    const next = fallbackDescription(f);
    console.log(`• ${d.id}  "${f.name}"\n    was: ${JSON.stringify(f.description ?? '')}\n    now: ${next}`);
    if (!apply) continue;
    batch.update(d.ref, { description: next });
    if (++pending === 400) { await batch.commit(); written += pending; batch = db.batch(); pending = 0; }
  }
  if (apply && pending) { await batch.commit(); written += pending; }
  console.log(apply ? `\nUpdated ${written} products.` : '\nNothing written. Re-run with --apply to write.');
}

main().catch(e => { console.error(e); process.exit(1); });
