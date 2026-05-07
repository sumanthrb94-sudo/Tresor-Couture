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
      <section className="pt-[160px] pb-32 min-h-screen text-center px-6">
        <h1 className="text-3xl font-serif italic mb-4">Order not found</h1>
        <button
          onClick={() => navigate({ name: 'shop' })}
          className="text-[10px] uppercase tracking-widest underline"
        >
          Back to Shop
        </button>
      </section>
    );
  }

  const placedDate = new Date(order.placedAt);
  const eta = new Date(placedDate.getTime() + 6 * 24 * 60 * 60 * 1000);

  return (
    <section className="pt-[140px] pb-32 min-h-screen bg-brand-bg">
      <div className="max-w-3xl mx-auto px-6 md:px-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-accent border border-brand-gold mb-6">
            <CheckCircle2 className="w-10 h-10 text-brand-gold" />
          </div>
          <span className="text-[9px] uppercase tracking-[0.4em] text-brand-gold font-bold mb-3 block">
            Order Confirmed
          </span>
          <h1 className="text-4xl md:text-5xl font-serif mb-4">
            Thank you, <span className="italic">{order.shippingAddress.fullName.split(' ')[0]}</span>
          </h1>
          <p className="text-brand-ink/60 max-w-lg mx-auto">
            Your weaves are being prepared by hand. A confirmation has been sent to{' '}
            <span className="text-brand-ink">{order.shippingAddress.email}</span>.
          </p>
        </div>

        <div className="border border-brand-border bg-white p-8 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 pb-8 border-b border-brand-border">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-brand-ink/50 mb-2">Order Number</p>
              <p className="font-serif text-xl">{order.id}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-brand-ink/50 mb-2">Placed</p>
              <p>{placedDate.toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-brand-ink/50 mb-2">Estimated Delivery</p>
              <p>{eta.toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-brand-ink/50 mb-2">Payment</p>
              <p className="capitalize">
                {order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod}
              </p>
            </div>
          </div>

          <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-brand-gold" /> Your Weaves
          </h2>
          <ul className="space-y-4 mb-8">
            {order.items.map(item => (
              <li
                key={`${item.fabricId}-${item.color ?? ''}`}
                className="flex gap-4 pb-4 border-b border-brand-border last:border-b-0 last:pb-0"
              >
                <FabricImage
                  photo={item.fabricSnapshot.photo ?? item.fabricSnapshot.image}
                  fallback={item.fabricSnapshot.image}
                  alt={item.fabricSnapshot.name}
                  className="w-16 h-16 object-cover border border-brand-border"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-serif italic">{item.fabricSnapshot.name}</p>
                  <p className="text-[10px] uppercase tracking-widest text-brand-ink/50 mt-1">
                    {item.meters} m{item.color ? ` · ${item.color}` : ''} · {item.fabricSnapshot.origin}
                  </p>
                </div>
                <p className="font-medium whitespace-nowrap">
                  {formatINR(item.meters * item.fabricSnapshot.pricePerMeter)}
                </p>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 text-sm border-t border-brand-border pt-4">
            <div className="flex justify-between">
              <dt className="text-brand-ink/60">Subtotal</dt>
              <dd>{formatINR(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-brand-ink/60">Shipping</dt>
              <dd>{order.shipping === 0 ? 'Free' : formatINR(order.shipping)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-brand-ink/60">GST</dt>
              <dd>{formatINR(order.tax)}</dd>
            </div>
            <div className="flex justify-between font-semibold pt-3 border-t border-brand-border mt-2">
              <dt>Total</dt>
              <dd className="text-lg">{formatINR(order.total)}</dd>
            </div>
          </dl>
        </div>

        <div className="border border-brand-border bg-white p-8 mb-8">
          <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold mb-4">Shipping To</h2>
          <p className="text-sm leading-relaxed">
            {order.shippingAddress.fullName}<br />
            {order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}<br />
            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />
            {order.shippingAddress.country}<br />
            <span className="text-brand-ink/60">{order.shippingAddress.phone}</span>
          </p>
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate({ name: 'shop' })}
            className="bg-brand-ink text-white px-10 py-4 text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-brand-gold transition-colors duration-500"
          >
            Continue Browsing
          </button>
        </div>
      </div>
    </section>
  );
};

export default ConfirmationPage;
