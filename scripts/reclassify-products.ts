/**
 * Move products from one category (and optionally subcategory) to another.
 *
 * A taxonomy settles by moving, not by re-typing. When a name that was a
 * subcategory is promoted to a category of its own — Half Sarees under Sarees
 * becoming the Half Saree section — the products filed under the old name do not
 * follow on their own. They keep pointing at a name that no longer means what it
 * did, which is worse than either state, because the catalogue and the menus now
 * disagree and both look correct in isolation.
 *
 * Nothing else about a product changes. The id, the barcode, the price, the
 * photograph and the listing status are untouched, so a label already printed
 * and stuck on a piece stays valid — the barcode identifies the product, not its
 * shelf.
 *
 * Dry run first. Always:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-tresor \
 *     npx tsx scripts/reclassify-products.ts \
 *       --from "Sarees/Half Sarees" --to "Half Saree/Langa Voni" --dry-run
 *
 * Then for real, against production:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/key.json \
 *     npx tsx scripts/reclassify-products.ts \
 *       --from "Sarees/Half Sarees" --to "Half Saree/Langa Voni" --prod
 *
 * `--from` and `--to` are "Category" or "Category/Sub Category". A `--from` with
 * no subcategory matches every product in that category, whatever its
 * subcategory. A `--to` with no subcategory leaves each product's subcategory
 * alone.
 */
import { initAdmin } from './lib/admin';
import { MASTER_CATEGORIES } from '../src/constants';

interface Ref { master: string; sub?: string }

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function parseRef(raw: string | undefined, flag: string): Ref {
  if (!raw || raw.startsWith('--')) {
    throw new Error(`${flag} needs a value, e.g. ${flag} "Sarees/Half Sarees"`);
  }
  const [master, ...rest] = raw.split('/');
  const sub = rest.join('/').trim();
  return { master: master.trim(), sub: sub || undefined };
}

async function main(): Promise<void> {
  const DRY = process.argv.includes('--dry-run');
  const from = parseRef(arg('--from'), '--from');
  const to = parseRef(arg('--to'), '--to');

  // The destination has to be a category the application knows, or the products
  // land somewhere no menu will ever offer and no dropdown can select back.
  // The SOURCE is deliberately unchecked: moving things off a retired name is
  // the whole point, and that name is usually already gone from the list.
  if (!(MASTER_CATEGORIES as string[]).includes(to.master)) {
    console.error(`"${to.master}" is not a category. Add it to src/constants.ts first, or use one of:`);
    console.error(`  ${MASTER_CATEGORIES.join(', ')}`);
    process.exit(1);
  }

  const { db, prod, projectId } = initAdmin();
  const snap = await db.collection('products').get();

  const hits = snap.docs.filter(d => {
    const p = d.data() as { masterCategory?: string; category?: string; subCategory?: string };
    const inCategory = p.masterCategory === from.master || p.category === from.master;
    if (!inCategory) return false;
    return from.sub ? (p.subCategory ?? '').trim() === from.sub : true;
  });

  const label = (r: Ref) => (r.sub ? `${r.master} / ${r.sub}` : r.master);
  console.log(`${prod ? 'PRODUCTION' : 'EMULATOR'} "${projectId}"`);
  console.log(`  ${snap.size} products, ${hits.length} under ${label(from)}`);

  if (!hits.length) {
    console.log('  Nothing to move.');
    return;
  }

  for (const d of hits) {
    const p = d.data() as { name?: string; subCategory?: string };
    const nextSub = to.sub ?? p.subCategory;
    console.log(`  ${d.id.padEnd(24)} ${String(p.name ?? '').slice(0, 40).padEnd(42)} → ${to.master}${nextSub ? ` / ${nextSub}` : ''}`);
  }

  if (DRY) {
    console.log(`\n  --dry-run: nothing written. Re-run without it to move ${hits.length}.`);
    return;
  }

  // `category` and `masterCategory` are two names for one fact — the app reads
  // both — so they move together or the product is half-moved.
  let batch = db.batch();
  let queued = 0;
  for (const d of hits) {
    const patch: Record<string, string> = { masterCategory: to.master, category: to.master };
    if (to.sub) patch.subCategory = to.sub;
    batch.update(d.ref, patch);
    if (++queued === 400) { await batch.commit(); batch = db.batch(); queued = 0; }
  }
  if (queued) await batch.commit();

  console.log(`\n  ✓ moved ${hits.length} to ${label(to)}`);
  console.log('  Barcodes and printed labels are unaffected — a code identifies the piece, not its shelf.');
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
