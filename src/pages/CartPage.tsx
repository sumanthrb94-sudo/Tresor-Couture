import React, { useState } from 'react';
import { Gift, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useRouter } from '../context/RouterContext';
import { formatINR, FREE_SHIPPING_THRESHOLD } from '../constants';
import FabricImage from '../components/FabricImage';

const CartPage: React.FC = () => {
  const { resolved, updateMeters, removeItem, subtotal, shipping, tax, total, clear } = useCart();
  const { navigate } = useRouter();
  const [giftMessage, setGiftMessage] = useState('');

  if (resolved.length === 0) {
    return (
      <section className="pt-32 md:pt-[160px] pb-20 md:pb-[120px] min-h-screen">
        <div className="max-w-2xl mx-auto text-center px-5">
          <ShoppingBag className="w-12 h-12 mx-auto text-brand-ink-soft/40 mb-6" />
          <h1 className="font-serif text-[36px] md:text-5xl text-brand-gold mb-4 leading-tight">Your Bag is Empty</h1>
          <p className="text-brand-ink-soft mb-10">
            Begin with a single bolt. Cut to length, dispatched with care.
          </p>
          <button onClick={() => navigate({ name: 'shop' })} className="btn-gold">
            Browse the Atelier
          </button>
        </div>
      </section>
    );
  }

  const stockOf = (id: string) => {
    const r = resolved.find(({ fabric }) => fabric.id === id);
    return r?.fabric.inStockMeters ?? 999;
  };

  const remainingForFreeShip = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  return (
    <main className="flex-grow pt-24 md:pt-[120px] pb-20 md:pb-[120px] px-5 md:px-16 max-w-[1280px] mx-auto w-full">
      <div className="mb-10 md:mb-12 text-center md:text-left">
        <h1 className="font-serif text-[40px] md:text-[48px] gold-text mb-3 md:mb-4">Your Bag</h1>
        <p className="text-sm md:text-base text-brand-ink-soft">
          Review your selections before proceeding to checkout.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8">
        {/* Items */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {resolved.map(({ item, fabric }) => {
            const lineTotal = item.meters * fabric.pricePerMeter;
            const stock = stockOf(fabric.id);
            const options: number[] = [];
            for (let i = 0.5; i <= Math.min(stock, 10); i += 0.5) options.push(i);
            return (
              <div
                key={`${fabric.id}-${item.color ?? ''}`}
                className="flex flex-row gap-4 md:gap-6 pb-6 md:pb-8 border-b border-brand-outline/30"
              >
                <button
                  onClick={() => navigate({ name: 'product', id: fabric.id })}
                  className="w-28 sm:w-32 md:w-48 aspect-square shrink-0 overflow-hidden bg-brand-surface block"
                >
                  <FabricImage
                    photo={fabric.photo}
                    fallback={fabric.image}
                    alt={fabric.name}
                    className="w-full h-full object-cover object-center"
                  />
                </button>
                <div className="flex-grow flex flex-col justify-between min-w-0">
                  <div className="flex justify-between items-start gap-3 mb-4">
                    <div className="min-w-0">
                      <button
                        onClick={() => navigate({ name: 'product', id: fabric.id })}
                        className="text-left"
                      >
                        <h3 className="font-serif text-lg md:text-2xl text-brand-ink mb-1 md:mb-2 leading-tight">{fabric.name}</h3>
                      </button>
                      <p className="text-[10px] md:text-[11px] uppercase tracking-[0.1em] text-brand-ink-soft mb-1 font-semibold">
                        SKU: {fabric.weaveType?.split(' ')[0].toUpperCase()}-{fabric.id.padStart(3, '0')}
                      </p>
                      <p className="text-sm md:text-base text-brand-ink-soft">
                        Cut: {item.meters} m{item.color ? ` · ${item.color}` : ''}
                      </p>
                    </div>
                    <p className="text-base md:text-lg text-brand-ink font-medium whitespace-nowrap shrink-0">
                      {formatINR(lineTotal)}
                    </p>
                  </div>
                  <div className="flex justify-between items-end gap-3">
                    <div className="flex items-center gap-4">
                      <label className="sr-only" htmlFor={`qty-${fabric.id}`}>Length</label>
                      <select
                        id={`qty-${fabric.id}`}
                        value={item.meters}
                        onChange={e => updateMeters(fabric.id, item.color, Number(e.target.value))}
                        className="input-underline text-sm md:text-base text-brand-ink py-1 pr-6 cursor-pointer"
                      >
                        {options.map(opt => (
                          <option key={opt} value={opt}>{opt} m</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => removeItem(fabric.id, item.color)}
                      className="text-[10px] md:text-[11px] uppercase tracking-[0.1em] font-semibold text-brand-ink-soft hover:text-red-700 transition-colors underline underline-offset-4"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex justify-between items-center -mt-2">
            <button
              onClick={() => navigate({ name: 'shop' })}
              className="text-[11px] uppercase tracking-[0.1em] font-semibold text-brand-ink-soft hover:text-brand-gold underline underline-offset-4"
            >
              Continue shopping
            </button>
            <button
              onClick={clear}
              className="text-[11px] uppercase tracking-[0.1em] font-semibold text-brand-ink-soft hover:text-brand-gold"
            >
              Clear bag
            </button>
          </div>

          {/* Gift message */}
          <div className="mt-6 md:mt-8 bg-brand-bg-soft p-6 md:p-8 border border-brand-outline/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-brand-gold" />
            <h4 className="font-serif text-xl md:text-2xl text-brand-ink mb-3 md:mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5 text-brand-gold shrink-0" />
              Personalized Artisanal Note
            </h4>
            <p className="text-sm md:text-base text-brand-ink-soft mb-5 md:mb-6 max-w-2xl">
              Elevate your order with a handwritten note on our signature textured cardstock,
              perfect for gifting to a fellow creator.
            </p>
            <div className="relative w-full max-w-xl">
              <label
                htmlFor="gift-message"
                className="block text-[11px] uppercase tracking-[0.1em] font-semibold text-brand-ink-soft mb-1"
              >
                Your Message
              </label>
              <textarea
                id="gift-message"
                value={giftMessage}
                onChange={e => setGiftMessage(e.target.value)}
                rows={3}
                className="input-underline text-base text-brand-ink"
                placeholder="Hand-written by our atelier…"
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        <aside className="lg:col-span-4">
          <div className="bg-brand-bg-soft p-6 md:p-8 lg:sticky lg:top-[120px] border border-brand-outline/30">
            <h2 className="font-serif text-xl md:text-2xl text-brand-ink mb-5 md:mb-6 border-b border-brand-outline/30 pb-4">
              Order Summary
            </h2>

            {remainingForFreeShip > 0 && (
              <p className="text-sm bg-brand-surface border border-brand-outline/30 p-3 mb-6 leading-relaxed">
                Add <span className="font-semibold">{formatINR(remainingForFreeShip)}</span> more for complimentary worldwide shipping.
              </p>
            )}

            <dl className="space-y-4 mb-8">
              <div className="flex justify-between">
                <dt className="text-base text-brand-ink-soft">Subtotal</dt>
                <dd className="text-base text-brand-ink">{formatINR(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-base text-brand-ink-soft">Shipping</dt>
                <dd className="text-base text-brand-ink">{shipping === 0 ? 'Free' : formatINR(shipping)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-base text-brand-ink-soft">GST</dt>
                <dd className="text-base text-brand-ink">{formatINR(tax)}</dd>
              </div>
            </dl>

            <div className="flex justify-between items-end mb-6 md:mb-8 pt-5 md:pt-6 border-t border-brand-gold/20">
              <span className="font-serif text-xl md:text-2xl text-brand-ink">Total</span>
              <span className="font-serif text-[28px] md:text-[32px] gold-text">{formatINR(total)}</span>
            </div>

            <button
              onClick={() => navigate({ name: 'checkout' })}
              className="btn-gold w-full mb-4"
            >
              Proceed to Checkout
            </button>
            <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-brand-ink-soft text-center">
              Secure Checkout
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default CartPage;
