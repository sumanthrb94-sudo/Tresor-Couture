import type { Coupon } from '../types';

export type CouponResult =
  | { ok: true; discount: number }
  | { ok: false; reason: string };

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
