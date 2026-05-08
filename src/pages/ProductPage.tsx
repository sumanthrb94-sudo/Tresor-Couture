import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, ShoppingBag } from 'lucide-react';
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
  const [openSection, setOpenSection] = useState<'specs' | 'care' | null>('specs');

  const gallery = useMemo(() => {
    if (!fabric) return [] as { photo: string; fallback: string }[];
    const photos = fabric.photoGallery?.length ? fabric.photoGallery : [fabric.photo];
    const fallbacks = fabric.gallery?.length ? fabric.gallery : [fabric.image];
    return photos.map((photo, i) => ({ photo, fallback: fallbacks[i] ?? fallbacks[0] ?? fabric.image }));
  }, [fabric]);

  if (!fabric) {
    return (
      <main className="pt-[160px] pb-[120px] min-h-screen text-center px-6">
        <h1 className="font-serif text-4xl text-brand-gold mb-4">Weave not found</h1>
        <button onClick={() => navigate({ name: 'shop' })} className="btn-gold">Back to Shop</button>
      </main>
    );
  }

  const stock = fabric.inStockMeters ?? 0;
  const lengthOptions: number[] = [];
  for (let i = 0.5; i <= Math.min(stock, 10); i += 0.5) lengthOptions.push(i);

  const handleAdd = () => {
    addItem({ fabricId: fabric.id, meters, color: selectedColor });
    navigate({ name: 'cart' });
  };

  return (
    <main className="flex-grow pt-[120px] pb-[120px] px-6 md:px-16 max-w-[1280px] mx-auto w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
        {/* Gallery */}
        <div>
          <motion.div
            key={activeImage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="aspect-[4/5] bg-brand-surface overflow-hidden"
          >
            <FabricImage
              photo={gallery[activeImage].photo}
              fallback={gallery[activeImage].fallback}
              alt={fabric.name}
              className="w-full h-full object-cover"
            />
          </motion.div>
          {gallery.length > 1 && (
            <div className="grid grid-cols-5 gap-3 mt-4">
              {gallery.map((g, idx) => (
                <button
                  key={g.photo}
                  onClick={() => setActiveImage(idx)}
                  className={`aspect-square overflow-hidden border transition-colors ${
                    activeImage === idx ? 'border-brand-gold' : 'border-brand-outline/30'
                  }`}
                >
                  <FabricImage photo={g.photo} fallback={g.fallback} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <h1 className="font-serif text-[40px] md:text-[48px] gold-text leading-tight mb-3">
            {fabric.name}
          </h1>
          <p className="text-base text-brand-ink mb-6">
            <span className="font-medium">{formatINR(fabric.pricePerMeter)}</span>
            <span className="text-brand-ink-soft"> / meter</span>
          </p>

          <p className="text-base text-brand-ink-soft leading-relaxed mb-8">
            {fabric.description}
          </p>

          {fabric.colors && fabric.colors.length > 0 && (
            <div className="mb-6">
              <span className="block text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-ink-soft mb-3">
                Colour · <span className="text-brand-ink normal-case font-normal tracking-normal">{selectedColor}</span>
              </span>
              <div className="flex gap-3">
                {fabric.colors.map(c => (
                  <button
                    key={c.name}
                    onClick={() => setSelectedColor(c.name)}
                    title={c.name}
                    className={`w-9 h-9 rounded-full border-2 transition-all ${
                      selectedColor === c.name ? 'border-brand-gold scale-110' : 'border-brand-outline/40'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 mb-8">
            <label htmlFor="length" className="text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-ink-soft">
              Length
            </label>
            <div className="relative flex-grow max-w-[180px]">
              <select
                id="length"
                value={meters}
                onChange={e => setMeters(Number(e.target.value))}
                className="input-underline text-base text-brand-ink py-1 pr-8 cursor-pointer w-full"
              >
                {lengthOptions.map(opt => (
                  <option key={opt} value={opt}>{opt} m</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={meters <= 0 || meters > stock}
            className="btn-gold w-full flex justify-center items-center gap-2 mb-8"
          >
            <span>Add to Bag</span>
            <ShoppingBag className="w-4 h-4" />
          </button>

          {/* Specifications accordion */}
          <div className="border-t border-brand-outline/30">
            <button
              onClick={() => setOpenSection(openSection === 'specs' ? null : 'specs')}
              className="w-full flex justify-between items-center py-5 font-serif text-xl text-brand-ink"
            >
              Specifications
              <ChevronDown className={`w-5 h-5 transition-transform ${openSection === 'specs' ? 'rotate-180' : ''}`} />
            </button>
            {openSection === 'specs' && (
              <dl className="grid grid-cols-2 gap-x-8 gap-y-3 pb-5 text-sm">
                <dt className="text-brand-ink-soft">Width</dt>
                <dd>{fabric.widthInches ? `${fabric.widthInches}"` : '—'}</dd>
                <dt className="text-brand-ink-soft">Weave</dt>
                <dd>{fabric.weaveType ?? '—'}</dd>
                <dt className="text-brand-ink-soft">Origin</dt>
                <dd>{fabric.origin}</dd>
                <dt className="text-brand-ink-soft">Category</dt>
                <dd>{fabric.category}</dd>
                <dt className="text-brand-ink-soft">In Stock</dt>
                <dd>{stock} m</dd>
              </dl>
            )}
          </div>

          <div className="border-t border-brand-outline/30">
            <button
              onClick={() => setOpenSection(openSection === 'care' ? null : 'care')}
              className="w-full flex justify-between items-center py-5 font-serif text-xl text-brand-ink"
            >
              Care Instructions
              <ChevronDown className={`w-5 h-5 transition-transform ${openSection === 'care' ? 'rotate-180' : ''}`} />
            </button>
            {openSection === 'care' && (
              <p className="pb-5 text-sm text-brand-ink-soft leading-relaxed">
                Dry-clean only by a specialist familiar with hand-woven heritage textiles.
                Store rolled in muslin away from direct sunlight.
                Each parcel ships with a signed authenticity card and care leaflet.
              </p>
            )}
          </div>
          <div className="border-t border-brand-outline/30" />
        </div>
      </div>
    </main>
  );
};

export default ProductPage;
