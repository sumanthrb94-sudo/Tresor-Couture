/**
 * Stock reservation / decrement helpers for order placement.
 *
 * All stock changes run inside a Firestore transaction so an order is only
 * created when the inventory actually exists. If stock is insufficient, the
 * function throws `insufficient_stock:{fabricId}` so the API can return a
 * 409 Conflict to the buyer.
 */
import type { Firestore, Transaction } from 'firebase-admin/firestore';

export interface StockLine {
  fabricId: string;
  quantity: number;
}

export interface StockResult {
  /** Product id */
  fabricId: string;
  /** Stock before decrement */
  previousStock: number;
  /** Stock after decrement */
  newStock: number;
}

function readStock(data: Record<string, unknown>): number {
  const s = data.stock;
  return typeof s === 'number' && isFinite(s) ? s : 0;
}

/**
 * Decrement stock inside a transaction the CALLER owns.
 *
 * The counter needs the stock move and the order write to be the same atomic
 * act: if an order could exist without its stock having been taken, the till
 * would need a compensating restore, and a compensating restore that fails
 * leaves the shelf lying about itself. Owning the transaction is what removes
 * that failure mode entirely.
 *
 * Must be called before any write in the transaction — Firestore requires all
 * reads to precede all writes.
 *
 * Throws `unknown_product:{id}` or `insufficient_stock:{id}`.
 */
export async function decrementStockInTx(
  tx: Transaction,
  db: Firestore,
  lines: StockLine[],
): Promise<StockResult[]> {
  if (lines.length === 0) throw new Error('empty_cart');

  const refs = lines.map((l) => db.collection('products').doc(l.fabricId));
  const snaps = await tx.getAll(...refs);
  const results: StockResult[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const snap = snaps[i];
    if (!snap.exists) throw new Error(`unknown_product:${line.fabricId}`);

    const data = (snap.data() ?? {}) as Record<string, unknown>;
    const current = readStock(data);
    if (current < line.quantity) throw new Error(`insufficient_stock:${line.fabricId}`);

    tx.update(snap.ref, { stock: current - line.quantity, updatedAt: new Date().toISOString() });
    results.push({ fabricId: line.fabricId, previousStock: current, newStock: current - line.quantity });
  }

  return results;
}

/**
 * Decrement stock for each line inside a Firestore transaction. Throws
 * `insufficient_stock:{fabricId}` if any line requests more units than are
 * available. Returns the per-line stock deltas.
 */
export async function decrementStock(
  db: Firestore,
  lines: StockLine[],
): Promise<StockResult[]> {
  if (lines.length === 0) throw new Error('empty_cart');

  const refs = lines.map((l) => db.collection('products').doc(l.fabricId));

  return db.runTransaction(async (tx: Transaction) => {
    const snaps = await tx.getAll(...refs);
    const results: StockResult[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const snap = snaps[i];
      if (!snap.exists) throw new Error(`unknown_product:${line.fabricId}`);

      const data = (snap.data() ?? {}) as Record<string, unknown>;
      const current = readStock(data);
      if (current < line.quantity) {
        throw new Error(`insufficient_stock:${line.fabricId}`);
      }
      const next = current - line.quantity;
      tx.update(snap.ref, { stock: next, updatedAt: new Date().toISOString() });
      results.push({ fabricId: line.fabricId, previousStock: current, newStock: next });
    }

    return results;
  });
}

/**
 * Restore stock for a cancelled or failed order. Best-effort: never throws.
 */
export async function restoreStock(
  db: Firestore,
  lines: StockLine[],
): Promise<void> {
  try {
    const refs = lines.map((l) => db.collection('products').doc(l.fabricId));
    await db.runTransaction(async (tx: Transaction) => {
      const snaps = await tx.getAll(...refs);
      for (let i = 0; i < lines.length; i++) {
        const snap = snaps[i];
        if (!snap.exists) continue;
        const data = (snap.data() ?? {}) as Record<string, unknown>;
        const current = readStock(data);
        tx.update(snap.ref, {
          stock: current + lines[i].quantity,
          updatedAt: new Date().toISOString(),
        });
      }
    });
  } catch (err) {
    console.error('[stock] restore failed', (err as Error).message);
  }
}
