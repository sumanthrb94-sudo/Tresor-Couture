/**
 * One-shot data migration: metres-schema → units-schema.
 *
 * The 72a89f9 refactor renamed the TypeScript fields (pricePerMeter→price,
 * mrpPerMeter→mrp, inStockMeters→stock; CartItem.meters→quantity) but the
 * existing Firestore documents were never migrated — so production products
 * read price=undefined and order items read quantity=undefined, which crashes
 * the admin/storefront. This backfills the new fields (and removes the old
 * ones) on every product and order, including the per-order item fabricSnapshots.
 *
 * Idempotent: only writes docs that still carry old fields. Dry-run by default.
 *
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccount.json"
 *   npx tsx scripts/migrate-units.ts            # preview (no writes)
 *   npx tsx scripts/migrate-units.ts --apply    # write changes
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (!getApps().length) initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const APPLY = process.argv.includes('--apply');

const RENAME: Record<string, string> = {
  pricePerMeter: 'price',
  mrpPerMeter: 'mrp',
  inStockMeters: 'stock',
};

/** Returns the new fields to set, given a product-shaped object. */
function productPatch(data: Record<string, any>): Record<string, any> {
  const patch: Record<string, any> = {};
  for (const [oldF, newF] of Object.entries(RENAME)) {
    if (data[newF] === undefined && data[oldF] !== undefined) patch[newF] = data[oldF];
  }
  return patch;
}

async function migrateProducts() {
  const snap = await db.collection('products').get();
  let changed = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const patch = productPatch(data);
    const del: Record<string, any> = {};
    for (const oldF of Object.keys(RENAME)) if (data[oldF] !== undefined) del[oldF] = FieldValue.delete();
    if (Object.keys(patch).length === 0 && Object.keys(del).length === 0) continue;
    changed++;
    console.log(`  product ${d.id}: set ${JSON.stringify(patch)} drop [${Object.keys(del).join(', ')}]`);
    if (APPLY) await d.ref.set({ ...patch, ...del }, { merge: true });
  }
  console.log(`products: ${changed}/${snap.size} ${APPLY ? 'migrated' : 'would migrate'}`);
}

/** Cache of migrated product docs, for backfilling missing fabricSnapshots. */
const productCache = new Map<string, Record<string, any> | null>();
async function getProduct(id: string): Promise<Record<string, any> | null> {
  if (productCache.has(id)) return productCache.get(id)!;
  const snap = await db.collection('products').doc(id).get();
  const data = snap.exists ? { id: snap.id, ...snap.data() } : null;
  productCache.set(id, data);
  return data;
}

async function migrateOrders() {
  const snap = await db.collection('orders').get();
  let changed = 0;
  for (const d of snap.docs) {
    const o = d.data();
    const patch: Record<string, any> = {};

    // items[]: meters→quantity, migrate each item's fabricSnapshot fields, and
    // backfill a fabricSnapshot for legacy/test orders that never had one.
    if (Array.isArray(o.items)) {
      let itemsTouched = false;
      const items = await Promise.all(o.items.map(async (it: any) => {
        if (it == null) return it;
        const ni: Record<string, any> = { ...it };
        if (ni.quantity === undefined && ni.meters !== undefined) { ni.quantity = ni.meters; itemsTouched = true; }
        if ('meters' in ni) { delete ni.meters; itemsTouched = true; }
        if (ni.fabricSnapshot && typeof ni.fabricSnapshot === 'object') {
          const fs = { ...ni.fabricSnapshot };
          const fsPatch = productPatch(fs);
          for (const [k, v] of Object.entries(fsPatch)) { fs[k] = v; itemsTouched = true; }
          for (const oldF of Object.keys(RENAME)) if (oldF in fs) { delete fs[oldF]; itemsTouched = true; }
          ni.fabricSnapshot = fs;
        } else if (ni.fabricId) {
          // No snapshot — rebuild it from the referenced product so receipts /
          // invoices / reporting don't crash. Falls back to a safe placeholder.
          const p = await getProduct(ni.fabricId);
          ni.fabricSnapshot = p ?? {
            id: ni.fabricId, name: ni.name ?? 'Archived item', brand: ni.brand ?? 'TRESOR',
            price: ni.price ?? 0, mrp: ni.mrp ?? 0, photo: '', image: '',
            category: 'Silk', masterCategory: 'Fabrics',
          };
          itemsTouched = true;
        }
        return ni;
      }));
      if (itemsTouched) patch.items = items;
    }

    // order-level meterCount → unitCount (if present)
    if (o.unitCount === undefined && o.meterCount !== undefined) {
      patch.unitCount = o.meterCount;
      patch.meterCount = FieldValue.delete();
    }

    // placedAt stored as a Timestamp → normalise to ISO string (the app expects a string).
    if (o.placedAt && typeof o.placedAt !== 'string' && typeof o.placedAt.toDate === 'function') {
      patch.placedAt = o.placedAt.toDate().toISOString();
    }

    if (Object.keys(patch).length === 0) continue;
    changed++;
    const summary = Object.keys(patch).join(', ');
    console.log(`  order ${d.id}: ${summary}`);
    if (APPLY) await d.ref.set(patch, { merge: true });
  }
  console.log(`orders: ${changed}/${snap.size} ${APPLY ? 'migrated' : 'would migrate'}`);
}

async function main() {
  console.log(APPLY ? '=== APPLYING migration ===\n' : '=== DRY RUN (no writes) — pass --apply to write ===\n');
  await migrateProducts();
  console.log();
  await migrateOrders();
  console.log(`\n${APPLY ? 'Migration complete.' : 'Dry run complete. Re-run with --apply to write.'}`);
}

main().then(() => process.exit(0)).catch(e => { console.error('✗ migration failed:', e); process.exit(1); });
