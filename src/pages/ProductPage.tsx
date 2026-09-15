import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, ChevronDown, ChevronUp, Heart, Minus, Plus, ShieldCheck, ShoppingBag, Star, Truck, Zap } from 'lucide-react';
import { formatINR } from '../constants';
import { useRouter } from '../context/RouterContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import FabricImage from '../components/FabricImage';
import ProductCard from '../components/ProductCard';
import ReviewsSection from '../components/ReviewsSection';
import StickyAddToCart from '../components/StickyAddToCart';
import DeliveryChecker from '../components/DeliveryChecker';
import { productsApi } from '../lib/firebase';
import { buildGallery } from '../lib/productGallery';
import { colourSiblings } from '../lib/styleGroup';
import { costOf, describeLine, hasBundleBreak } from '../../api/_lib/lacePricing';
import { useCatalog } from '../context/CatalogContext';
import { useProductMeta } from '../lib/seoMeta';
import { analytics } from '../lib/analytics';
import type { Fabric } from '../types';

interface Props {
  productId: string;
}

const ProductPage: React.FC<Props> = ({ productId }) => {
  const { navigate } = useRouter();
  const { addItem } = useCart();
  const { has: hasWish, toggle: toggleWish } = useWishlist();

  const { products: catalogProducts, loading: catalogLoading } = useCatalog();

  const [fabric, setFabric] = useState<Fabric | null | undefined>(undefined);
  // Per-product title, description, canonical and Product JSON-LD — with real
  // URLs each product page is its own indexable document.
  useProductMeta(fabric ?? undefined);
  const [similar, setSimilar] = useState<Fabric[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFabric(undefined);
    setFetchError(null);
    (async () => {
      try {
        const f = (await productsApi.get(productId)) as unknown as Fabric | null;
        if (cancelled) return;
        setFabric(f);
      } catch (err) {
        if (!cancelled) {
          setFabric(null);
          setFetchError(err instanceof Error ? err.message : 'Could not load this product.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [productId, reloadKey]);

  // Similar products come from the shared catalogue so the rail is instant.
  useEffect(() => {
    if (!fabric || catalogLoading) return;
    setSimilar(
      catalogProducts
        .filter(p => p.id !== fabric.id && p.category === fabric.category)
        .slice(0, 5)
    );
  }, [fabric, catalogProducts, catalogLoading]);

  const [selectedColor, setSelectedColor] = useState<string | undefined>(fabric?.colors?.[0]?.name);
  const [quantity, setQuantity] = useState<number>(1);
  const [activeImage, setActiveImage] = useState<number>(0);
  const [openSection, setOpenSection] = useState<'specs' | 'care' | 'delivery' | null>('specs');

  // Re-sync defaults when the fabric finishes loading or changes. Resetting
  // activeImage here is essential — without it, navigating from a 5-photo
  // PDP to a 1-photo PDP would leave activeImage at 4 and crash on
  // gallery[activeImage].photo below.
  useEffect(() => {
    if (fabric) {
      setSelectedColor(fabric.colors?.[0]?.name);
      setQuantity(1);
      setActiveImage(0);
    }
  }, [fabric]);

  // Brief visual confirmation before bouncing to /cart — gives the user a
  // beat to register that the action took effect (and softens slow networks).
  // These hooks MUST live above the conditional early returns below, otherwise
  // the loading→loaded transition changes the hook count and React throws
  // "Rendered more hooks than during the previous render" — which is exactly
  // what was crashing the PDP into the ErrorBoundary fallback.
  const [justAdded, setJustAdded] = useState(false);
  const addTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (addTimerRef.current) clearTimeout(addTimerRef.current);
  }, []);

  // Built in src/lib/productGallery.ts so the rules that decide what a shopper
  // sees — main photo first, no duplicate shots, never a swatch in front of a
  // real photograph — can be tested without mounting the page.
  const gallery = useMemo(() => (fabric ? buildGallery(fabric) : []), [fabric]);

  // The other colourways of this design. Grouping rules live in lib/styleGroup.ts
  // so "which colours does a shopper see" can be tested without mounting a page.
  const siblings = useMemo(
    () => (fabric ? colourSiblings(fabric, catalogProducts) : []),
    [fabric, catalogProducts],
  );

  const isLace = fabric?.category === 'Laces'
    && (fabric.unitType === 'per meter' || fabric.unitType === 'bundle');
  // Only worth showing when a bundle break exists — for plain per-metre lace the
  // headline price times the length is the whole story, and a box restating it
  // is noise.
  const laceCost = useMemo(
    () => (fabric && hasBundleBreak(fabric) ? costOf(fabric, quantity) : null),
    [fabric, quantity],
  );

  if (fabric === undefined) {
    return (
      <main className="pt-[100px] md:pt-[112px] pb-20 min-h-screen bg-white">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10">
          <div className="h-3 w-64 bg-[color:var(--color-myntra-bg-soft)] rounded animate-pulse mb-4" />
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-8 lg:gap-12">
            {/* Gallery skeleton */}
            <div className="grid grid-cols-[64px_1fr] md:grid-cols-[80px_1fr] gap-3">
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] bg-[color:var(--color-myntra-bg-soft)] rounded animate-pulse" />
                ))}
              </div>
              <div className="aspect-[3/4] bg-[color:var(--color-myntra-bg-soft)] rounded animate-pulse" />
            </div>
            {/* Info skeleton */}
            <div className="space-y-3">
              <div className="h-5 w-1/3 bg-[color:var(--color-myntra-bg-soft)] rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-[color:var(--color-myntra-bg-soft)] rounded animate-pulse" />
              <div className="h-8 w-32 bg-[color:var(--color-myntra-bg-soft)] rounded animate-pulse mt-6" />
              <div className="h-3 w-48 bg-[color:var(--color-myntra-bg-soft)] rounded animate-pulse" />
              <div className="flex gap-2 mt-6">
                <div className="h-12 flex-1 bg-[color:var(--color-myntra-bg-soft)] rounded animate-pulse" />
                <div className="h-12 flex-1 bg-[color:var(--color-myntra-bg-soft)] rounded animate-pulse" />
              </div>
              <div className="h-24 w-full bg-[color:var(--color-myntra-bg-soft)] rounded animate-pulse mt-4" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!fabric) {
    return (
      <main className="pt-[160px] pb-20 min-h-screen text-center px-5 bg-white">
        <h1 className="font-serif text-3xl md:text-4xl mb-3 text-[color:var(--color-myntra-navy)]">
          This weave isn't on the loom right now
        </h1>
        <p className="text-[14px] text-[color:var(--color-myntra-ink-soft)] mb-6 max-w-md mx-auto">
          {fetchError
            ? `We hit a snag fetching this product. ${fetchError}`
            : "It may have moved to the archive — our atelier rotates stock regularly."}
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          {fetchError && (
            <button onClick={() => setReloadKey(k => k + 1)} className="btn-outline">
              Try again
            </button>
          )}
          <button onClick={() => navigate({ name: 'shop' })} className="btn-primary">Back to Shop</button>
        </div>
      </main>
    );
  }

  const stock = fabric.stock ?? 0;
  const soldOut = stock <= 0;
  const wished = hasWish(fabric.id);
  const clampQty = (q: number) => Math.max(1, Math.min(q, Math.max(1, stock)));

  const handleAdd = () => {
    if (!fabric) return;
    // Idempotency guard: a fast second tap (either the in-card or the mobile
    // sticky CTA) within the 650ms pre-navigate window must not add twice.
    if (justAdded) return;
    addItem({ fabricId: fabric.id, quantity, color: selectedColor });
    analytics.addToCart(fabric.id, fabric.name, fabric.price, quantity);
    setJustAdded(true);
    if (addTimerRef.current) clearTimeout(addTimerRef.current);
    addTimerRef.current = setTimeout(() => {
      navigate({ name: 'cart' });
    }, 650);
  };

  const handleWish = () => {
    if (!fabric) return;
    toggleWish(fabric.id);
  };


  return (
    <main className="pt-[100px] md:pt-[112px] pb-12 md:pb-16 bg-white min-h-screen">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10">
        {/* Breadcrumb */}
        {(() => {
          const masterCat = fabric.masterCategory ?? 'Fabrics';
          return (
            <nav className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mb-4">
              <button onClick={() => navigate({ name: 'home' })} className="hover:text-[color:var(--color-myntra-pink)]">Home</button>
              <span className="mx-1.5">/</span>
              <button onClick={() => navigate({ name: 'shop', category: masterCat })} className="hover:text-[color:var(--color-myntra-pink)]">{masterCat}</button>
              {fabric.subCategory && (
                <>
                  <span className="mx-1.5">/</span>
                  <button
                    onClick={() => navigate({ name: 'shop', category: masterCat, subCategory: fabric.subCategory })}
                    className="hover:text-[color:var(--color-myntra-pink)]"
                  >
                    {fabric.subCategory}
                  </button>
                </>
              )}
              <span className="mx-1.5">/</span>
              <span className="text-[color:var(--color-myntra-navy)] font-semibold truncate inline-block max-w-[200px] align-bottom">{fabric.name}</span>
            </nav>
          );
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-8 lg:gap-12">
          {/* Gallery */}
          <div className="grid grid-cols-[64px_1fr] md:grid-cols-[80px_1fr] gap-3">
            <div className="flex flex-col gap-2 max-h-[640px] overflow-y-auto scrollbar-none">
              {gallery.map((g, idx) => (
                <button
                  key={g.photo}
                  onClick={() => setActiveImage(idx)}
                  onMouseEnter={() => setActiveImage(idx)}
                  className={`aspect-[3/4] overflow-hidden border-2 transition-colors ${activeImage === idx ? 'border-[color:var(--color-myntra-pink)]' : 'border-transparent'}`}
                >
                  <FabricImage photo={g.photo} fallback={g.fallback} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
            <motion.div
              key={activeImage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="relative aspect-[3/4] bg-[color:var(--color-myntra-bg-soft)] overflow-hidden"
            >
              <FabricImage
                photo={gallery[activeImage].photo}
                fallback={gallery[activeImage].fallback}
                alt={fabric.name}
                className="w-full h-full object-cover"
              />
              {fabric.sticker && <span className="badge-trending">{fabric.sticker}</span>}
            </motion.div>
          </div>

          {/* Info */}
          <div>
            <h1 className="text-[20px] md:text-[22px] font-extrabold text-[color:var(--color-myntra-navy)] mb-1">{fabric.brand}</h1>
            <p className="text-[16px] md:text-[18px] text-[color:var(--color-myntra-ink)] mb-3">{fabric.name}</p>

            {fabric.rating !== undefined && (
              <div className="inline-flex items-center gap-2 border border-[color:var(--color-myntra-border-soft)] rounded px-2.5 py-1 mb-5">
                <span className="text-[13px] font-bold text-[color:var(--color-myntra-navy)]">{fabric.rating.toFixed(1)}</span>
                <Star className="w-3.5 h-3.5 fill-[color:var(--color-myntra-green)] text-[color:var(--color-myntra-green)]" />
                {fabric.reviewCount != null && fabric.reviewCount > 0 && (
                  <>
                    <span className="w-px h-3.5 bg-[color:var(--color-myntra-border)]" />
                    <span className="text-[12px] text-[color:var(--color-myntra-ink-soft)] font-semibold">{fabric.reviewCount.toLocaleString('en-IN')} Ratings</span>
                  </>
                )}
              </div>
            )}

            <hr className="border-[color:var(--color-myntra-border-soft)] mb-4" />

            <div className="flex items-baseline gap-3 flex-wrap mb-2">
              <span className="text-[24px] font-extrabold text-[color:var(--color-myntra-navy)]">{formatINR(fabric.price)}</span>
              {fabric.mrp > fabric.price && (
                <>
                  <span className="text-[16px] text-[color:var(--color-myntra-ink-mute)] line-through">{formatINR(fabric.mrp)}</span>
                  <span className="text-[13px] font-bold text-[color:var(--color-myntra-green)]">{Math.round(((fabric.mrp - fabric.price) / fabric.mrp) * 100)}% OFF</span>
                </>
              )}
            </div>
            <p className="text-[13px] font-bold text-[color:var(--color-myntra-green)] mb-4">inclusive of all taxes</p>

            {fabric.category === 'Laces' && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="inline-block px-2.5 py-1 rounded-full bg-[#F1ECF7] text-[#5C3A8E] border border-[#D6C9E9] text-[11px] font-bold uppercase tracking-wide">
                  {fabric.unitType === 'bundle' && fabric.bundleSizeMeters
                    ? `${fabric.bundleSizeMeters}m bundle`
                    : fabric.unitType === 'per meter'
                    ? 'Per meter'
                    : 'Lace'}
                </span>
                {fabric.productCode && (
                  <span className="text-[12px] text-[color:var(--color-myntra-ink-mute)]">Code: {fabric.productCode}</span>
                )}
              </div>
            )}

            {/* Colourways of this design — each one a separate product.
                Swatches are the actual PHOTOGRAPHS rather than hex circles: for
                lace the weave and the density of the work differ between
                colourways as much as the colour does, and a flat dot of colour
                shows none of that. */}
            {siblings.length > 1 && (
              <div className="mt-5 mb-5" data-testid="colourways">
                <p className="text-[13px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)] mb-3">
                  Also in {siblings.length - 1} more colour{siblings.length - 1 === 1 ? '' : 's'}
                </p>
                <div className="flex gap-2.5 flex-wrap">
                  {siblings.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { if (!s.isCurrent) navigate({ name: 'product', id: s.id }); }}
                      aria-current={s.isCurrent ? 'true' : undefined}
                      aria-label={`${s.colour}${s.soldOut ? ', sold out' : ''}`}
                      title={s.colour}
                      className={`w-[58px] shrink-0 text-left ${s.isCurrent ? '' : 'cursor-pointer'}`}
                    >
                      <span
                        className={`block aspect-square overflow-hidden border-2 transition-colors ${
                          s.isCurrent
                            ? 'border-[color:var(--color-myntra-pink)]'
                            : 'border-[color:var(--color-myntra-border)] hover:border-[color:var(--color-myntra-navy)]'
                        }`}
                      >
                        <FabricImage
                          photo={s.photo}
                          fallback={s.fallback}
                          alt={s.colour}
                          className={`w-full h-full object-cover ${s.soldOut ? 'opacity-45' : ''}`}
                        />
                      </span>
                      <span className="block text-[10px] leading-tight mt-1 font-semibold text-[color:var(--color-myntra-navy)] line-clamp-2">
                        {s.colour}
                      </span>
                      {s.soldOut && (
                        <span className="block text-[9px] font-bold text-[color:var(--color-myntra-ink-mute)] uppercase tracking-wide">
                          Sold out
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Colour */}
            {fabric.colors && fabric.colors.length > 0 && (
              <div className="mt-5 mb-5">
                <p className="text-[13px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)] mb-3">
                  More Colours
                </p>
                <div className="flex gap-2 flex-wrap">
                  {fabric.colors.map(c => (
                    <button
                      key={c.name}
                      onClick={() => setSelectedColor(c.name)}
                      title={c.name}
                      className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-all ${selectedColor === c.name ? 'border-[color:var(--color-myntra-pink)] bg-[#F5E8C8]' : 'border-[color:var(--color-myntra-border)] hover:border-[color:var(--color-myntra-navy)]'}`}
                    >
                      <span className="w-5 h-5 rounded-full border border-white outline outline-1 outline-[color:var(--color-myntra-border)]" style={{ background: c.hex }} />
                      <span className="text-[12px] font-semibold">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity stepper */}
            <div className="mb-6">
              <div className="flex items-baseline justify-between mb-3">
                <p className="text-[13px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)]">
                  {isLace ? 'Length' : 'Quantity'}
                </p>
                {isLace && (
                  <span className="text-[12px] font-semibold text-[color:var(--color-myntra-ink-soft)]">in meters</span>
                )}
              </div>
              {soldOut ? (
                <p className="text-[13px] font-bold text-[color:var(--color-myntra-pink)] bg-[color:var(--color-myntra-bg-sale)] border border-[color:var(--color-myntra-border)] rounded px-3 py-2">
                  Out of stock — currently unavailable.
                </p>
              ) : (
                <>
                  <div className="inline-flex items-center border-2 border-[color:var(--color-myntra-border)] rounded-full overflow-hidden">
                    <button
                      onClick={() => setQuantity(q => clampQty(q - 1))}
                      disabled={quantity <= 1}
                      aria-label="Decrease quantity"
                      className="w-11 h-11 flex items-center justify-center text-[color:var(--color-myntra-navy)] disabled:opacity-40 hover:bg-[color:var(--color-myntra-bg-soft)] transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="min-w-[48px] text-center text-[15px] font-bold text-[color:var(--color-myntra-navy)]" aria-live="polite">{quantity}</span>
                    <button
                      onClick={() => setQuantity(q => clampQty(q + 1))}
                      disabled={quantity >= stock}
                      aria-label="Increase quantity"
                      className="w-11 h-11 flex items-center justify-center text-[color:var(--color-myntra-navy)] disabled:opacity-40 hover:bg-[color:var(--color-myntra-bg-soft)] transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {/* What this length actually costs, and why. A bundle is a
                      price break on the same metres, so a customer asking for
                      eight of a nine-metre bundle is charged the bundle price
                      and handed the ninth metre — cheaper than eight loose. Say
                      so plainly here rather than letting the total look wrong. */}
                  {laceCost && (
                    <div className="mt-3 text-[12px] rounded border border-[#D6C9E9] bg-[#F7F4FB] px-3 py-2" data-testid="lace-cost">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold text-[#5C3A8E]">
                          {describeLine(fabric, quantity) || `${quantity}m`}
                        </span>
                        <span className="font-extrabold text-[color:var(--color-myntra-navy)]">{formatINR(laceCost.total)}</span>
                      </div>
                      {laceCost.metersGiven > quantity && (
                        <p className="mt-1 text-[color:var(--color-myntra-ink-soft)]">
                          A full {fabric.bundleSizeMeters}m bundle costs less than {quantity}m loose, so you get{' '}
                          <b>{laceCost.metersGiven}m</b> for the price of the bundle.
                        </p>
                      )}
                      {laceCost.metersGiven === quantity && laceCost.total < laceCost.wouldHaveCost && (
                        <p className="mt-1 text-[color:var(--color-myntra-green)] font-semibold">
                          Bundle rate applied — you save {formatINR(laceCost.wouldHaveCost - laceCost.total)}
                        </p>
                      )}
                    </div>
                  )}
                  {stock < 10 && (
                    <p className="text-[12px] text-[color:var(--color-myntra-pink)] font-semibold mt-2">
                      Only {stock} {isLace ? 'meters' : 'left'} in stock — order soon
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Description */}
            <div className="mb-6">
              <p className="text-[14px] text-[color:var(--color-myntra-ink)] leading-relaxed">{fabric.description}</p>
            </div>

            {/* CTAs */}
            <div className="flex gap-3 mb-7">
              <button
                id="pdp-add-to-bag"
                onClick={handleAdd}
                disabled={soldOut || quantity < 1 || quantity > stock || justAdded}
                className="btn-primary flex-1 inline-flex justify-center items-center gap-2"
              >
                {soldOut ? (
                  'Out of Stock'
                ) : justAdded ? (
                  <>
                    <Check className="w-5 h-5" /> Added to Bag
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-5 h-5" /> Add to Bag
                  </>
                )}
              </button>
              <button
                onClick={handleWish}
                className="btn-outline inline-flex items-center gap-2 flex-1 justify-center"
              >
                <Heart className={`w-5 h-5 ${wished ? 'fill-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)]' : ''}`} />
                {wished ? 'Wishlisted' : 'Wishlist'}
              </button>
            </div>

            {/* Delivery — same-day serviceability (location + pincode) */}
            <div className="mb-6">
              <DeliveryChecker variant="card" />
            </div>

            {/* Trust strip */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { Icon: Zap, label: 'Same-day · Hyderabad' },
                { Icon: Truck, label: 'Free over ₹1,999' },
                { Icon: ShieldCheck, label: '100% Authentic' }
              ].map(({ Icon, label }) => (
                <div key={label} className="text-center">
                  <Icon className="w-6 h-6 mx-auto mb-1 text-[color:var(--color-myntra-pink)]" />
                  <p className="text-[11px] font-bold text-[color:var(--color-myntra-ink)] leading-tight">{label}</p>
                </div>
              ))}
            </div>

            {/* Accordions */}
            {(['specs', 'care', 'delivery'] as const).map(key => {
              const labels = {
                specs: 'Product Details',
                care: 'Material & Care',
                delivery: 'Shipping & Delivery'
              };
              const open = openSection === key;
              return (
                <div key={key} className="border-t border-[color:var(--color-myntra-border-soft)]">
                  <button
                    onClick={() => setOpenSection(open ? null : key)}
                    className="w-full flex justify-between items-center py-4 text-[14px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)]"
                  >
                    {labels[key]}
                    {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {open && (
                    <div className="pb-4 text-[13px] text-[color:var(--color-myntra-ink)] leading-relaxed">
                      {key === 'specs' && (
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
                          <dt className="text-[color:var(--color-myntra-ink-soft)]">Fabric</dt><dd className="font-semibold">{fabric.weaveType ?? fabric.category}</dd>
                          <dt className="text-[color:var(--color-myntra-ink-soft)]">Category</dt><dd className="font-semibold">{fabric.category}</dd>
                          <dt className="text-[color:var(--color-myntra-ink-soft)]">In Stock</dt><dd className="font-semibold">{stock} {fabric.category === 'Laces' ? (fabric.unitType === 'bundle' ? `meters (${fabric.bundleSizeMeters ? Math.floor(stock / fabric.bundleSizeMeters) : stock} bundle${Math.floor(stock / (fabric.bundleSizeMeters ?? 1)) === 1 ? '' : 's'})` : 'meters') : (stock === 1 ? 'piece' : 'pieces')}</dd>
                          <dt className="text-[color:var(--color-myntra-ink-soft)]">Tags</dt><dd className="font-semibold">{fabric.tags.join(', ')}</dd>
                        </dl>
                      )}
                      {key === 'care' && (
                        <p>Dry-clean only by a specialist familiar with hand-woven heritage textiles. Store rolled in muslin away from direct sunlight. Every parcel ships with a care leaflet.</p>
                      )}
                      {key === 'delivery' && (
                        <div className="space-y-2">
                          <p className="flex items-start gap-2"><Zap className="w-4 h-4 mt-0.5 text-[color:var(--color-myntra-pink)] shrink-0" /> <span><b>Hyderabad — same-day delivery.</b> In-stock Studios Prêt and Couture Customisations are dispatched from the city studio the same day when eligible.</span></p>
                          <p className="flex items-start gap-2"><Truck className="w-4 h-4 mt-0.5 text-[color:var(--color-myntra-pink)] shrink-0" /> <span>Free shipping pan-India on orders over ₹1,999. Dispatched within 48 hours.</span></p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* More from this weave — best-effort rail; ProductRail self-hides when items=[] */}
        {similar.length > 0 && (
          <section className="mt-12 md:mt-16">
            <div className="flex items-end justify-between mb-5">
              <div>
                <span className="section-eyebrow">{fabric.category} weaves</span>
                <h2 className="text-xl md:text-2xl font-extrabold mt-1">More from this weave</h2>
              </div>
              <button
                onClick={() => navigate({ name: 'shop' })}
                className="text-[13px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-pink)] hover:underline"
              >
                See All →
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
              {similar.map(s => <ProductCard key={s.id} fabric={s} />)}
            </div>
          </section>
        )}

        {/* Reviews */}
        <ReviewsSection fabricId={fabric.id} />
      </div>

      {/* Mobile-only sticky add-to-bag — appears once the in-card CTA scrolls out of view. */}
      <StickyAddToCart
        product={fabric}
        onAdd={handleAdd}
        onWishlist={handleWish}
        wished={wished}
        disabled={soldOut || quantity < 1 || quantity > stock || justAdded}
        triggerId="pdp-add-to-bag"
      />
    </main>
  );
};

export default ProductPage;
