import type { Coupon } from '../types';

export type CouponResult =
  | { ok: true; discount: number }
  | { ok: false; reason: string };

/**
 * Coupons advertised directly in the storefront UI (cart "Available Offers"
 * panel, checkout). These are the source of truth so the promoted codes ALWAYS
 * validate, even before/without the Firestore `coupons` collection being
 * seeded. A matching doc in Firestore (managed via the admin console) takes
 * precedence — see couponsApi.get/validate in lib/firebase.ts.
 *
 * Keyed by the uppercase code (matches the Firestore document-id convention).
 */
export const BUILTIN_COUPONS: Record<string, Coupon> = {
  WEDDING50: {
    code: 'WEDDING50',
    description: 'Extra 10% off bridal silks',
    kind: 'percent',
    value: 10,
    maxDiscount: 10000,
    minSubtotal: 0,
    active: true,
  },
  UPI10: {
    code: 'UPI10',
    description: '10% UPI cashback (up to ₹500)',
    kind: 'percent',
    value: 10,
    maxDiscount: 500,
    minSubtotal: 0,
    active: true,
  },
};

/** Look up a built-in advertised coupon by code (case-insensitive). */
export function getBuiltinCoupon(code: string): Coupon | null {
  return BUILTIN_COUPONS[code.trim().toUpperCase()] ?? null;
}

/**
 * Pure validator + calculator for a coupon against a cart subtotal.
 *
 * Rules:
 *  - Coupon must be active.
 *  - Coupon must not be expired (when `expiresAt` is set).
 *  - Subtotal must meet `minSubtotal` (when set).
 *  - Percent coupons: subtotal * value/100, capped at `maxDiscount`.
 *  - Flat coupons: min(value, subtotal) so we never refund beyond the cart.
 *  - Final discount rounded to the nearest rupee.
 */
export function applyCoupon(coupon: Coupon, subtotal: number): CouponResult {
  if (!coupon.active) {
    return { ok: false, reason: 'Coupon is inactive' };
  }

  if (coupon.expiresAt) {
    const expiresAtMs = new Date(coupon.expiresAt).getTime();
    if (!Number.isNaN(expiresAtMs) && expiresAtMs < Date.now()) {
      return { ok: false, reason: 'Coupon expired' };
    }
  }

  if (typeof coupon.minSubtotal === 'number' && subtotal < coupon.minSubtotal) {
    const remaining = Math.max(0, coupon.minSubtotal - subtotal);
    const formatted = '₹' + remaining.toLocaleString('en-IN');
    return { ok: false, reason: `Add ${formatted} more to qualify` };
  }

  let raw: number;
  if (coupon.kind === 'percent') {
    const cap = typeof coupon.maxDiscount === 'number' ? coupon.maxDiscount : Infinity;
    raw = Math.min((subtotal * coupon.value) / 100, cap);
  } else {
    raw = Math.min(coupon.value, subtotal);
  }

  const discount = Math.max(0, Math.round(raw));
  return { ok: true, discount };
}
