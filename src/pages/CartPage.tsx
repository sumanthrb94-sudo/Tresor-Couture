import React, { useState } from 'react';
import { ChevronDown, MapPin, ShieldCheck, ShoppingBag, Tag, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useRouter } from '../context/RouterContext';
import { FABRICS, FREE_SHIPPING_THRESHOLD, discountPct, formatINR } from '../constants';
import FabricImage from '../components/FabricImage';
import ProductCard from '../components/ProductCard';

const CartPage: React.FC = () => {
  const { resolved, updateMeters, removeItem, subtotal, shipping, tax, total } = useCart();
  const { add: addWish } = useWishlist();
  const { navigate } = useRouter();
  const [coupon, setCoupon] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [pin, setPin] = useState('');

  if (resolved.length === 0) {
    return (
      <main className="pt-[140px] pb-20 min-h-screen bg-[color:var(--color-myntra-bg-soft)]">
        <div className="max-w-md mx-auto bg-white text-center px-6 py-12 border border-[color:var(--color-myntra-border-soft)]">
          <ShoppingBag className="w-14 h-14 mx-auto text-[color:var(--color-myntra-ink-mute)] mb-5" />
          <h1 className="text-2xl font-extrabold mb-2">Your bag is empty</h1>
          <p className="text-[14px] text-[color:var(--color-myntra-ink-soft)] mb-6">
            Have an account? <span className="text-[color:var(--color-myntra-pink)] font-bold">Log in</span> to see saved items.
          </p>
          <button onClick={() => navigate({ name: 'shop' })} className="btn-primary">Shop Now</button>
        </div>
      </main>
    );
  }

  const mrpTotal = resolved.reduce((s, { item, fabric }) => s + fabric.mrpPerMeter * item.meters, 0);
  const productDiscount = mrpTotal - subtotal;
  const totalAfterCoupon = Math.max(0, total - couponDiscount);
  const remainingForFreeShip = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  const applyCoupon = () => {
    const code = coupon.trim().toUpperCase();
    if (!code) return;
    if (code === 'WEDDING50') {
      setCouponDiscount(Math.round(subtotal * 0.1));
      setCouponMsg({ ok: true, text: '🎉 Extra ₹' + Math.round(subtotal * 0.1).toLocaleString('en-IN') + ' off applied.' });
    } else if (code === 'UPI10') {
      setCouponDiscount(Math.round(subtotal * 0.05));
      setCouponMsg({ ok: true, text: '✅ UPI cashback ₹' + Math.round(subtotal * 0.05).toLocaleString('en-IN') + ' applied.' });
    } else {
      setCouponDiscount(0);
      setCouponMsg({ ok: false, text: 'Coupon code is invalid or expired.' });
    }
  };

  const youMightLike = FABRICS.filter(f => !resolved.some(r => r.fabric.id === f.id)).slice(0, 5);

  return (
    <main className="pt-[100px] pb-12 md:pb-16 bg-[color:var(--color-myntra-bg-soft)] min-h-screen">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 lg:px-10">
        <h1 className="text-xl md:text-2xl font-extrabold mb-4 text-[color:var(--color-myntra-navy)]">
          My Bag <span className="text-[14px] font-medium text-[color:var(--color-myntra-ink-mute)] ml-2">{resolved.length} item{resolved.length === 1 ? '' : 's'}</span>
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 lg:gap-6">
          <div className="space-y-3">
            {/* Pincode banner */}
            <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-3 md:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[13px] text-[color:var(--color-myntra-ink)]">
                <MapPin className="w-4 h-4 text-[color:var(--color-myntra-pink)]" />
                <span className="font-bold">Deliver to:</span>
                <input value={pin} onChange={e => setPin(e.target.value)} placeholder="Enter pincode" className="border-b border-[color:var(--color-myntra-border)] px-2 py-1 outline-none focus:border-[color:var(--color-myntra-pink)] w-32" />
              </div>
              <button className="text-[12px] font-bold text-[color:var(--color-myntra-pink)] uppercase">Change</button>
            </div>

            {/* Coupon banner */}
            <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-3 md:p-4">
              <p className="text-[13px] font-bold text-[color:var(--color-myntra-navy)] mb-1 flex items-center gap-2">
                <Tag className="w-4 h-4 text-[color:var(--color-myntra-green)]" /> Available Offers
              </p>
              <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)]">
                Try <span className="font-bold text-[color:var(--color-myntra-navy)]">WEDDING50</span> for an extra 10% off bridal silks, or <span className="font-bold text-[color:var(--color-myntra-navy)]">UPI10</span> for UPI cashback.
              </p>
            </div>

            {/* Items */}
            {resolved.map(({ item, fabric }) => {
              const linePrice = item.meters * fabric.pricePerMeter;
              const lineMrp = item.meters * fabric.mrpPerMeter;
              const pct = discountPct(fabric.pricePerMeter, fabric.mrpPerMeter);
              const stock = fabric.inStockMeters ?? 999;
              const options = fabric.lengthOptions?.filter(l => l <= stock) ?? [1, 2, 3, 5];

              return (
                <div key={`${fabric.id}-${item.color ?? ''}`} className="bg-white border border-[color:var(--color-myntra-border-soft)] p-3 md:p-4 flex gap-3 md:gap-4">
                  <button
                    onClick={() => navigate({ name: 'product', id: fabric.id })}
                    className="w-24 h-32 md:w-28 md:h-36 shrink-0 bg-[color:var(--color-myntra-bg-soft)] overflow-hidden"
                  >
                    <FabricImage photo={fabric.photo} fallback={fabric.image} alt={fabric.name} className="w-full h-full object-cover" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => navigate({ name: 'product', id: fabric.id })} className="block text-left">
                      <p className="font-extrabold text-[14px] truncate">{fabric.brand}</p>
                      <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] truncate">{fabric.name}</p>
                    </button>
                    <p className="text-[11px] text-[color:var(--color-myntra-ink-mute)] mt-0.5">
                      Sold by: Tresor Atelier
                    </p>

                    <div className="flex gap-3 mt-2 items-center text-[12px]">
                      <div className="relative">
                        <select
                          value={item.meters}
                          onChange={e => updateMeters(fabric.id, item.color, Number(e.target.value))}
                          className="appearance-none border border-[color:var(--color-myntra-border)] rounded px-2.5 py-1.5 pr-7 text-[12px] font-semibold bg-white"
                        >
                          {options.map(o => <option key={o} value={o}>Length: {o} m</option>)}
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      {item.color && (
                        <span className="border border-[color:var(--color-myntra-border)] rounded px-2 py-1 font-semibold">Colour: {item.color}</span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-2 flex-wrap mt-2">
                      <span className="text-[15px] font-bold">{formatINR(linePrice)}</span>
                      {lineMrp > linePrice && (
                        <>
                          <span className="text-[13px] mrp">{formatINR(lineMrp)}</span>
                          <span className="text-[13px] font-bold text-[color:var(--color-myntra-orange)]">({pct}% OFF)</span>
                        </>
                      )}
                    </div>
                    <p className="text-[12px] text-[color:var(--color-myntra-green)] font-semibold mt-1">
                      Delivery by {new Date(Date.now() + 5 * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} | Free
                    </p>

                    <div className="border-t border-[color:var(--color-myntra-border-soft)] mt-3 pt-2 flex gap-5">
                      <button
                        onClick={() => { addWish(fabric.id); removeItem(fabric.id, item.color); }}
                        className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-navy)] hover:text-[color:var(--color-myntra-pink)]"
                      >
                        Move to Wishlist
                      </button>
                      <button
                        onClick={() => removeItem(fabric.id, item.color)}
                        className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-myntra-navy)] hover:text-[color:var(--color-myntra-pink)] inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* You might also like */}
            {youMightLike.length > 0 && (
              <section className="bg-white border border-[color:var(--color-myntra-border-soft)] p-4 mt-4">
                <h3 className="text-[14px] font-extrabold uppercase tracking-wider mb-4">You might also like</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {youMightLike.map(f => <ProductCard key={f.id} fabric={f} />)}
                </div>
              </section>
            )}
          </div>

          {/* Summary */}
          <aside>
            <div className="lg:sticky lg:top-[110px] space-y-3">
              {/* Coupon */}
              <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-4">
                <p className="text-[12px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)] mb-3">Coupons</p>
                <div className="flex gap-2">
                  <input
                    value={coupon}
                    onChange={e => setCoupon(e.target.value)}
                    placeholder="Enter coupon code"
                    className="input-box flex-1"
                  />
                  <button onClick={applyCoupon} className="text-[13px] font-bold text-[color:var(--color-myntra-pink)] px-3">APPLY</button>
                </div>
                {couponMsg && (
                  <p className={`text-[12px] mt-2 font-semibold ${couponMsg.ok ? 'text-[color:var(--color-myntra-green)]' : 'text-[color:var(--color-myntra-pink)]'}`}>
                    {couponMsg.text}
                  </p>
                )}
              </div>

              {/* Price details */}
              <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-4">
                <p className="text-[12px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-4">Price Details ({resolved.length} items)</p>

                {remainingForFreeShip > 0 && (
                  <div className="bg-[color:var(--color-myntra-bg-sale)] text-[12px] font-semibold p-2 mb-4 rounded">
                    Add {formatINR(remainingForFreeShip)} more to qualify for FREE shipping.
                  </div>
                )}

                <dl className="space-y-2.5 text-[14px]">
                  <div className="flex justify-between">
                    <dt className="text-[color:var(--color-myntra-ink)]">Total MRP</dt>
                    <dd>{formatINR(mrpTotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[color:var(--color-myntra-ink)]">Discount on MRP</dt>
                    <dd className="text-[color:var(--color-myntra-green)]">- {formatINR(productDiscount)}</dd>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-[color:var(--color-myntra-ink)]">Coupon Discount</dt>
                      <dd className="text-[color:var(--color-myntra-green)]">- {formatINR(couponDiscount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-[color:var(--color-myntra-ink)]">Shipping Fee</dt>
                    <dd className={shipping === 0 ? 'text-[color:var(--color-myntra-green)] font-bold' : ''}>
                      {shipping === 0 ? 'FREE' : formatINR(shipping)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[color:var(--color-myntra-ink)]">GST</dt>
                    <dd>{formatINR(tax)}</dd>
                  </div>
                </dl>

                <hr className="my-4 border-dashed border-[color:var(--color-myntra-border)]" />

                <div className="flex justify-between items-baseline mb-4">
                  <span className="font-extrabold text-[15px]">Total Amount</span>
                  <span className="font-extrabold text-[18px]">{formatINR(totalAfterCoupon)}</span>
                </div>

                <button onClick={() => navigate({ name: 'checkout' })} className="btn-primary w-full">
                  Place Order
                </button>
              </div>

              <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-4 flex items-center gap-3">
                <ShieldCheck className="w-7 h-7 text-[color:var(--color-myntra-ink-soft)]" />
                <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] leading-snug">
                  Safe and secure payments. Free shipping over ₹1,999. 40-minute delivery across Hyderabad. 100% authentic hand-woven.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
};

export default CartPage;
