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
  quantity: number;
  color?: string;
}

export interface PricedLine extends CartLineInput {
  price: number;
  lineTotal: number;
  /** Units available at compute time, if the product tracks stock. */
  stock?: number;
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
  // Defensive: read the per-unit price without depending on src/types.ts.
  const p = data.price;
  if (typeof p === 'number' && isFinite(p) && p >= 0) return p;
  throw new Error('product_price_unavailable');
}

function readStock(data: Record<string, unknown>): number | undefined {
  const s = data.stock;
  return typeof s === 'number' && isFinite(s) ? s : undefined;
}

export interface CouponEvaluation {
  valid: boolean;
  code?: string;
  discount: number;
  reason?: 'not_found' | 'inactive' | 'expired' | 'min_subtotal';
  minSubtotal?: number;
}

/**
 * Authoritative coupon evaluation against the Firestore `coupons` collection
 * (read via the Admin SDK). Single source of truth shared by `computeBreakdown`
 * and the public `/api/coupons/validate` endpoint, so the discount shown in the
 * UI always matches the discount actually applied — and the `coupons`
 * collection never has to be exposed to client reads.
 */
export async function evaluateCoupon(
  db: Firestore,
  rawCode: string,
  subtotal: number,
): Promise<CouponEvaluation> {
  const code = rawCode.toUpperCase();
  const snap = await db.collection('coupons').doc(code).get();
  if (!snap.exists) return { valid: false, discount: 0, reason: 'not_found' };
  const cd = (snap.data() ?? {}) as {
    active?: boolean;
    kind?: 'percent' | 'flat';
    value?: number;
    minSubtotal?: number;
    maxDiscount?: number;
    expiresAt?: string;
  };
  if (!cd.active) return { valid: false, discount: 0, reason: 'inactive' };
  if (cd.expiresAt && new Date(cd.expiresAt).getTime() <= Date.now()) {
    return { valid: false, discount: 0, reason: 'expired' };
  }
  if (cd.minSubtotal && subtotal < cd.minSubtotal) {
    return { valid: false, discount: 0, reason: 'min_subtotal', minSubtotal: cd.minSubtotal };
  }
  const discount =
    cd.kind === 'percent'
      ? Math.min(cd.maxDiscount ?? Infinity, Math.round(subtotal * ((cd.value ?? 0) / 100)))
      : cd.value ?? 0;
  return { valid: true, code, discount };
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
    const quantity = Number(raw.quantity);
    if (!raw.fabricId || !isFinite(quantity) || quantity <= 0) {
      throw new Error('invalid_line');
    }
    const snap = await db.collection('products').doc(String(raw.fabricId)).get();
    if (!snap.exists) throw new Error(`unknown_product:${raw.fabricId}`);
    const data = (snap.data() ?? {}) as Record<string, unknown>;
    const price = readPrice(data);
    lines.push({
      fabricId: String(raw.fabricId),
      quantity,
      color: raw.color,
      price,
      lineTotal: Math.round(price * quantity),
      stock: readStock(data),
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);

  // Coupon — evaluated via the shared authoritative helper.
  let couponDiscount = 0;
  let appliedCode: string | undefined;
  if (input.couponCode) {
    const result = await evaluateCoupon(db, input.couponCode, subtotal);
    if (result.valid) {
      couponDiscount = result.discount;
      appliedCode = result.code;
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
