import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Check, Minus, Plus, ShieldCheck, Star, Truck } from 'lucide-react';
import { FABRICS, formatINR } from '../constants';
import { useRouter } from '../context/RouterContext';
import { useCart } from '../context/CartContext';
import FabricImage from '../components/FabricImage';

interface Props {
  productId: string;
}

const ProductPage: React.FC<Props> = ({ productId }) => {
  const { navigate } = useRouter();
  const { addItem } = useCart();
  const fabric = FABRICS.find(f => f.id === productId);

  const defaultColor = fabric?.colors?.[0]?.name;
  const [selectedColor, setSelectedColor] = useState<string | undefined>(defaultColor);
  const [meters, setMeters] = useState<number>(1);
  const [activeImage, setActiveImage] = useState<number>(0);
  const [added, setAdded] = useState(false);

  // Pair each photo with its swatch fallback so a dead URL never leaves a blank tile.
  const gallery = useMemo(() => {
    if (!fabric) return [] as { photo: string; fallback: string }[];
    const photos = fabric.photoGallery?.length ? fabric.photoGallery : [fabric.photo];
    const fallbacks = fabric.gallery?.length ? fabric.gallery : [fabric.image];
    return photos.map((photo, i) => ({ photo, fallback: fallbacks[i] ?? fallbacks[0] ?? fabric.image }));
  }, [fabric]);

  if (!fabric) {
    return (
      <section className="pt-[160px] pb-32 min-h-screen text-center px-6">
        <h1 className="text-3xl font-serif mb-4">Weave not found</h1>
        <button
          onClick={() => navigate({ name: 'shop' })}
          className="text-[10px] uppercase tracking-widest underline"
        >
          Back to Shop
        </button>
      </section>
    );
  }

  const stock = fabric.inStockMeters ?? 0;
  const subtotal = meters * fabric.pricePerMeter;

  const handleAdd = () => {
    addItem({ fabricId: fabric.id, meters, color: selectedColor });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const adjust = (delta: number) => {
    setMeters(m => {
      const next = Math.round((m + delta) * 2) / 2;
      if (next < 0.5) return 0.5;
      if (stock && next > stock) return stock;
      return next;
    });
  };

  return (
    <section className="pt-[120px] pb-24 bg-brand-bg min-h-screen">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <button
          onClick={() => navigate({ name: 'shop' })}
          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/60 hover:text-brand-gold mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Shop
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Gallery */}
          <div>
            <motion.div
              key={activeImage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="aspect-[4/5] bg-white border border-brand-border overflow-hidden"
            >
              <FabricImage
                photo={gallery[activeImage].photo}
                fallback={gallery[activeImage].fallback}
                alt={fabric.name}
                className="w-full h-full object-cover"
              />
            </motion.div>
            {gallery.length > 1 && (
              <div className="grid grid-cols-4 gap-3 mt-4">
                {gallery.map((g, idx) => (
                  <button
                    key={g.photo}
                    onClick={() => setActiveImage(idx)}
                    className={`aspect-square overflow-hidden border-2 transition-colors ${
                      activeImage === idx ? 'border-brand-gold' : 'border-brand-border'
                    }`}
                  >
                    <FabricImage
                      photo={g.photo}
                      fallback={g.fallback}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <p className="text-[9px] uppercase tracking-[0.4em] text-brand-gold font-bold mb-3">
              {fabric.origin} · {fabric.category}
            </p>
            <h1 className="text-4xl md:text-5xl font-serif mb-4">{fabric.name}</h1>

            {fabric.rating && (
              <div className="flex items-center gap-3 mb-6">
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < Math.round(fabric.rating ?? 0)
                          ? 'fill-brand-gold stroke-brand-gold'
                          : 'stroke-brand-ink/30'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-brand-ink/60">
                  {fabric.rating.toFixed(1)} · {fabric.reviewCount ?? 0} reviews
                </span>
              </div>
            )}

            <p className="text-brand-ink/70 leading-relaxed mb-8">{fabric.description}</p>

            <div className="flex items-end gap-3 mb-8">
              <span className="text-3xl font-serif">{formatINR(fabric.pricePerMeter)}</span>
              <span className="text-sm text-brand-ink/50 mb-1">per meter</span>
            </div>

            <div className="flex flex-wrap gap-2 mb-8">
              {fabric.tags.map(t => (
                <span
                  key={t}
                  className="border border-brand-border px-3 py-1 text-[10px] uppercase tracking-widest text-brand-ink/70"
                >
                  {t}
                </span>
              ))}
            </div>

            {fabric.colors && fabric.colors.length > 0 && (
              <div className="mb-8">
                <p className="text-[10px] uppercase tracking-[0.3em] font-bold mb-3">
                  Colour · <span className="text-brand-ink/60 normal-case tracking-normal font-normal">{selectedColor}</span>
                </p>
                <div className="flex gap-3">
                  {fabric.colors.map(c => (
                    <button
                      key={c.name}
                      onClick={() => setSelectedColor(c.name)}
                      title={c.name}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${
                        selectedColor === c.name ? 'border-brand-gold scale-110' : 'border-brand-border'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="mb-8">
              <p className="text-[10px] uppercase tracking-[0.3em] font-bold mb-3">Length (meters)</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-brand-ink">
                  <button
                    onClick={() => adjust(-0.5)}
                    className="px-4 py-3 hover:bg-brand-ink hover:text-white transition-colors"
                    aria-label="Decrease length"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-6 py-3 min-w-[80px] text-center font-medium">{meters} m</span>
                  <button
                    onClick={() => adjust(0.5)}
                    className="px-4 py-3 hover:bg-brand-ink hover:text-white transition-colors"
                    aria-label="Increase length"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-sm text-brand-ink/60">
                  Subtotal · <span className="font-semibold text-brand-ink">{formatINR(subtotal)}</span>
                </span>
              </div>
              <p className="text-[11px] text-brand-ink/50 mt-3">
                Cut in 0.5m increments. {stock} m currently available.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <button
                onClick={handleAdd}
                disabled={meters <= 0 || meters > stock}
                className="bg-brand-ink text-white px-10 py-4 text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-brand-gold transition-colors duration-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {added ? (
                  <>
                    <Check className="w-4 h-4" /> Added to Cart
                  </>
                ) : (
                  'Add to Cart'
                )}
              </button>
              <button
                onClick={() => {
                  addItem({ fabricId: fabric.id, meters, color: selectedColor });
                  navigate({ name: 'checkout' });
                }}
                disabled={meters <= 0 || meters > stock}
                className="border border-brand-ink px-10 py-4 text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-brand-ink hover:text-white transition-colors duration-500 disabled:opacity-40"
              >
                Buy Now
              </button>
            </div>

            <div className="border-t border-brand-border pt-8 grid grid-cols-2 gap-6 text-xs">
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-brand-gold shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold uppercase tracking-widest text-[10px]">Worldwide Shipping</p>
                  <p className="text-brand-ink/60 mt-1">Free above ₹10,000. Dispatched in 2 business days.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-brand-gold shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold uppercase tracking-widest text-[10px]">Authenticity Card</p>
                  <p className="text-brand-ink/60 mt-1">Each parcel is signed by the master weaver.</p>
                </div>
              </div>
            </div>

            <div className="mt-10 border-t border-brand-border pt-8">
              <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold mb-4">Specifications</h3>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <dt className="text-brand-ink/50">Width</dt>
                <dd>{fabric.widthInches ?? '—'}"</dd>
                <dt className="text-brand-ink/50">Weave</dt>
                <dd>{fabric.weaveType ?? '—'}</dd>
                <dt className="text-brand-ink/50">Origin</dt>
                <dd>{fabric.origin}</dd>
                <dt className="text-brand-ink/50">Category</dt>
                <dd>{fabric.category}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductPage;
