import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, ChevronUp, Heart, MapPin, RotateCcw, ShieldCheck, ShoppingBag, Star, Truck } from 'lucide-react';
import { FABRICS, discountPct, formatINR } from '../constants';
import { useRouter } from '../context/RouterContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import FabricImage from '../components/FabricImage';
import ProductCard from '../components/ProductCard';
import ReviewsSection from '../components/ReviewsSection';

interface Props {
  productId: string;
}

const ProductPage: React.FC<Props> = ({ productId }) => {
  const { navigate } = useRouter();
  const { addItem } = useCart();
  const { has: hasWish, toggle: toggleWish } = useWishlist();
  const fabric = FABRICS.find(f => f.id === productId);

  const defaultColor = fabric?.colors?.[0]?.name;
  const [selectedColor, setSelectedColor] = useState<string | undefined>(defaultColor);
  const [meters, setMeters] = useState<number>(fabric?.lengthOptions?.[0] ?? 1);
  const [activeImage, setActiveImage] = useState<number>(0);
  const [pin, setPin] = useState('');
  const [pinChecked, setPinChecked] = useState<null | boolean>(null);
  const [openSection, setOpenSection] = useState<'specs' | 'care' | 'returns' | null>('specs');

  const gallery = useMemo(() => {
    if (!fabric) return [] as { photo: string; fallback: string }[];
    const photos = fabric.photoGallery?.length ? fabric.photoGallery : [fabric.photo];
    const fallbacks = fabric.gallery?.length ? fabric.gallery : [fabric.image];
    return photos.map((photo, i) => ({ photo, fallback: fallbacks[i] ?? fallbacks[0] ?? fabric.image }));
  }, [fabric]);

  if (!fabric) {
    return (
      <main className="pt-[160px] pb-20 min-h-screen text-center px-5 bg-white">
        <h1 className="text-3xl font-extrabold mb-4">Weave not found</h1>
        <button onClick={() => navigate({ name: 'shop' })} className="btn-primary">Back to Shop</button>
      </main>
    );
  }

  const stock = fabric.inStockMeters ?? 0;
  const lengthOptions = fabric.lengthOptions ?? [1, 2, 3, 5];
  const pct = discountPct(fabric.pricePerMeter, fabric.mrpPerMeter);
  const wished = hasWish(fabric.id);
  const linePrice = fabric.pricePerMeter * meters;
  const lineMrp = fabric.mrpPerMeter * meters;
  const lineSavings = lineMrp - linePrice;

  const handleAdd = () => {
    addItem({ fabricId: fabric.id, meters, color: selectedColor });
    navigate({ name: 'cart' });
  };

  const handleWish = () => {
    toggleWish(fabric.id);
  };

  const checkPin = () => {
    if (/^[0-9]{6}$/.test(pin.trim())) setPinChecked(true);
    else setPinChecked(false);
  };

  const similar = FABRICS.filter(f => f.id !== fabric.id && f.category === fabric.category).slice(0, 5);

  return (
    <main className="pt-[100px] pb-12 md:pb-16 bg-white min-h-screen">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10">
        {/* Breadcrumb */}
        <nav className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mb-4">
          <button onClick={() => navigate({ name: 'home' })} className="hover:text-[color:var(--color-myntra-pink)]">Home</button>
          <span className="mx-1.5">/</span>
          <button onClick={() => navigate({ name: 'shop' })} className="hover:text-[color:var(--color-myntra-pink)]">Fabrics</button>
          <span className="mx-1.5">/</span>
          <button onClick={() => navigate({ name: 'shop', category: fabric.category })} className="hover:text-[color:var(--color-myntra-pink)]">{fabric.category}</button>
          <span className="mx-1.5">/</span>
          <span className="text-[color:var(--color-myntra-navy)] font-semibold truncate inline-block max-w-[200px] align-bottom">{fabric.name}</span>
        </nav>

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
                <span className="w-px h-3.5 bg-[color:var(--color-myntra-border)]" />
                <span className="text-[12px] text-[color:var(--color-myntra-ink-soft)] font-semibold">{fabric.reviewCount} Ratings</span>
              </div>
            )}

            <hr className="border-[color:var(--color-myntra-border-soft)] mb-4" />

            <div className="flex items-baseline gap-2 flex-wrap mb-1">
              <span className="text-[24px] font-extrabold text-[color:var(--color-myntra-navy)]">{formatINR(fabric.pricePerMeter)}</span>
              {fabric.mrpPerMeter > fabric.pricePerMeter && (
                <>
                  <span className="text-[15px] mrp">MRP {formatINR(fabric.mrpPerMeter)}</span>
                  <span className="text-[15px] font-bold text-[color:var(--color-myntra-orange)]">({pct}% OFF)</span>
                </>
              )}
            </div>
            <p className="text-[13px] font-bold text-[color:var(--color-myntra-green)] mb-1">inclusive of all taxes · per meter</p>
            {lineSavings > 0 && meters > 1 && (
              <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mb-4">You save {formatINR(lineSavings)} on {meters}m</p>
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

            {/* Length pills */}
            <div className="mb-6">
              <div className="flex items-baseline justify-between mb-3">
                <p className="text-[13px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)]">Select Length</p>
                <span className="text-[12px] text-[color:var(--color-myntra-pink)] font-semibold">Size Chart</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {lengthOptions.filter(l => l <= stock).map(l => (
                  <button
                    key={l}
                    onClick={() => setMeters(l)}
                    className={`min-w-[56px] h-11 rounded-full border-2 text-[13px] font-bold transition-colors ${meters === l ? 'border-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)] bg-[#F5E8C8]' : 'border-[color:var(--color-myntra-border)] text-[color:var(--color-myntra-navy)] hover:border-[color:var(--color-myntra-navy)]'}`}
                  >
                    {l} m
                  </button>
                ))}
              </div>
              {stock < 10 && (
                <p className="text-[12px] text-[color:var(--color-myntra-pink)] font-semibold mt-2">
                  Only {stock}m left — order soon
                </p>
              )}
            </div>

            {/* CTAs */}
            <div className="flex gap-3 mb-7">
              <button
                onClick={handleAdd}
                disabled={meters <= 0 || meters > stock}
                className="btn-primary flex-1 inline-flex justify-center items-center gap-2"
              >
                <ShoppingBag className="w-5 h-5" /> Add to Bag
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
            <div className="border border-[color:var(--color-myntra-border-soft)] rounded p-4 mb-6">
              <p className="text-[13px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)] mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Delivery Options
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  value={pin}
                  onChange={e => { setPin(e.target.value); setPinChecked(null); }}
                  placeholder="Enter pincode"
                  inputMode="numeric"
                  className="input-box flex-1"
                />
                <button onClick={checkPin} className="text-[13px] font-bold text-[color:var(--color-myntra-pink)] px-3">CHECK</button>
              </div>
              {pinChecked === true && (
                <p className="text-[13px] text-[color:var(--color-myntra-green)] font-semibold">Delivery in 4-6 business days. Cash on Delivery available.</p>
              )}
              {pinChecked === false && (
                <p className="text-[13px] text-[color:var(--color-myntra-pink)] font-semibold">Please enter a valid 6-digit Indian pincode.</p>
              )}
              <p className="text-[12px] text-[color:var(--color-myntra-ink-soft)] mt-3">Please enter PIN code to check delivery time & Pay on Delivery availability.</p>
            </div>

            {/* Trust strip */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { Icon: Truck, label: '100% Free Shipping' },
                { Icon: RotateCcw, label: '30-Day Returns' },
                { Icon: ShieldCheck, label: 'Authenticity Card' }
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
            {(['specs', 'care', 'returns'] as const).map(key => {
              const labels = {
                specs: 'Product Details',
                care: 'Material & Care',
                returns: 'Returns & Exchange'
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
                          <dt className="text-[color:var(--color-myntra-ink-soft)]">Width</dt><dd className="font-semibold">{fabric.widthInches ? `${fabric.widthInches}"` : '—'}</dd>
                          <dt className="text-[color:var(--color-myntra-ink-soft)]">Weave Type</dt><dd className="font-semibold">{fabric.weaveType ?? '—'}</dd>
                          <dt className="text-[color:var(--color-myntra-ink-soft)]">Origin</dt><dd className="font-semibold">{fabric.origin}</dd>
                          <dt className="text-[color:var(--color-myntra-ink-soft)]">Category</dt><dd className="font-semibold">{fabric.category}</dd>
                          <dt className="text-[color:var(--color-myntra-ink-soft)]">In Stock</dt><dd className="font-semibold">{stock} m</dd>
                          <dt className="text-[color:var(--color-myntra-ink-soft)]">Tags</dt><dd className="font-semibold">{fabric.tags.join(', ')}</dd>
                        </dl>
                      )}
                      {key === 'care' && (
                        <p>Dry-clean only by a specialist familiar with hand-woven heritage textiles. Store rolled in muslin away from direct sunlight. Each parcel ships with a signed authenticity card and care leaflet.</p>
                      )}
                      {key === 'returns' && (
                        <p>Easy 30-day returns on unused, undamaged fabric in original packaging. Cuts above 5m are made-to-order and final sale. Initiate returns from your account.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Similar */}
        {similar.length > 0 && (
          <section className="mt-12 md:mt-16">
            <h2 className="text-xl md:text-2xl font-extrabold mb-5">Similar Products</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
              {similar.map(s => <ProductCard key={s.id} fabric={s} />)}
            </div>
          </section>
        )}

        {/* Reviews */}
        <ReviewsSection fabricId={fabric.id} />
      </div>
    </main>
  );
};

export default ProductPage;
