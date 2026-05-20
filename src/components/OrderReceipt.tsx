import React from 'react';
import { Printer } from 'lucide-react';
import { formatINR } from '../constants';
import FabricImage from './FabricImage';
import type { Order } from '../types';

interface Props {
  order: Order;
}

const paymentLabel = (m: Order['paymentMethod']): string => {
  switch (m) {
    case 'cod': return 'Cash on Delivery';
    case 'upi': return 'UPI';
    case 'card': return 'Card';
  }
};

const OrderReceipt: React.FC<Props> = ({ order }) => {
  const placedISO = new Date(order.placedAt).toISOString();
  const placedHuman = new Date(order.placedAt).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  const shortHash = `TC-${order.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6) || order.id.slice(0, 6)}`;

  return (
    <section className="receipt bg-white border border-[color:var(--color-myntra-border-soft)] print:border-0">
      {/* Print stylesheet: hide chrome (nav, footer, modals, page hero & buttons),
          force white background, target A4 paper. */}
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          html, body { background: #fff !important; }
          body * { visibility: hidden !important; }
          .receipt, .receipt * { visibility: visible !important; }
          .receipt {
            position: absolute !important;
            inset: 0 !important;
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            font-size: 12px;
            background: #fff !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="px-6 py-5 sm:px-8 sm:py-7 max-w-[800px] mx-auto">
        {/* Print toolbar — hidden when printing */}
        <div className="no-print flex justify-end mb-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-outline inline-flex items-center gap-2 text-[12px]"
          >
            <Printer className="w-4 h-4" /> Print receipt
          </button>
        </div>

        {/* Brand mark */}
        <header className="flex items-start justify-between border-b border-[color:var(--color-myntra-border)] pb-4 mb-4">
          <div>
            <p className="font-serif text-[22px] font-extrabold text-[color:var(--color-myntra-navy)] tracking-wide">
              Tresor Couture
            </p>
            <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)] uppercase tracking-[0.2em]">
              Hand-woven · Atelier-cut
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)]">Receipt</p>
            <p className="font-mono text-[13px] font-bold">{shortHash}</p>
            <p className="text-[10px] text-[color:var(--color-myntra-ink-mute)] break-all mt-0.5">{order.id}</p>
          </div>
        </header>

        {/* Meta */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5 text-[12px]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1">Placed</p>
            <p>{placedHuman}</p>
            <p className="text-[10px] text-[color:var(--color-myntra-ink-mute)] mt-0.5">{placedISO}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1">Payment</p>
            <p>{paymentLabel(order.paymentMethod)}</p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1">Status</p>
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[color:var(--color-myntra-green)]/10 text-[color:var(--color-myntra-green)] border border-[color:var(--color-myntra-green)]/30">
              {order.status ?? 'placed'}
            </span>
          </div>
        </div>

        {/* Items table */}
        <div className="border border-[color:var(--color-myntra-border-soft)] mb-5 overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-[color:var(--color-myntra-bg-soft)] text-left uppercase tracking-wider text-[10px] text-[color:var(--color-myntra-ink-soft)]">
              <tr>
                <th className="px-3 py-2 font-bold">Item</th>
                <th className="px-3 py-2 font-bold">Colour</th>
                <th className="px-3 py-2 font-bold text-right">Metres</th>
                <th className="px-3 py-2 font-bold text-right">Rate / m</th>
                <th className="px-3 py-2 font-bold text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, idx) => {
                const rate = it.fabricSnapshot.pricePerMeter;
                return (
                  <tr key={`${it.fabricId}-${idx}`} className="border-t border-[color:var(--color-myntra-border-soft)] align-top">
                    <td className="px-3 py-2">
                      <div className="flex gap-3 items-start">
                        <FabricImage
                          photo={it.fabricSnapshot.photo}
                          fallback={it.fabricSnapshot.image}
                          alt={it.fabricSnapshot.name}
                          className="w-10 h-12 object-cover bg-[color:var(--color-myntra-bg-soft)] flex-shrink-0 print:hidden"
                        />
                        <div className="min-w-0">
                          <p className="font-bold">{it.fabricSnapshot.brand}</p>
                          <p className="text-[color:var(--color-myntra-ink-soft)]">{it.fabricSnapshot.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">{it.color ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{it.meters}</td>
                    <td className="px-3 py-2 text-right">{formatINR(rate)}</td>
                    <td className="px-3 py-2 text-right font-bold">{formatINR(rate * it.meters)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1.5">Ship to</p>
            <address className="not-italic text-[12px] leading-relaxed">
              <span className="font-bold">{order.shippingAddress.fullName}</span><br />
              {order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}<br />
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />
              {order.shippingAddress.country}<br />
              <span className="text-[color:var(--color-myntra-ink-soft)]">{order.shippingAddress.phone}</span><br />
              <span className="text-[color:var(--color-myntra-ink-soft)]">{order.shippingAddress.email}</span>
            </address>
          </div>

          <dl className="text-[12px] space-y-1.5 sm:justify-self-end sm:min-w-[240px]">
            <div className="flex justify-between gap-6"><dt>Subtotal</dt><dd>{formatINR(order.subtotal)}</dd></div>
            {order.couponCode && (
              <div className="flex justify-between gap-6">
                <dt>Coupon · {order.couponCode}</dt>
                <dd className="text-[color:var(--color-myntra-green)]">- {formatINR(order.couponDiscount ?? 0)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-6">
              <dt>Shipping</dt>
              <dd>{order.shipping === 0 ? 'FREE' : formatINR(order.shipping)}</dd>
            </div>
            <div className="flex justify-between gap-6"><dt>GST</dt><dd>{formatINR(order.tax)}</dd></div>
            <div className="flex justify-between gap-6 pt-2 mt-2 border-t border-[color:var(--color-myntra-border)] font-extrabold text-[14px]">
              <dt>Total</dt><dd>{formatINR(order.total)}</dd>
            </div>
          </dl>
        </div>

        <footer className="mt-8 pt-4 border-t border-dashed border-[color:var(--color-myntra-border)] text-center text-[10px] text-[color:var(--color-myntra-ink-mute)]">
          <p className="font-bold text-[color:var(--color-myntra-ink-soft)] mb-1">Sold by Tresor Atelier, Hyderabad</p>
          <p>Thank you for choosing Tresor Couture. For assistance with this order, quote receipt <span className="font-mono font-bold">{shortHash}</span> when contacting our atelier concierge.</p>
        </footer>
      </div>
    </section>
  );
};

export default OrderReceipt;
