/**
 * Barcode assignment, shared by `assign-barcodes.ts` (run it on its own) and
 * `import-catalogue.ts` (run it as the last step of a bulk import).
 *
 * It lives here rather than in one of the CLIs because a product that arrives
 * through a spreadsheet needs a scannable code exactly as much as one typed
 * into the admin console, and two copies of the numbering rule would eventually
 * hand out the same TC number twice.
 *
 * Format: TC + 5 digits (TC00001). Short on purpose — a Code 128 symbol for
 * TC00001 is 33mm wide at a 0.25mm module, half a standard 63.5x38.1mm label,
 * leaving room for the name and price. A Firestore id would need 60mm.
 *
 * Idempotent: a product that already has a `barcode` is never touched, and the
 * next number continues from the highest already assigned.
 *
 * Assignment is single-operator by design: it reads every existing barcode,
 * then writes. Two people running it simultaneously against the same project
 * could collide — at this scale that is a documented constraint, not a defect.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { code128, encodableInCode128B } from '../../src/lib/barcode';

const PREFIX = 'TC';
const DIGITS = 5;
const BARCODE_RE = /^TC(\d{5})$/;
/** Firestore batches cap at 500 writes. */
const BATCH = 400;

export const formatBarcode = (n: number): string => `${PREFIX}${String(n).padStart(DIGITS, '0')}`;

export interface Assignment {
  id: string;
  barcode: string;
  name: string;
}

export interface AssignResult {
  /** Every product in the collection. */
  total: number;
  /** How many already carried a barcode before this run. */
  existing: number;
  /** Highest TC number in use after the run (0 when none). */
  highest: number;
  assignments: Assignment[];
  /** barcode -> product ids sharing it. Non-empty means a scan is ambiguous. */
  duplicates: Map<string, string[]>;
}

export interface AssignOptions {
  /** Restrict to one masterCategory/category. */
  onlyCategory?: string;
  /** Restrict to these product ids (used by the importer to report per-import). */
  onlyIds?: Set<string>;
  /** Compute the assignments but write nothing. */
  dryRun?: boolean;
}

/**
 * Give every product that lacks one a barcode.
 *
 * Throws on duplicates rather than writing: an ambiguous scan at the counter
 * rings up the wrong item, so it must be fixed before any label is printed.
 */
export async function assignBarcodes(db: Firestore, opts: AssignOptions = {}): Promise<AssignResult> {
  const snap = await db.collection('products').get();
  const products = snap.docs.map(d => ({ id: d.id, data: d.data() as Record<string, unknown> }));

  const seen = new Map<string, string[]>();
  let highest = 0;
  for (const p of products) {
    const bc = typeof p.data.barcode === 'string' ? p.data.barcode.trim() : '';
    if (!bc) continue;
    seen.set(bc, [...(seen.get(bc) ?? []), p.id]);
    const m = BARCODE_RE.exec(bc);
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  const duplicates = new Map([...seen.entries()].filter(([, ids]) => ids.length > 1));

  const result: AssignResult = {
    total: products.length,
    existing: seen.size,
    highest,
    assignments: [],
    duplicates,
  };
  if (duplicates.size) return result;

  const targets = products
    .filter(p => !(typeof p.data.barcode === 'string' && p.data.barcode.trim()))
    .filter(p => !opts.onlyIds || opts.onlyIds.has(p.id))
    .filter(p => !opts.onlyCategory
      || p.data.masterCategory === opts.onlyCategory
      || p.data.category === opts.onlyCategory)
    // Stable order so a rerun after a partial failure is predictable.
    .sort((a, b) => a.id.localeCompare(b.id));

  let next = highest;
  for (const p of targets) {
    next += 1;
    const barcode = formatBarcode(next);
    // Belt and braces: the encoder must accept what we are about to print.
    if (!encodableInCode128B(barcode)) throw new Error(`generated an unencodable barcode: ${barcode}`);
    code128(barcode);
    result.assignments.push({ id: p.id, barcode, name: String(p.data.name ?? '') });
  }
  result.highest = next;

  if (opts.dryRun || !result.assignments.length) return result;

  for (let i = 0; i < result.assignments.length; i += BATCH) {
    const batch = db.batch();
    for (const a of result.assignments.slice(i, i + BATCH)) {
      batch.update(db.collection('products').doc(a.id), {
        barcode: a.barcode,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
  return result;
}
