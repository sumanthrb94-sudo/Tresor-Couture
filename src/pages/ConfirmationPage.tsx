import React from 'react';
import { CheckCircle2, Package } from 'lucide-react';
import { useOrders } from '../context/OrderContext';
import { useRouter } from '../context/RouterContext';
import { formatINR } from '../constants';
import FabricImage from '../components/FabricImage';

interface Props {
  orderId: string;
}

const ConfirmationPage: React.FC<Props> = ({ orderId }) => {
  const { getOrder } = useOrders();
  const { navigate } = useRouter();
  const order = getOrder(orderId);

  if (!order) {
    return (
      <main className="pt-32 md:pt-[160px] pb-20 md:pb-[120px] min-h-screen text-center px-5">
        <h1 className="font-serif text-3xl md:text-4xl gold-text mb-4">Order not found</h1>
        <button onClick={() => navigate({ name: 'shop' })} className="btn-gold">Back to Shop</button>
      </main>
    );
  }

  const placedDate = new Date(order.placedAt);
  const eta = new Date(placedDate.getTime() + 6 * 24 * 60 * 60 * 1000);

  return (
    <main className="flex-grow pt-24 md:pt-[120px] pb-20 md:pb-[120px] px-5 md:px-16 max-w-3xl mx-auto w-full">
      <div className="text-center mb-10 md:mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-brand-surface border border-brand-gold mb-5 md:mb-6">
          <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10 text-brand-gold" />
        </div>
        <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-gold mb-3 block">
          Order Confirmed
        </span>
        <h1 className="font-serif text-[36px] md:text-[48px] gold-text mb-3 md:mb-4 leading-tight">
          Thank you, {order.shippingAddress.fullName.split(' ')[0]}
        </h1>
        <p className="text-sm md:text-base text-brand-ink-soft max-w-lg mx-auto">
          Your weaves are being prepared by hand. A confirmation has been sent to{' '}
          <span className="text-brand-ink">{order.shippingAddress.email}</span>.
        </p>
      </div>

      <div className="bg-brand-bg-soft border border-brand-outline/30 p-6 md:p-8 mb-6 md:mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 pb-8 border-b border-brand-outline/30">
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-ink-soft mb-2">Order Number</p>
            <p className="font-serif text-xl">{order.id}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-ink-soft mb-2">Placed</p>
            <p>{placedDate.toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-ink-soft mb-2">Estimated Delivery</p>
            <p>{eta.toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-ink-soft mb-2">Payment</p>
            <p className="capitalize">{order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod}</p>
          </div>
        </div>

        <h2 className="font-serif text-xl mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-brand-gold" /> Your Weaves
        </h2>
        <ul className="space-y-4 mb-8">
          {order.items.map(item => (
            <li key={`${item.fabricId}-${item.color ?? ''}`} className="flex gap-4 pb-4 border-b border-brand-outline/30 last:border-b-0 last:pb-0">
              <FabricImage
                photo={item.fabricSnapshot.photo ?? item.fabricSnapshot.image}
                fallback={item.fabricSnapshot.image}
                alt={item.fabricSnapshot.name}
                className="w-16 h-16 object-cover border border-brand-outline/30"
              />
              <div className="flex-1 min-w-0">
                <p className="font-serif text-lg">{item.fabricSnapshot.name}</p>
                <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-brand-ink-soft mt-1">
                  {item.meters} m{item.color ? ` · ${item.color}` : ''} · {item.fabricSnapshot.origin}
                </p>
              </div>
              <p className="text-base font-medium whitespace-nowrap">
                {formatINR(item.meters * item.fabricSnapshot.pricePerMeter)}
              </p>
            </li>
          ))}
        </ul>

        <dl className="space-y-2 text-base border-t border-brand-outline/30 pt-4">
          <div className="flex justify-between"><dt className="text-brand-ink-soft">Subtotal</dt><dd>{formatINR(order.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-brand-ink-soft">Shipping</dt><dd>{order.shipping === 0 ? 'Free' : formatINR(order.shipping)}</dd></div>
          <div className="flex justify-between"><dt className="text-brand-ink-soft">GST</dt><dd>{formatINR(order.tax)}</dd></div>
          <div className="flex justify-between font-serif text-xl pt-3 border-t border-brand-gold/20 mt-2">
            <dt>Total</dt>
            <dd className="gold-text">{formatINR(order.total)}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-brand-bg-soft border border-brand-outline/30 p-6 md:p-8 mb-6 md:mb-8">
        <h2 className="text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-ink-soft mb-4">Shipping To</h2>
        <p className="text-base leading-relaxed">
          {order.shippingAddress.fullName}<br />
          {order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}<br />
          {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />
          {order.shippingAddress.country}<br />
          <span className="text-brand-ink-soft">{order.shippingAddress.phone}</span>
        </p>
      </div>

      <div className="text-center">
        <button onClick={() => navigate({ name: 'shop' })} className="btn-gold">Continue Browsing</button>
      </div>
    </main>
  );
};

export default ConfirmationPage;
