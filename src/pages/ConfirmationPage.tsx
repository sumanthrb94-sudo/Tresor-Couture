import React, { useEffect, useState } from 'react';
import { CheckCircle2, MapPin, Package, Truck } from 'lucide-react';
import { ordersApi } from '../lib/firebase';
import { useRouter } from '../context/RouterContext';
import { formatINR } from '../constants';
import FabricImage from '../components/FabricImage';
import type { Order } from '../types';

interface Props {
  orderId: string;
}

const ConfirmationPage: React.FC<Props> = ({ orderId }) => {
  const { navigate } = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <h1 className="text-3xl font-extrabold mb-4">Order not found</h1>
        {error && <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mb-4">{error}</p>}
        <button onClick={() => navigate({ name: 'shop' })} className="btn-primary">Back to Shop</button>
      </main>
    );
  }

  const placed = new Date(order.placedAt);
  const eta = new Date(placed.getTime() + 6 * 86_400_000);

  return (
    <main className="pt-[100px] pb-12 md:pb-16 bg-[color:var(--color-myntra-bg-soft)] min-h-screen">
      <div className="max-w-[920px] mx-auto px-4 md:px-8 lg:px-10">
        {/* Hero */}
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-6 md:p-10 text-center mb-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[color:var(--color-myntra-green)]/10 mb-4">
            <CheckCircle2 className="w-9 h-9 text-[color:var(--color-myntra-green)]" />
          </div>
          <p className="text-[12px] font-extrabold tracking-[0.15em] uppercase text-[color:var(--color-myntra-green)] mb-2">Order Confirmed</p>
          <h1 className="text-2xl md:text-3xl font-extrabold mb-2">
            Thank you, {order.shippingAddress.fullName.split(' ')[0] || 'Friend'}!
          </h1>
          <p className="text-[14px] text-[color:var(--color-myntra-ink-soft)] max-w-md mx-auto">
            Your weaves are being prepared by hand. A confirmation email has been sent to{' '}
            <span className="text-[color:var(--color-myntra-navy)] font-semibold">{order.shippingAddress.email}</span>.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-7 pt-7 border-t border-[color:var(--color-myntra-border-soft)] text-left">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1">Order ID</p>
              <p className="text-[14px] font-bold break-all">{order.id}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1">Placed On</p>
              <p className="text-[14px]">{placed.toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1">Est. Delivery</p>
              <p className="text-[14px]">{eta.toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-1">Payment</p>
              <p className="text-[14px] capitalize">{order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod}</p>
            </div>
          </div>
        </div>

        {/* Tracking strip */}
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-5 mb-5">
          <p className="text-[12px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-3">Order Status</p>
          <div className="relative grid grid-cols-4 gap-2 text-center">
            {['Placed', 'Hand-cut', 'Shipped', 'Delivered'].map((s, i) => (
              <div key={s}>
                <div className={`w-7 h-7 rounded-full mx-auto flex items-center justify-center text-[12px] font-bold ${i === 0 ? 'bg-[color:var(--color-myntra-green)] text-white' : 'bg-[color:var(--color-myntra-bg-soft)] text-[color:var(--color-myntra-ink-mute)]'}`}>
                  {i === 0 ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <p className={`text-[11px] mt-1.5 font-semibold ${i === 0 ? 'text-[color:var(--color-myntra-navy)]' : 'text-[color:var(--color-myntra-ink-mute)]'}`}>{s}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Items */}
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-5 mb-5">
          <h2 className="text-[14px] font-extrabold uppercase tracking-wider mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-[color:var(--color-myntra-pink)]" /> Items in this Order
          </h2>
          <ul className="space-y-3">
            {order.items.map((it, idx) => (
              <li key={`${it.fabricId}-${idx}`} className="flex gap-3 pb-3 border-b border-[color:var(--color-myntra-border-soft)] last:border-b-0 last:pb-0">
                <FabricImage photo={it.fabricSnapshot.photo} fallback={it.fabricSnapshot.image} alt={it.fabricSnapshot.name} className="w-16 h-20 object-cover bg-[color:var(--color-myntra-bg-soft)]" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate">{it.fabricSnapshot.brand}</p>
                  <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] truncate">{it.fabricSnapshot.name}</p>
                  <p className="text-[12px] text-[color:var(--color-myntra-ink-mute)] mt-0.5">{it.meters} m{it.color ? ` · ${it.color}` : ''} · {it.fabricSnapshot.origin}</p>
                </div>
                <p className="text-[14px] font-bold whitespace-nowrap">
                  {formatINR(it.meters * it.fabricSnapshot.pricePerMeter)}
                </p>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 mt-4 pt-4 border-t border-[color:var(--color-myntra-border-soft)] text-[14px]">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(order.subtotal)}</dd></div>
            {order.couponCode && (
              <div className="flex justify-between"><dt>Coupon · {order.couponCode}</dt><dd className="text-[color:var(--color-myntra-green)]">- {formatINR(order.couponDiscount ?? 0)}</dd></div>
            )}
            <div className="flex justify-between"><dt>Shipping</dt><dd className={order.shipping === 0 ? 'text-[color:var(--color-myntra-green)] font-bold' : ''}>{order.shipping === 0 ? 'FREE' : formatINR(order.shipping)}</dd></div>
            <div className="flex justify-between"><dt>GST</dt><dd>{formatINR(order.tax)}</dd></div>
            <div className="flex justify-between font-extrabold pt-3 border-t border-[color:var(--color-myntra-border)] mt-2">
              <dt>Total Paid</dt><dd>{formatINR(order.total)}</dd>
            </div>
          </dl>
        </div>

        {/* Address */}
        <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-5 mb-6">
          <h2 className="text-[14px] font-extrabold uppercase tracking-wider mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[color:var(--color-myntra-pink)]" /> Shipping Address
          </h2>
          <p className="text-[14px] leading-relaxed">
            <span className="font-bold">{order.shippingAddress.fullName}</span><br />
            {order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}<br />
            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />
            {order.shippingAddress.country}<br />
            <span className="text-[color:var(--color-myntra-ink-soft)]">{order.shippingAddress.phone}</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => navigate({ name: 'shop' })} className="btn-primary inline-flex items-center justify-center gap-2">
            <Truck className="w-4 h-4" /> Continue Shopping
          </button>
          <button onClick={() => navigate({ name: 'home' })} className="btn-outline">Back to Home</button>
        </div>
      </div>
    </main>
  );
};

export default ConfirmationPage;
