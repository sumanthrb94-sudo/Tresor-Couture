/**
 * GST invoice maths, derived purely from an existing Order (no new storage).
 *
 * Product prices are tax-inclusive. The stored order.tax is the 5% GST
 * component already embedded in the post-coupon subtotal. Here we split that
 * figure into the CGST/SGST (intra-state) or IGST (inter-state) presentation
 * an Indian tax invoice requires, and mint a stable, human-readable invoice
 * number. Everything reconciles back to order.total by construction.
 */

import type { Order } from '../types';
import { BUSINESS, GST_RATE } from './business';

export interface GstBreakdown {
  /** Net taxable value (post-coupon subtotal). */
  taxableValue: number;
  /** True when buyer state differs from the seller's home state → IGST. */
  isInterState: boolean;
  cgst: number;
  sgst: number;
  igst: number;
  /** Total tax = cgst + sgst + igst === order.tax. */
  totalTax: number;
  ratePercent: number;
}

const norm = (s: string | undefined | null): string =>
  (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Split order.tax into CGST/SGST or IGST based on place of supply. */
export function gstBreakdown(order: Order): GstBreakdown {
  // order.subtotal is tax-inclusive; order.tax is the embedded GST component.
  const inclusiveValue = Math.max(0, (order.subtotal ?? 0) - (order.couponDiscount ?? 0));
  const totalTax = order.tax ?? 0;
  const taxableValue = inclusiveValue - totalTax;
  // Intra-state when the buyer's shipping state matches the seller's home state.
  const isInterState = norm(order.shippingAddress?.state) !== norm(BUSINESS.stateName);
  const ratePercent = Math.round(GST_RATE * 100);

  if (isInterState) {
    return { taxableValue, isInterState, cgst: 0, sgst: 0, igst: totalTax, totalTax, ratePercent };
  }
  // Half/half; give any odd rupee to CGST so the two halves still sum to total.
  const sgst = Math.floor(totalTax / 2);
  const cgst = totalTax - sgst;
  return { taxableValue, isInterState, cgst, sgst, igst: 0, totalTax, ratePercent };
}

/** Indian financial year (Apr–Mar) label for an ISO date, e.g. "2026-27". */
export function fiscalYear(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  // Months are 0-based; Jan(0)–Mar(2) belong to the FY that started last April.
  const startYear = d.getMonth() >= 3 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** Stable, readable invoice number: TC/<FY>/<6-char order tail>. */
export function invoiceNumber(order: Order): string {
  const tail = order.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || order.id.slice(0, 6).toUpperCase();
  return `TC/${fiscalYear(order.placedAt)}/${tail}`;
}

/* ---------- amount in words (Indian numbering) ---------- */

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? ` ${ONES[o]}` : '');
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(' ');
}

/** Convert a whole rupee amount to Indian-numbering words (Lakh/Crore). */
export function rupeesInWords(amount: number): string {
  const n = Math.round(amount);
  if (n === 0) return 'Zero Rupees Only';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = n % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));
  return `${parts.join(' ')} Rupees Only`;
}
