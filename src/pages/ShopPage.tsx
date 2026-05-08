import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { CATEGORIES, FABRICS, formatINR } from '../constants';
import { useRouter } from '../context/RouterContext';
import { Fabric } from '../types';
import FabricImage from '../components/FabricImage';

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'rating';

interface Props {
  initialCategory?: string;
}

const ShopPage: React.FC<Props> = ({ initialCategory }) => {
  const { navigate } = useRouter();
  const [category, setCategory] = useState<string>(initialCategory ?? 'All');
  const [colorFilter, setColorFilter] = useState<string>('All');
  const [sort, setSort] = useState<SortKey>('featured');

  const colorPalette = useMemo(() => {
    const set = new Set<string>();
    FABRICS.forEach(f => f.colors?.forEach(c => set.add(c.name)));
    return ['All', ...Array.from(set)];
  }, []);

  const filtered = useMemo(() => {
    let list: Fabric[] = FABRICS.filter(f =>
      (category === 'All' || f.category === category) &&
      (colorFilter === 'All' || (f.colors ?? []).some(c => c.name === colorFilter))
    );
    switch (sort) {
      case 'price-asc': list = [...list].sort((a, b) => a.pricePerMeter - b.pricePerMeter); break;
      case 'price-desc': list = [...list].sort((a, b) => b.pricePerMeter - a.pricePerMeter); break;
      case 'rating': list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)); break;
    }
    return list;
  }, [category, colorFilter, sort]);

  return (
    <main className="flex-grow pt-[120px] pb-[120px] px-6 md:px-16 max-w-[1280px] mx-auto w-full">
      <div className="text-center mb-16">
        <h1 className="font-serif text-5xl md:text-[64px] gold-text mb-4">Artisanal Gallery</h1>
        <p className="text-base text-brand-ink-soft max-w-xl mx-auto">
          Discover our exclusive collection of premium fabrics, curated for the discerning creator.
          Explore textures that transcend time.
        </p>
      </div>

      {/* Filter strip */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-12 border-b border-brand-outline/30 pb-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="appearance-none bg-transparent pr-8 text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-ink hover:text-brand-gold cursor-pointer"
            >
              <option value="All">Material · All</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={colorFilter}
              onChange={e => setColorFilter(e.target.value)}
              className="appearance-none bg-transparent pr-8 text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-ink hover:text-brand-gold cursor-pointer"
            >
              <option value="All">Colour · All</option>
              {colorPalette.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-ink-soft">
            {filtered.length} items
          </span>
          <div className="relative">
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="appearance-none bg-transparent pr-8 text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-ink hover:text-brand-gold cursor-pointer"
            >
              <option value="featured">Sort by · Featured</option>
              <option value="price-asc">Price · Low to High</option>
              <option value="price-desc">Price · High to Low</option>
              <option value="rating">Top Rated</option>
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-brand-outline/30 bg-brand-bg-soft p-16 text-center">
          <p className="font-serif text-2xl mb-2">No weaves match your filters.</p>
          <p className="text-sm text-brand-ink-soft">Try widening your selection.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
          {filtered.map((fabric, idx) => (
            <motion.button
              key={fabric.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.05 }}
              onClick={() => navigate({ name: 'product', id: fabric.id })}
              className="group text-left"
            >
              <div className="aspect-[4/3] overflow-hidden bg-brand-surface mb-5">
                <FabricImage
                  photo={fabric.photo}
                  fallback={fabric.image}
                  alt={fabric.name}
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-1000"
                />
              </div>
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-serif text-2xl text-brand-ink leading-tight">{fabric.name}</h3>
                  <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-brand-ink-soft mt-1">
                    {fabric.category}
                  </p>
                </div>
                <p className="text-base text-brand-ink whitespace-nowrap">
                  {formatINR(fabric.pricePerMeter)}<span className="text-xs text-brand-ink-soft">/m</span>
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <div className="mt-16 text-center">
        <span className="block w-12 h-px bg-brand-outline/40 mx-auto mb-8" />
        <button
          onClick={() => setCategory('All')}
          className="border border-brand-gold text-brand-gold px-10 py-3 text-[11px] uppercase tracking-[0.15em] font-semibold hover:bg-brand-gold hover:text-brand-bg transition-all"
        >
          View Entire Collection
        </button>
      </div>
    </main>
  );
};

export default ShopPage;
