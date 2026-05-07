import React from 'react';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useRouter } from '../context/RouterContext';
import { formatINR, FREE_SHIPPING_THRESHOLD } from '../constants';

const CartPage: React.FC = () => {
  const { resolved, updateMeters, removeItem, subtotal, shipping, tax, total, clear } = useCart();
  const { navigate } = useRouter();

  if (resolved.length === 0) {
    return (
      <section className="pt-[160px] pb-32 min-h-screen bg-brand-bg">
        <div className="max-w-2xl mx-auto text-center px-6">
          <ShoppingBag className="w-12 h-12 mx-auto text-brand-ink/30 mb-6" />
          <h1 className="text-4xl font-serif italic mb-4">Your cart is empty</h1>
          <p className="text-brand-ink/60 mb-10">
            Begin with a single bolt. Cut to length, dispatched with care.
          </p>
          <button
            onClick={() => navigate({ name: 'shop' })}
            className="bg-brand-ink text-white px-10 py-4 text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-brand-gold transition-colors duration-500"
          >
            Browse the Atelier
          </button>
        </div>
      </section>
    );
  }

  const remainingForFreeShip = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  return (
    <section className="pt-[140px] pb-32 min-h-screen bg-brand-bg">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <h1 className="text-4xl md:text-5xl font-serif mb-12">
          Your <span className="italic">Cart</span>
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12">
          {/* Line items */}
          <div className="border border-brand-border bg-white">
            <div className="hidden md:grid grid-cols-[80px_1fr_140px_140px_40px] gap-4 px-6 py-4 border-b border-brand-border text-[10px] uppercase tracking-widest text-brand-ink/50">
              <span></span>
              <span>Item</span>
              <span>Length</span>
              <span className="text-right">Total</span>
              <span></span>
            </div>

            {resolved.map(({ item, fabric }) => {
              const lineTotal = item.meters * fabric.pricePerMeter;
              const stock = fabric.inStockMeters ?? 999;
              return (
                <div
                  key={`${fabric.id}-${item.color ?? ''}`}
                  className="grid grid-cols-[80px_1fr_auto] md:grid-cols-[80px_1fr_140px_140px_40px] gap-4 items-center px-6 py-6 border-b border-brand-border last:border-b-0"
                >
                  <button onClick={() => navigate({ name: 'product', id: fabric.id })} className="block">
                    <img
                      src={fabric.image}
                      alt={fabric.name}
                      loading="eager"
                      className="w-20 h-20 object-cover border border-brand-border"
                    />
                  </button>
                  <div className="min-w-0">
                    <button
                      onClick={() => navigate({ name: 'product', id: fabric.id })}
                      className="text-left"
                    >
                      <p className="font-serif italic text-lg leading-tight">{fabric.name}</p>
                    </button>
                    <p className="text-[10px] uppercase tracking-widest text-brand-ink/50 mt-1">
                      {fabric.origin}
                      {item.color ? ` · ${item.color}` : ''}
                    </p>
                    <p className="text-xs text-brand-ink/60 mt-1">{formatINR(fabric.pricePerMeter)} / m</p>
                  </div>

                  <div className="flex items-center border border-brand-border w-fit md:col-start-3">
                    <button
                      onClick={() => updateMeters(fabric.id, item.color, Math.max(0, item.meters - 0.5))}
                      className="px-3 py-2 hover:bg-brand-accent"
                      aria-label="Decrease length"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-3 py-2 text-sm min-w-[60px] text-center">{item.meters} m</span>
                    <button
                      onClick={() => updateMeters(fabric.id, item.color, Math.min(stock, item.meters + 0.5))}
                      className="px-3 py-2 hover:bg-brand-accent"
                      aria-label="Increase length"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <p className="font-medium md:text-right md:col-start-4">{formatINR(lineTotal)}</p>

                  <button
                    onClick={() => removeItem(fabric.id, item.color)}
                    className="text-brand-ink/40 hover:text-brand-gold md:col-start-5 justify-self-end"
                    aria-label="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}

            <div className="px-6 py-4 flex justify-between items-center">
              <button
                onClick={() => navigate({ name: 'shop' })}
                className="text-[10px] uppercase tracking-widest underline text-brand-ink/60 hover:text-brand-gold"
              >
                Continue shopping
              </button>
              <button
                onClick={clear}
                className="text-[10px] uppercase tracking-widest text-brand-ink/40 hover:text-brand-gold"
              >
                Clear cart
              </button>
            </div>
          </div>

          {/* Summary */}
          <aside className="border border-brand-border bg-white p-8 h-fit lg:sticky lg:top-[120px]">
            <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-gold mb-6">Order Summary</h2>

            {remainingForFreeShip > 0 && (
              <div className="bg-brand-accent/40 border border-brand-border p-3 mb-6 text-xs leading-relaxed">
                Add <span className="font-semibold">{formatINR(remainingForFreeShip)}</span> more for complimentary worldwide shipping.
              </div>
            )}

            <dl className="space-y-3 text-sm border-b border-brand-border pb-6 mb-6">
              <div className="flex justify-between">
                <dt className="text-brand-ink/60">Subtotal</dt>
                <dd>{formatINR(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-brand-ink/60">Shipping</dt>
                <dd>{shipping === 0 ? 'Free' : formatINR(shipping)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-brand-ink/60">GST (5%)</dt>
                <dd>{formatINR(tax)}</dd>
              </div>
            </dl>
            <div className="flex justify-between items-end mb-8">
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Total</span>
              <span className="text-2xl font-serif">{formatINR(total)}</span>
            </div>

            <button
              onClick={() => navigate({ name: 'checkout' })}
              className="w-full bg-brand-ink text-white py-4 text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-brand-gold transition-colors duration-500"
            >
              Proceed to Checkout
            </button>
            <p className="text-[10px] text-brand-ink/40 mt-4 text-center">
              Secure checkout · Concierge available
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
};

export default CartPage;
