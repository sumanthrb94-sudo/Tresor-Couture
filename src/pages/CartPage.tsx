import React, { useEffect, useState } from 'react';
import { ChevronDown, RefreshCw, ShieldCheck, ShoppingBag, Tag, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { useCatalog } from '../context/CatalogContext';
import { FREE_SHIPPING_THRESHOLD, formatINR } from '../constants';
import { couponsApi } from '../lib/firebase';
import { inStock } from '../lib/availability';
import FabricImage from '../components/FabricImage';
import ProductCard from '../components/ProductCard';
import DeliveryChecker from '../components/DeliveryChecker';

const CartPage: React.FC = () => {
  const { items, resolved, resolving, updateQuantity, removeItem, subtotal, shipping, tax, total, unitCount } = useCart();
  const { add: addWish } = useWishlist();
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [coupon, setCoupon] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponBusy, setCouponBusy] = useState(false);

  // "You might also like" uses the shared catalogue.
  const { products: catalogProducts } = useCatalog();
  const catalog = catalogProducts.length ? catalogProducts : null;

  // A coupon is validated against the subtotal at apply time and its discount
  // frozen into state. If the shopper then changes quantities, that frozen
  // figure goes stale (wrong total, possibly below the coupon's minimum). Clear
  // it on any basket change so Total, the discount line, and the free-shipping
  // nudge can never contradict each other — and avoid per-keystroke re-validation.
  useEffect(() => {
    if (couponDiscount > 0) {
      setCouponDiscount(0);
      setCouponMsg({ ok: false, text: 'Bag updated — please re-apply your coupon.' });
    }
    // Intentionally keyed only on subtotal; couponDiscount guard prevents the
    // initial-mount run from showing a spurious message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  // Items are in the cart but their product details haven't been fetched yet
  // (first visit after Firestore sync). Show a spinner instead of an "empty"
  // false-positive.
  if (resolving && items.length > 0 && resolved.length === 0) {
    return (
      <main className="pt-[140px] pb-20 min-h-screen flex items-center justify-center bg-[color:var(--color-myntra-bg-soft)]">
        <div className="w-8 h-8 border-2 border-[color:var(--color-myntra-pink)] border-t-transparent rounded-full animate-spin" aria-label="Loading bag" />
      </main>
    );
  }

  // Items exist but none could be resolved to a product (deleted/unavailable
  // stock, or a transient fetch failure). Distinct from a truly empty bag —
  // showing "empty" here would contradict the non-zero bag badge in the navbar.
  if (resolved.length === 0 && items.length > 0 && !resolving) {
    return (
      <main className="pt-[100px] md:pt-[112px] pb-20 min-h-screen bg-[color:var(--color-myntra-bg-soft)]">
        <div className="max-w-md mx-auto bg-white text-center px-6 py-12 border border-[color:var(--color-myntra-border-soft)]">
          <ShoppingBag className="w-14 h-14 mx-auto text-[color:var(--color-myntra-ink-mute)] mb-5" />
          <h1 className="text-2xl font-extrabold mb-2">Some items are no longer available</h1>
          <p className="text-[14px] text-[color:var(--color-myntra-ink-soft)] mb-6">
            The pieces in your bag could not be loaded — they may have sold out or moved to the archive.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => { items.forEach(i => removeItem(i.fabricId, i.color)); }} className="btn-outline">
              Clear bag
            </button>
            <button onClick={() => navigate({ name: 'shop' })} className="btn-primary">Continue Shopping</button>
          </div>
        </div>
      </main>
    );
  }

  if (resolved.length === 0) {
    return (
      <main className="pt-[100px] md:pt-[112px] pb-20 min-h-screen bg-[color:var(--color-myntra-bg-soft)]">
        <div className="max-w-md mx-auto bg-white text-center px-6 py-12 border border-[color:var(--color-myntra-border-soft)]">
          <ShoppingBag className="w-14 h-14 mx-auto text-[color:var(--color-myntra-ink-mute)] mb-5" />
          <h1 className="text-2xl font-extrabold mb-2">Your bag is empty</h1>
          <p className="text-[14px] text-[color:var(--color-myntra-ink-soft)] mb-6">
            {user
              ? 'Add hand-cut fabrics from the shop to start a bag — saved across your devices.'
              : (<>
                  <button onClick={() => navigate({ name: 'login' })} className="text-[color:var(--color-myntra-pink)] font-bold hover:underline">
                    Sign in
                  </button>
                  {' '}to see items saved from a previous visit, or start a new bag below.
                </>)}
          </p>
          <button onClick={() => navigate({ name: 'shop' })} className="btn-primary">Shop Now</button>
        </div>
      </main>
    );
  }

  const totalAfterCoupon = Math.max(0, total - couponDiscount);
  const remainingForFreeShip = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  // Mirror the checkout Order Summary exactly: show Total MRP and the markdown
  // to the selling price as a "Discount" line, so the two screens tell one
  // consistent pricing story instead of the cart showing only a bare Subtotal.
  const mrpTotal = resolved.reduce((s, { item, fabric }) => s + (fabric.mrp ?? fabric.price) * item.quantity, 0);
  const productDiscount = Math.max(0, mrpTotal - subtotal);

  const applyCoupon = async () => {
    const code = coupon.trim().toUpperCase();
    if (!code) return;
    setCouponBusy(true);
    try {
      const res = await couponsApi.validate(code, subtotal);
      if (!res.valid) {
        setCouponDiscount(0);
        const text =
          res.reason === 'not_found'    ? 'Coupon code is invalid.'
        : res.reason === 'inactive'     ? 'This coupon is no longer active.'
        : res.reason === 'expired'      ? 'This coupon has expired.'
        : res.reason === 'min_subtotal' ? `Add ${formatINR(res.minSubtotal ?? 0)} more to use this coupon.`
        : 'This coupon cannot be used.';
        setCouponMsg({ ok: false, text });
        return;
      }
      setCouponDiscount(res.discount);
      setCouponMsg({ ok: true, text: `Applied — ${formatINR(res.discount)} off.` });
    } catch (err) {
      setCouponDiscount(0);
      setCouponMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not validate coupon.' });
    } finally {
      setCouponBusy(false);
    }
  };

  // Never cross-sell something we cannot ship — this rail sits directly above
  // the checkout button.
  // `?? []` and not `?? FABRICS`: a cross-sell rail directly above Checkout
  // must never offer a product that does not exist.
  const youMightLike = (catalog ?? [])
    .filter(f => inStock(f) && !resolved.some(r => r.fabric.id === f.id))
    .slice(0, 5);

  return (
    <main className="pt-[100px] md:pt-[112px] pb-12 md:pb-16 bg-[color:var(--color-myntra-bg-soft)] min-h-screen">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 lg:px-10">
        <h1 className="text-xl md:text-2xl font-extrabold mb-2 text-[color:var(--color-myntra-navy)]">
          My Bag <span className="text-[14px] font-medium text-[color:var(--color-myntra-ink-mute)] ml-2">{unitCount} item{unitCount === 1 ? '' : 's'}</span>
        </h1>

        {user ? (
          <p className="text-[12px] text-[color:var(--color-myntra-green)] font-semibold mb-4 inline-flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Synced across your devices
          </p>
        ) : (
          <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] font-semibold mb-4">
            <button
              onClick={() => navigate({ name: 'login' })}
              className="text-[color:var(--color-myntra-pink)] hover:underline"
            >
              Sign in to save your bag across devices →
            </button>
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 lg:gap-6">
          <div className="space-y-3">
            {/* Same-day delivery serviceability */}
            <DeliveryChecker variant="card" />

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
              const linePrice = item.quantity * fabric.price;
              const stock = fabric.stock ?? 999;
              // Quantity choices: 1…min(stock, 10). Always include the current
              // value so a line that somehow exceeds the cap still renders.
              const cap = Math.max(1, Math.min(stock, 10));
              const options = Array.from(new Set([...Array.from({ length: cap }, (_, i) => i + 1), item.quantity]))
                .filter(o => o >= 1 && o <= stock)
                .sort((a, b) => a - b);

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
                          value={item.quantity}
                          onChange={e => updateQuantity(fabric.id, item.color, Number(e.target.value))}
                          className="appearance-none border border-[color:var(--color-myntra-border)] rounded px-2.5 py-1.5 pr-7 text-[12px] font-semibold bg-white"
                        >
                          {options.map(o => <option key={o} value={o}>Qty: {o}</option>)}
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      {item.color && (
                        <span className="border border-[color:var(--color-myntra-border)] rounded px-2 py-1 font-semibold">Colour: {item.color}</span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-2 flex-wrap mt-2">
                      <span className="text-[15px] font-bold">{formatINR(linePrice)}</span>
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
                  <button onClick={applyCoupon} disabled={couponBusy} className="text-[13px] font-bold text-[color:var(--color-myntra-pink)] px-3 disabled:opacity-60">{couponBusy ? '...' : 'APPLY'}</button>
                </div>
                {couponMsg && (
                  <p className={`text-[12px] mt-2 font-semibold ${couponMsg.ok ? 'text-[color:var(--color-myntra-green)]' : 'text-[color:var(--color-myntra-pink)]'}`}>
                    {couponMsg.text}
                  </p>
                )}
              </div>

              {/* Price details */}
              <div className="bg-white border border-[color:var(--color-myntra-border-soft)] p-4">
                <p className="text-[12px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-ink-soft)] mb-4">Price Details ({unitCount} item{unitCount === 1 ? '' : 's'})</p>

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
                  {productDiscount > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-[color:var(--color-myntra-ink)]">Discount on MRP</dt>
                      <dd className="text-[color:var(--color-myntra-green)]">- {formatINR(productDiscount)}</dd>
                    </div>
                  )}
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
                    <dt className="text-[color:var(--color-myntra-ink)]">GST (incl.)</dt>
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
                  Safe and secure payments. Free shipping over ₹1,999. Same-day dispatch for eligible Hyderabad orders. 100% authentic hand-woven.
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
