import { collection, getDocs, limit as qLimit, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { apiPost } from './csrf';
import type { CounterPaymentMethod, Fabric, Order } from './../types';

/**
 * Counter (point-of-sale) client.
 *
 * Lookups read Firestore directly — products are world-readable and a scan has
 * to feel instant. The SALE goes through /api/pos/sale, because
 * `firestore.rules` denies order creation to every client: pricing, stock and
 * the order write are the server's job, and the counter only ever sends
 * product ids and quantities.
 */

/** What a scan or a typed code resolves to, and how it was found. */
export interface Lookup {
  product: Fabric;
  matchedBy: 'barcode' | 'id' | 'productCode';
}

const first = async (field: string, value: string): Promise<Fabric | null> => {
  // Single equality filter — no composite index, which this project cannot
  // create on the free tier.
  const snap = await getDocs(query(collection(db, 'products'), where(field, '==', value), qLimit(1)));
  const d = snap.docs[0];
  return d ? ({ ...(d.data() as Fabric), id: d.id }) : null;
};

/**
 * Resolve a scanned or typed code to a product.
 *
 * Barcode first, because that is what the scanner types and it is the only
 * field guaranteed unique. The product id and the supplier's code are accepted
 * as fallbacks so an operator can key something in when a label is missing or
 * scuffed — but they are tried second, so a barcode can never be shadowed by a
 * supplier code that happens to look the same.
 *
 * Draft products resolve too: a piece can be sellable at the counter long
 * before it is photographed and published.
 */
export async function lookupCode(raw: string): Promise<Lookup | null> {
  const code = raw.trim();
  if (!code) return null;

  const byBarcode = await first('barcode', code);
  if (byBarcode) return { product: byBarcode, matchedBy: 'barcode' };

  const byId = await first('id', code);
  if (byId) return { product: byId, matchedBy: 'id' };

  const byProductCode = await first('productCode', code);
  if (byProductCode) return { product: byProductCode, matchedBy: 'productCode' };

  return null;
}

export interface SaleLine {
  fabricId: string;
  quantity: number;
  color?: string;
}

export interface SaleInput {
  items: SaleLine[];
  paymentMethod: CounterPaymentMethod;
  /** One UUID per ticket, held across retries. See `saleFailed` below. */
  saleKey: string;
  customer?: { name?: string; phone?: string };
}

export interface SaleResult {
  orderId: string;
  order: Order;
  /** True when this saleKey had already been rung up — a reprint, not a second charge. */
  alreadyProcessed: boolean;
}

/** A sale the server refused, carrying enough detail to fix the ticket in place. */
export class SaleError extends Error {
  readonly code: string;
  readonly fabricId?: string;
  readonly requested?: number;
  readonly available?: number;

  constructor(code: string, extra: { fabricId?: string; requested?: number; available?: number } = {}) {
    super(code);
    this.name = 'SaleError';
    this.code = code;
    this.fabricId = extra.fabricId;
    this.requested = extra.requested;
    this.available = extra.available;
  }
}

/**
 * Ring up the ticket.
 *
 * `saleKey` must be the SAME value on every retry of one ticket: the server
 * keys idempotency on it, so a double-tap or a dropped connection reprints the
 * same invoice instead of charging twice. Mint a new one only after a sale
 * completes.
 */
export async function ringSale(input: SaleInput): Promise<SaleResult> {
  const user = auth.currentUser;
  if (!user) throw new SaleError('not_signed_in');

  const token = await user.getIdToken();
  const res = await apiPost('/api/pos/sale', { sale: input }, { authorization: `Bearer ${token}` });

  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  if (res.status === 503 || !isJson) throw new SaleError('pos_not_configured');

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean; orderId?: string; order?: Order; alreadyProcessed?: boolean;
    error?: string; fabricId?: string; requested?: number; available?: number;
  };

  if (!res.ok || !data.orderId) {
    throw new SaleError(data.error || 'sale_failed', {
      fabricId: data.fabricId,
      requested: data.requested,
      available: data.available,
    });
  }

  return {
    orderId: data.orderId,
    order: { ...(data.order as Order), id: data.orderId },
    alreadyProcessed: Boolean(data.alreadyProcessed),
  };
}

/** Plain-English for the counter. The operator is standing in front of a
 *  customer and needs to know what to do, not what the server called it. */
export function saleErrorMessage(err: unknown): string {
  if (!(err instanceof SaleError)) {
    return err instanceof Error ? err.message : 'The sale could not be completed.';
  }
  switch (err.code) {
    case 'pos_not_configured':
      return 'The counter is not configured on this deployment yet — the server has no write credentials.';
    case 'forbidden':
      return 'This account is not an admin, so it cannot ring up a sale.';
    case 'not_signed_in':
    case 'unauthorized':
      return 'Signed out. Sign in again and re-scan the ticket.';
    case 'rate_limited':
      return 'Too many sales in a short time. Wait a moment and try again.';
    case 'invalid_payment_method':
      return 'Choose how the customer paid.';
    default:
      if (err.code.startsWith('insufficient_stock')) {
        return `Only ${err.available ?? 0} left of that piece, but the ticket asks for ${err.requested ?? 0}. Adjust the quantity.`;
      }
      if (err.code.startsWith('unknown_product')) {
        return 'One of the pieces on this ticket no longer exists in the catalogue.';
      }
      return 'The sale could not be completed. Nothing was charged and no stock moved.';
  }
}
