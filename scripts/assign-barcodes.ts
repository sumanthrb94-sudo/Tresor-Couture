/**
 * Assign scannable barcodes to products that do not have one.
 *
 * The numbering rule itself lives in scripts/lib/barcodes.ts, shared with the
 * catalogue importer — see that file for the format and its constraints. This
 * is the standalone CLI: use it after adding products through the admin
 * console, or to re-check the whole catalogue before a label print run.
 *
 * Emulator (default):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-tresor \
 *     npx tsx scripts/assign-barcodes.ts
 *
 * Production:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/key.json \
 *     npx tsx scripts/assign-barcodes.ts --prod [--only-category Laces] [--dry-run]
 *
 *   --verify   report duplicates and stop, writing nothing
 */
import { initAdmin } from './lib/admin';
import { assignBarcodes, formatBarcode } from './lib/barcodes';

const DRY = process.argv.includes('--dry-run');
const VERIFY_ONLY = process.argv.includes('--verify');
const catIndex = process.argv.indexOf('--only-category');
const ONLY_CATEGORY = catIndex >= 0 ? process.argv[catIndex + 1] : undefined;

async function main(): Promise<void> {
  const { db, prod, projectId } = initAdmin();

  const res = await assignBarcodes(db, {
    onlyCategory: ONLY_CATEGORY,
    dryRun: DRY || VERIFY_ONLY,
  });

  console.log(`${prod ? 'PRODUCTION' : 'EMULATOR'} "${projectId}"`);
  console.log(`  ${res.total} products, ${res.existing} already carry a barcode`);

  // A duplicate makes a scan ambiguous: the counter would ring up whichever
  // product the query happened to return first. Never print labels in this state.
  if (res.duplicates.size) {
    console.error('\nDUPLICATE BARCODES — a scan would be ambiguous. Fix before printing:');
    for (const [bc, ids] of res.duplicates) console.error(`  ${bc} -> ${ids.join(', ')}`);
    process.exit(1);
  }

  if (VERIFY_ONLY) {
    console.log('  ✓ no duplicates');
    return;
  }

  if (!res.assignments.length) {
    console.log('  Nothing to assign — every matching product already has a barcode.');
    return;
  }

  for (const a of res.assignments) {
    console.log(`  ${a.barcode}  ${a.id.padEnd(20)} ${a.name.slice(0, 44)}`);
  }

  if (DRY) {
    console.log(`\nDRY RUN — would assign ${res.assignments.length} barcode(s). Nothing written.`);
    return;
  }
  console.log(`\nDone. Assigned ${res.assignments.length} barcode(s), ${formatBarcode(res.highest)} is now the highest.`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
