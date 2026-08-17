/**
 * Assign scannable barcodes to products that do not have one.
 *
 * Format: TC + 5 digits (TC00001). Short on purpose — a Code 128 symbol for
 * TC00001 is 33mm wide at a 0.25mm module, half a standard 63.5x38.1mm label,
 * leaving room for the name and price. The Firestore id would need 60mm and
 * leave 3mm.
 *
 * Idempotent: a product that already has a `barcode` is never touched, and the
 * next number continues from the highest already assigned. Re-running after a
 * partial failure is safe.
 *
 * Assignment is single-operator by design: it reads every existing barcode,
 * then writes. Two people running it simultaneously against the same project
 * could collide — at this scale that is a documented constraint, not a defect.
 * The `--verify` flag re-reads and reports duplicates if it ever matters.
 *
 * Emulator (default):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-tresor \
 *     npx tsx scripts/assign-barcodes.ts
 *
 * Production:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/key.json \
 *     npx tsx scripts/assign-barcodes.ts --prod [--only-category Laces] [--dry-run]
 */
import { initializeApp, getApps, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { code128, encodableInCode128B } from '../src/lib/barcode';

const PROD = process.argv.includes('--prod');
const DRY = process.argv.includes('--dry-run');
const VERIFY_ONLY = process.argv.includes('--verify');
const catIndex = process.argv.indexOf('--only-category');
const ONLY_CATEGORY = catIndex >= 0 ? process.argv[catIndex + 1] : undefined;

const PROJECT_ID = PROD
  ? (process.env.FIREBASE_PROJECT_ID || 'tresor-couture')
  : (process.env.GCLOUD_PROJECT || 'demo-tresor');

if (!getApps().length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (PROD && raw?.trim()) {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.private_key === 'string') parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    initializeApp({ credential: cert(parsed as never), projectId: PROJECT_ID });
  } else if (PROD) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  } else {
    initializeApp({ projectId: PROJECT_ID });
  }
}
const db = getFirestore();

const PREFIX = 'TC';
const DIGITS = 5;
const BARCODE_RE = /^TC(\d{5})$/;

const format = (n: number): string => `${PREFIX}${String(n).padStart(DIGITS, '0')}`;

async function main(): Promise<void> {
  const snap = await db.collection('products').get();
  const products = snap.docs.map(d => ({ id: d.id, ref: d.ref, data: d.data() as Record<string, unknown> }));

  // ── Report existing state, and fail loudly on duplicates ────────────────
  const seen = new Map<string, string[]>();
  let highest = 0;
  for (const p of products) {
    const bc = typeof p.data.barcode === 'string' ? p.data.barcode.trim() : '';
    if (!bc) continue;
    seen.set(bc, [...(seen.get(bc) ?? []), p.id]);
    const m = BARCODE_RE.exec(bc);
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  const dupes = [...seen.entries()].filter(([, ids]) => ids.length > 1);
  if (dupes.length) {
    console.error('DUPLICATE BARCODES — a scan would be ambiguous. Fix before printing:');
    for (const [bc, ids] of dupes) console.error(`  ${bc} -> ${ids.join(', ')}`);
    process.exit(1);
  }

  console.log(`${PROD ? 'PRODUCTION' : 'EMULATOR'} "${PROJECT_ID}"`);
  console.log(`  ${products.length} products, ${seen.size} already carry a barcode, highest is ${highest ? format(highest) : '(none)'}`);

  if (VERIFY_ONLY) {
    console.log('  ✓ no duplicates');
    return;
  }

  // ── Assign, in a stable order so reruns are predictable ─────────────────
  const targets = products
    .filter(p => !(typeof p.data.barcode === 'string' && p.data.barcode.trim()))
    .filter(p => !ONLY_CATEGORY || p.data.masterCategory === ONLY_CATEGORY || p.data.category === ONLY_CATEGORY)
    .sort((a, b) => a.id.localeCompare(b.id));

  if (!targets.length) {
    console.log('  Nothing to assign — every matching product already has a barcode.');
    return;
  }

  let next = highest;
  const assignments: { id: string; barcode: string; name: string }[] = [];
  for (const p of targets) {
    next += 1;
    const barcode = format(next);
    // Belt and braces: the encoder must accept what we are about to print.
    if (!encodableInCode128B(barcode)) throw new Error(`generated an unencodable barcode: ${barcode}`);
    code128(barcode);
    assignments.push({ id: p.id, barcode, name: String(p.data.name ?? '') });
  }

  for (const a of assignments) {
    console.log(`  ${a.barcode}  ${a.id.padEnd(20)} ${a.name.slice(0, 44)}`);
  }

  if (DRY) {
    console.log(`\nDRY RUN — would assign ${assignments.length} barcode(s). Nothing written.`);
    return;
  }

  // Firestore batches cap at 500 writes.
  for (let i = 0; i < assignments.length; i += 400) {
    const batch = db.batch();
    for (const a of assignments.slice(i, i + 400)) {
      batch.update(db.collection('products').doc(a.id), {
        barcode: a.barcode,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  console.log(`\nDone. Assigned ${assignments.length} barcode(s), ${format(next)} is now the highest.`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
