import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, ChevronDown, ChevronUp, Heart, MapPin, Minus, Plus, ShieldCheck, ShoppingBag, Star, Truck, Zap } from 'lucide-react';
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
import { analytics } from '../lib/analytics';
import type { Fabric } from '../types';

interface Props {
  productId: string;
}

const ProductPage: React.FC<Props> = ({ productId }) => {
  const { navigate } = useRouter();
  const { addItem } = useCart();
  const { has: hasWish, toggle: toggleWish } = useWishlist();

  const [fabric, setFabric] = useState<Fabric | null | undefined>(undefined);
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
        if (f) {
          // Similar-products fetch is best-effort — a failure here shouldn't
          // blank the PDP, so we swallow and just render no rail.
          try {
            const peers = (await productsApi.list({ limit: 100 })) as unknown as Fabric[];
            if (!cancelled) {
              setSimilar(peers.filter(p => p.id !== f.id && p.category === f.category).slice(0, 5));
            }
          } catch {
            if (!cancelled) setSimilar([]);
          }
        } else {
          setSimilar([]);
        }
      } catch (err) {
        if (!cancelled) {
          setFabric(null);
          setFetchError(err instanceof Error ? err.message : 'Could not load this product.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [productId, reloadKey]);

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

  const gallery = useMemo(() => {
    if (!fabric) return [] as { photo: string; fallback: string }[];
    const photos = fabric.photoGallery?.length ? fabric.photoGallery : [fabric.photo];
    const fallbacks = fabric.gallery?.length ? fabric.gallery : [fabric.image];
    return photos.map((photo, i) => ({ photo, fallback: fallbacks[i] ?? fallbacks[0] ?? fabric.image }));
  }, [fabric]);

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

            <div className="flex items-baseline gap-2 flex-wrap mb-1">
              <span className="text-[24px] font-extrabold text-[color:var(--color-myntra-navy)]">{formatINR(fabric.price)}</span>
            </div>
            <p className="text-[13px] font-bold text-[color:var(--color-myntra-green)] mb-1">inclusive of all taxes</p>

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
                <p className="text-[13px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)]">Quantity</p>
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
                  {stock < 10 && (
                    <p className="text-[12px] text-[color:var(--color-myntra-pink)] font-semibold mt-2">
                      Only {stock} left in stock — order soon
                    </p>
                  )}
                </>
              )}
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

            {/* Delivery */}
            <div className="mb-6">
              <DeliveryChecker variant="card" />
            </div>

            {/* Trust strip */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { Icon: Zap, label: '40-min · Hyderabad' },
                { Icon: Truck, label: 'Free over ₹1,999' },
                { Icon: ShieldCheck, label: '100% Authentic' }
              ].map(({ Icon, label }) => (
                <div key={label} className="text-center">
                  <Icon className="w-6 h-6 mx-auto mb-1 text-[color:var(--color-myntra-pink)]" />
                  <p className="text-[11px] font-bold text-[color:var(--color-myntra-ink)] leading-tight">{label}</p>
                </div>
              ))}
            </div>

            {/* Description */}
            <div>
              <p className="text-[14px] text-[color:var(--color-myntra-ink)] leading-relaxed mb-5">{fabric.description}</p>
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
                          <dt className="text-[color:var(--color-myntra-ink-soft)]">Origin</dt><dd className="font-semibold">{fabric.origin}</dd>
                          <dt className="text-[color:var(--color-myntra-ink-soft)]">Category</dt><dd className="font-semibold">{fabric.category}</dd>
                          <dt className="text-[color:var(--color-myntra-ink-soft)]">In Stock</dt><dd className="font-semibold">{stock} {stock === 1 ? 'piece' : 'pieces'}</dd>
                          <dt className="text-[color:var(--color-myntra-ink-soft)]">Tags</dt><dd className="font-semibold">{fabric.tags.join(', ')}</dd>
                        </dl>
                      )}
                      {key === 'care' && (
                        <p>Dry-clean only by a specialist familiar with hand-woven heritage textiles. Store rolled in muslin away from direct sunlight. Every parcel ships with a care leaflet.</p>
                      )}
                      {key === 'delivery' && (
                        <div className="space-y-2">
                          <p className="flex items-start gap-2"><Zap className="w-4 h-4 mt-0.5 text-[color:var(--color-myntra-pink)] shrink-0" /> <span><b>Hyderabad — 40 minutes.</b> Studios Prêt and Couture Customisations stocked at the city studio go out by motorbike inside forty minutes of order placement.</span></p>
                          <p className="flex items-start gap-2"><Truck className="w-4 h-4 mt-0.5 text-[color:var(--color-myntra-pink)] shrink-0" /> <span>Free shipping pan-India on orders over ₹1,999. Hand-cut to the metre and dispatched within 48 hours.</span></p>
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
