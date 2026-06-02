import React from 'react';
import { Printer } from 'lucide-react';
import { formatINR } from '../constants';
import { BUSINESS, DEFAULT_HSN } from '../lib/business';
import { gstBreakdown, invoiceNumber, rupeesInWords } from '../lib/invoice';
import type { Order } from '../types';

/**
 * A4 GST tax invoice, derived entirely from an Order. Mirrors OrderReceipt's
 * print approach (a scoped @media print block + window.print so the user can
 * "Save as PDF"); adds the statutory fields an Indian tax invoice needs:
 * seller GSTIN, buyer, invoice no/date, place of supply, per-line HSN, taxable
 * value, and the CGST/SGST (intra-state) or IGST (inter-state) split.
 */
const TaxInvoice: React.FC<{ order: Order }> = ({ order }) => {
  const invNo = invoiceNumber(order);
  const gst = gstBreakdown(order);
  const placedHuman = new Date(order.placedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' });
  const halfRate = (gst.ratePercent / 2).toFixed(gst.ratePercent % 2 === 0 ? 0 : 1);

  return (
    <section className="receipt bg-white border border-[color:var(--color-myntra-border-soft)] print:border-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          html, body { background: #fff !important; }
          body * { visibility: hidden !important; }
          .receipt, .receipt * { visibility: visible !important; }
          .receipt { position: absolute !important; inset: 0 !important; box-shadow: none !important; border: none !important; max-width: 100% !important; font-size: 12px; background: #fff !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="px-6 py-5 sm:px-8 sm:py-7 max-w-[820px] mx-auto">
        <div className="no-print flex justify-end mb-4">
          <button type="button" onClick={() => window.print()} className="btn-outline inline-flex items-center gap-2 text-[12px]">
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>
        </div>

        {/* Heading */}
        <div className="text-center border-b border-[color:var(--color-myntra-border)] pb-3 mb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--color-myntra-ink-soft)]">Tax Invoice</p>
          <p className="font-serif text-[22px] font-extrabold text-[color:var(--color-myntra-navy)] tracking-wide mt-0.5">{BUSINESS.brandName}</p>
        </div>

        {/* Seller / invoice meta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 text-[12px]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1">Sold by</p>
            <p className="font-bold">{BUSINESS.legalName}</p>
            <address className="not-italic leading-relaxed text-[color:var(--color-myntra-ink-soft)]">
              {BUSINESS.addressLines.map((l, i) => <React.Fragment key={i}>{l}<br /></React.Fragment>)}
            </address>
            <p className="mt-1"><span className="font-semibold">GSTIN:</span> {BUSINESS.gstin}</p>
            <p><span className="font-semibold">PAN:</span> {BUSINESS.pan}</p>
          </div>
          <div className="sm:text-right">
            <p><span className="font-semibold">Invoice No:</span> <span className="font-mono">{invNo}</span></p>
            <p><span className="font-semibold">Invoice Date:</span> {placedHuman}</p>
            <p><span className="font-semibold">Order ID:</span> <span className="font-mono text-[11px]">{order.id}</span></p>
            <p className="mt-1"><span className="font-semibold">Place of Supply:</span> {order.shippingAddress.state || '—'}</p>
            <p><span className="font-semibold">Payment:</span> {order.paymentMethod.toUpperCase()} · {order.paymentStatus ?? 'pending'}</p>
          </div>
        </div>

        {/* Bill to */}
        <div className="mb-5 text-[12px]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1">Bill to / Ship to</p>
          <address className="not-italic leading-relaxed">
            <span className="font-bold">{order.shippingAddress.fullName}</span><br />
            {order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}<br />
            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}, {order.shippingAddress.country}<br />
            <span className="text-[color:var(--color-myntra-ink-soft)]">{order.shippingAddress.phone} · {order.shippingAddress.email}</span>
          </address>
        </div>

        {/* Line items */}
        <div className="border border-[color:var(--color-myntra-border-soft)] mb-4 overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-[color:var(--color-myntra-bg-soft)] text-left uppercase tracking-wider text-[10px] text-[color:var(--color-myntra-ink-soft)]">
              <tr>
                <th className="px-3 py-2 font-bold">#</th>
                <th className="px-3 py-2 font-bold">Item</th>
                <th className="px-3 py-2 font-bold">HSN</th>
                <th className="px-3 py-2 font-bold text-right">Qty</th>
                <th className="px-3 py-2 font-bold text-right">Rate</th>
                <th className="px-3 py-2 font-bold text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, idx) => {
                const rate = it.fabricSnapshot?.price ?? 0;
                const qty = it.quantity ?? 0;
                return (
                  <tr key={`${it.fabricId}-${idx}`} className="border-t border-[color:var(--color-myntra-border-soft)] align-top">
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <span className="font-semibold">{it.fabricSnapshot?.name ?? 'Item'}</span>
                      {it.color ? <span className="text-[color:var(--color-myntra-ink-soft)]"> · {it.color}</span> : ''}
                    </td>
                    <td className="px-3 py-2 font-mono">{DEFAULT_HSN}</td>
                    <td className="px-3 py-2 text-right">{qty}</td>
                    <td className="px-3 py-2 text-right">{formatINR(rate)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatINR(rate * qty)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="text-[11px] text-[color:var(--color-myntra-ink-soft)]">
            <p className="font-semibold text-[color:var(--color-myntra-navy)] mb-1">Amount in words</p>
            <p className="italic">{rupeesInWords(order.total)}</p>
          </div>
          <dl className="text-[12px] space-y-1.5 sm:justify-self-end sm:min-w-[260px]">
            <div className="flex justify-between gap-6"><dt>Taxable value</dt><dd>{formatINR(gst.taxableValue)}</dd></div>
            {order.couponCode && (
              <div className="flex justify-between gap-6 text-[color:var(--color-myntra-green)]">
                <dt>Discount · {order.couponCode}</dt><dd>- {formatINR(order.couponDiscount ?? 0)}</dd>
              </div>
            )}
            {gst.isInterState ? (
              <div className="flex justify-between gap-6"><dt>IGST @ {gst.ratePercent}%</dt><dd>{formatINR(gst.igst)}</dd></div>
            ) : (
              <>
                <div className="flex justify-between gap-6"><dt>CGST @ {halfRate}%</dt><dd>{formatINR(gst.cgst)}</dd></div>
                <div className="flex justify-between gap-6"><dt>SGST @ {halfRate}%</dt><dd>{formatINR(gst.sgst)}</dd></div>
              </>
            )}
            <div className="flex justify-between gap-6"><dt>Shipping</dt><dd>{order.shipping === 0 ? 'FREE' : formatINR(order.shipping)}</dd></div>
            <div className="flex justify-between gap-6 pt-2 mt-2 border-t border-[color:var(--color-myntra-border)] font-extrabold text-[14px]">
              <dt>Total</dt><dd>{formatINR(order.total)}</dd>
            </div>
          </dl>
        </div>

        <footer className="mt-8 pt-4 border-t border-dashed border-[color:var(--color-myntra-border)] text-[10px] text-[color:var(--color-myntra-ink-mute)]">
          <p className="mb-1">Whether GST is payable on reverse charge basis: No. This is a computer-generated invoice and does not require a physical signature.</p>
          <p className="font-bold text-[color:var(--color-myntra-ink-soft)]">{BUSINESS.legalName} · {BUSINESS.email} · {BUSINESS.website}</p>
        </footer>
      </div>
    </section>
  );
};

export default TaxInvoice;
