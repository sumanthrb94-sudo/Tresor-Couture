import React, { useEffect, useState } from 'react';
import { CheckCircle2, ShoppingBag, Sparkles, Truck } from 'lucide-react';
import { ordersApi } from '../lib/firebase';
import { useRouter } from '../context/RouterContext';
import OrderReceipt from '../components/OrderReceipt';
import TaxInvoice from '../components/TaxInvoice';
import type { Order } from '../types';

interface Props {
  orderId: string;
}

/**
 * Returns a Date that is `businessDays` weekdays after `from`.
 * Weekends (Sat/Sun) are skipped — used for couture lead-time estimates.
 */
const addBusinessDays = (from: Date, businessDays: number): Date => {
  const d = new Date(from.getTime());
  let added = 0;
  while (added < businessDays) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return d;
};

const computeEta = (order: Order): Date => {
  const placed = new Date(order.placedAt);
  // Studio Prêt and Sarees ship as stocked couture pieces with longer cuts.
  const longLead = order.items.some(it => {
    const mc = it.fabricSnapshot.masterCategory;
    return mc === 'Studios Prêt' || mc === 'Sarees';
  });
  return addBusinessDays(placed, longLead ? 14 : 5);
};

const ConfirmationPage: React.FC<Props> = ({ orderId }) => {
  const { navigate } = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docView, setDocView] = useState<'receipt' | 'invoice'>('receipt');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    ordersApi
      .get(orderId)
      .then(res => {
        if (cancelled) return;
        setOrder((res as Order | null) ?? null);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load this order.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (loading) {
    return (
      <main className="pt-[140px] pb-20 min-h-screen text-center px-5 bg-white">
        <div className="inline-flex flex-col items-center gap-3 text-[color:var(--color-myntra-ink-soft)]">
          <span className="inline-block w-7 h-7 border-2 border-[color:var(--color-myntra-border)] border-t-[color:var(--color-myntra-pink)] rounded-full animate-spin" aria-hidden />
          <p className="text-[14px] font-semibold">Confirming your order…</p>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="pt-[140px] pb-20 min-h-screen text-center px-5 bg-white">
        <h1 className="text-3xl font-extrabold mb-2 text-[color:var(--color-myntra-navy)]">
          We couldn't find that order
        </h1>
        <p className="text-[14px] text-[color:var(--color-myntra-ink-soft)] max-w-md mx-auto mb-6">
          {error
            ? error
            : 'The order may have been placed under a different account, or the link may have expired.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button onClick={() => navigate({ name: 'account', tab: 'orders' })} className="btn-primary">
            View my orders
          </button>
          <button onClick={() => navigate({ name: 'shop' })} className="btn-outline">
            Back to shop
          </button>
        </div>
      </main>
    );
  }

  const eta = computeEta(order);
  const etaLabel = eta.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  // Short, human-friendly receipt hash for the hero — keeps the long Firestore
  // id off the page chrome while still being unique enough to read aloud.
  const shortHash = `TC-${order.id.slice(-8).toUpperCase()}`;

  return (
    <main className="pt-[100px] md:pt-[112px] pb-12 md:pb-16 bg-[color:var(--color-myntra-bg-soft)] min-h-screen">
      <div className="max-w-[920px] mx-auto px-4 md:px-8 lg:px-10">
        {/* Hero */}
        <section className="no-print bg-white border border-[color:var(--color-myntra-border-soft)] p-8 md:p-12 text-center mb-5 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 opacity-10 pointer-events-none" aria-hidden>
            <Sparkles className="w-48 h-48 text-[color:var(--color-myntra-gold)]" />
          </div>

          <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-[color:var(--color-myntra-green)]/10 mb-5">
            <span className="absolute inset-0 rounded-full bg-[color:var(--color-myntra-green)]/20 animate-ping" aria-hidden />
            <CheckCircle2 className="w-14 h-14 text-[color:var(--color-myntra-green)] relative" />
          </div>

          <p className="text-[11px] font-extrabold tracking-[0.2em] uppercase text-[color:var(--color-myntra-green)] mb-2">
            Order confirmed
          </p>
          <h1 className="font-serif text-3xl md:text-4xl font-extrabold mb-2 text-[color:var(--color-myntra-navy)]">
            Your atelier is on it.
          </h1>
          <p className="font-mono text-[12px] tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-3">
            Receipt <span data-testid="order-id" className="text-[color:var(--color-myntra-navy)] font-bold">{shortHash}</span>
          </p>
          <p className="text-[14px] text-[color:var(--color-myntra-ink-soft)] max-w-md mx-auto">
            Thank you{order.shippingAddress.fullName ? `, ${order.shippingAddress.fullName.split(' ')[0]}` : ''}. A confirmation has been emailed to{' '}
            <span className="text-[color:var(--color-myntra-navy)] font-semibold">{order.shippingAddress.email}</span>.
          </p>

          <div className="mt-7 inline-flex items-center gap-2 bg-[color:var(--color-myntra-bg-soft)] border border-[color:var(--color-myntra-border-soft)] px-4 py-2 rounded-full">
            <Truck className="w-4 h-4 text-[color:var(--color-myntra-pink)]" aria-hidden />
            <span className="text-[12px] font-bold">
              Estimated delivery · <span className="text-[color:var(--color-myntra-navy)]">{etaLabel}</span>
            </span>
          </div>

          <div className="mt-7 flex flex-col sm:flex-row gap-2 justify-center no-print">
            <button
              onClick={() => navigate({ name: 'account', tab: 'orders' })}
              className="btn-primary inline-flex items-center justify-center gap-2"
            >
              <Truck className="w-4 h-4" /> Track order
            </button>
            <button
              onClick={() => navigate({ name: 'shop' })}
              className="btn-outline inline-flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" /> Continue shopping
            </button>
          </div>
        </section>

        {/* Receipt / GST tax invoice toggle */}
        <div className="no-print flex justify-center gap-1 mb-3 bg-white border border-[color:var(--color-myntra-border-soft)] rounded-full p-1 w-fit mx-auto">
          <button
            onClick={() => setDocView('receipt')}
            className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition-colors ${docView === 'receipt' ? 'bg-[color:var(--color-myntra-pink)] text-white' : 'text-[color:var(--color-myntra-ink-soft)]'}`}
          >
            Receipt
          </button>
          <button
            onClick={() => setDocView('invoice')}
            className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition-colors ${docView === 'invoice' ? 'bg-[color:var(--color-myntra-pink)] text-white' : 'text-[color:var(--color-myntra-ink-soft)]'}`}
          >
            Tax invoice
          </button>
        </div>

        {docView === 'receipt' ? <OrderReceipt order={order} /> : <TaxInvoice order={order} />}
      </div>
    </main>
  );
};

export default ConfirmationPage;
