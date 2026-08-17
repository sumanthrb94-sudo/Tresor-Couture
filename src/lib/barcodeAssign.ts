import { collection, doc, getDoc, getDocs, limit as qLimit, query, runTransaction, where } from 'firebase/firestore';
import { db } from './firebase';
import { code128, encodableInCode128B } from './barcode';

/**
 * Allocate the next barcode, from the admin console.
 *
 * Format: TC + 5 digits (TC00001), the same series `scripts/assign-barcodes.ts`
 * hands out — a product barcoded at the counter and one barcoded by a bulk
 * import must never collide, because a duplicate makes a scan ambiguous and the
 * till rings up whichever product the query happened to return first.
 *
 * The number comes from a single counter document incremented in a Firestore
 * transaction. The CLI cannot use a transaction for this (it finds the maximum
 * by scanning, which a transaction cannot do — transactions read documents, not
 * queries), so it writes the counter forward after each run instead. Both
 * writers therefore agree on one series, and the transaction is what makes two
 * admins clicking "Generate" at the same moment safe.
 *
 * Rules gate `counters/*` to admins, so this cannot be called from a shopper's
 * browser.
 */

const COUNTER_PATH = ['counters', 'barcodes'] as const;
const PREFIX = 'TC';
const DIGITS = 5;
const BARCODE_RE = /^TC(\d{5})$/;

/** How many times to skip past a number that is somehow already in use. */
const MAX_RETRIES = 5;

export const formatBarcode = (n: number): string => `${PREFIX}${String(n).padStart(DIGITS, '0')}`;

const counterRef = () => doc(db, COUNTER_PATH[0], COUNTER_PATH[1]);

/** Highest TC number already on a product. Only used to seed the counter. */
async function highestAssigned(): Promise<number> {
  const snap = await getDocs(collection(db, 'products'));
  let highest = 0;
  for (const d of snap.docs) {
    const raw = (d.data() as { barcode?: unknown }).barcode;
    const m = typeof raw === 'string' ? BARCODE_RE.exec(raw.trim()) : null;
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  return highest;
}

/**
 * Create the counter if it has never existed, starting above every barcode
 * already in use. Runs once per project; afterwards it is a single cheap read.
 */
async function ensureCounter(): Promise<void> {
  if ((await getDoc(counterRef())).exists()) return;

  // Read the catalogue OUTSIDE the transaction — a transaction cannot run a
  // query — then commit only if nobody else seeded it in the meantime. Two
  // admins racing here compute the same number anyway.
  const seed = (await highestAssigned()) + 1;
  await runTransaction(db, async (tx) => {
    const cur = await tx.get(counterRef());
    if (cur.exists()) return;
    tx.set(counterRef(), { next: seed, seededAt: new Date().toISOString() });
  });
}

/** True when some product already carries this code. */
async function inUse(barcode: string): Promise<boolean> {
  const snap = await getDocs(query(collection(db, 'products'), where('barcode', '==', barcode), qLimit(1)));
  return !snap.empty;
}

/**
 * Reserve the next unused barcode and return it.
 *
 * The caller is responsible for writing it onto a product. A number handed out
 * and then abandoned simply leaves a gap in the series, which costs nothing —
 * the codes are identifiers, not a count of anything.
 *
 * The in-use check after the increment is belt and braces: the counter is
 * authoritative, but if it ever fell behind (restored from an older backup, or
 * a barcode typed in by hand) minting a duplicate would be far worse than
 * skipping a number.
 */
export async function reserveBarcode(): Promise<string> {
  await ensureCounter();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const barcode = await runTransaction(db, async (tx) => {
      const cur = await tx.get(counterRef());
      const next = Number(cur.data()?.next ?? 1);
      const value = Number.isFinite(next) && next > 0 ? Math.floor(next) : 1;
      tx.set(counterRef(), { next: value + 1 }, { merge: true });
      return formatBarcode(value);
    });

    // The encoder must accept what we are about to print on a label.
    if (!encodableInCode128B(barcode)) throw new Error(`generated an unencodable barcode: ${barcode}`);
    code128(barcode);

    if (!(await inUse(barcode))) return barcode;
  }

  throw new Error('Could not allocate a free barcode — run scripts/assign-barcodes.ts --verify to check for duplicates.');
}
