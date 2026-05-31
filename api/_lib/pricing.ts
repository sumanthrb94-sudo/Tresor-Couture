/**
 * AUTHORITATIVE server-side pricing.
 *
 * This is the single source of truth for what a customer owes. It reads
 * product prices and coupon definitions straight from Firestore via the Admin
 * SDK — the client-supplied cart only contributes product ids, quantities and
 * an optional coupon CODE. Amounts, discounts, tax and shipping are ALL
 * recomputed here so a tampered client total can never be trusted.
 *
 * The maths intentionally mirrors `ordersApi.place()` in src/lib/firebase.ts
 * (5% GST, free shipping >= ₹1999 else ₹99, COD ₹50 surcharge) so the figure
 * shown in the UI matches the figure charged.
 */
import type { Firestore } from 'firebase-admin/firestore';

export const COD_SURCHARGE = 50;
export const FREE_SHIPPING_THRESHOLD = 1999;
export const FLAT_SHIPPING = 99;
export const GST_RATE = 0.05;

export interface CartLineInput {
  fabricId: string;
  meters: number;
  color?: string;
}

export interface PricedLine extends CartLineInput {
  pricePerMeter: number;
  lineTotal: number;
  /** Stock available at compute time, if the product tracks stock. */
  inStockMeters?: number;
}

export interface PriceBreakdown {
  lines: PricedLine[];
  subtotal: number;
  couponCode?: string;
  couponDiscount: number;
  taxable: number;
  tax: number;
  shipping: number;
  codSurcharge: number;
  /** Grand total in rupees (integer). */
  total: number;
  /** Total in the smallest currency unit (paise) for Razorpay. */
  amountMinor: number;
  currency: 'INR';
}

function readPrice(data: Record<string, unknown>): number {
  // Defensive: read the price field without depending on src/types.ts.
  const p = data.pricePerMeter;
  if (typeof p === 'number' && isFinite(p) && p >= 0) return p;
  throw new Error('product_price_unavailable');
}

function readStock(data: Record<string, unknown>): number | undefined {
  const s = data.inStockMeters;
  return typeof s === 'number' && isFinite(s) ? s : undefined;
}

/**
 * Compute the authoritative breakdown. `paymentMethod` only affects the COD
 * surcharge. Throws on unknown product, bad quantity, or unreadable price.
 */
export async function computeBreakdown(
  db: Firestore,
  input: {
    items: CartLineInput[];
    couponCode?: string;
    paymentMethod?: 'card' | 'upi' | 'cod';
  },
): Promise<PriceBreakdown> {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('empty_cart');
  }

  const lines: PricedLine[] = [];
  for (const raw of input.items) {
    const meters = Number(raw.meters);
    if (!raw.fabricId || !isFinite(meters) || meters <= 0) {
      throw new Error('invalid_line');
    }
    const snap = await db.collection('products').doc(String(raw.fabricId)).get();
    if (!snap.exists) throw new Error(`unknown_product:${raw.fabricId}`);
    const data = (snap.data() ?? {}) as Record<string, unknown>;
    const pricePerMeter = readPrice(data);
    lines.push({
      fabricId: String(raw.fabricId),
      meters,
      color: raw.color,
      pricePerMeter,
      lineTotal: Math.round(pricePerMeter * meters),
      inStockMeters: readStock(data),
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.pricePerMeter * l.meters, 0);

  // Coupon — looked up by document id (uppercased code), same as the client.
  let couponDiscount = 0;
  let appliedCode: string | undefined;
  if (input.couponCode) {
    const code = input.couponCode.toUpperCase();
    const cSnap = await db.collection('coupons').doc(code).get();
    if (cSnap.exists) {
      const cd = (cSnap.data() ?? {}) as {
        active?: boolean;
        kind?: 'percent' | 'flat';
        value?: number;
        minSubtotal?: number;
        maxDiscount?: number;
        expiresAt?: string;
      };
      const valid =
        cd.active &&
        (!cd.expiresAt || new Date(cd.expiresAt).getTime() > Date.now()) &&
        (!cd.minSubtotal || subtotal >= cd.minSubtotal);
      if (valid) {
        couponDiscount =
          cd.kind === 'percent'
            ? Math.min(cd.maxDiscount ?? Infinity, Math.round(subtotal * ((cd.value ?? 0) / 100)))
            : cd.value ?? 0;
        appliedCode = code;
      }
    }
  }

  const taxable = Math.max(0, subtotal - couponDiscount);
  const tax = Math.round(taxable * GST_RATE);
  const shipping = taxable >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
  const codSurcharge = input.paymentMethod === 'cod' ? COD_SURCHARGE : 0;
  const total = taxable + tax + shipping + codSurcharge;

  return {
    lines,
    subtotal,
    couponCode: appliedCode,
    couponDiscount,
    taxable,
    tax,
    shipping,
    codSurcharge,
    total,
    amountMinor: Math.round(total * 100),
    currency: 'INR',
  };
}
