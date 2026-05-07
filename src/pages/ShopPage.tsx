import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Star } from 'lucide-react';
import { CATEGORIES, FABRICS, formatINR } from '../constants';
import { useRouter } from '../context/RouterContext';
import { Fabric } from '../types';

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'rating';

interface Props {
  initialCategory?: string;
}

const ShopPage: React.FC<Props> = ({ initialCategory }) => {
  const { navigate } = useRouter();
  const [category, setCategory] = useState<string>(initialCategory ?? 'All');
  const [origin, setOrigin] = useState<string>('All');
  const [sort, setSort] = useState<SortKey>('featured');
  const [maxPrice, setMaxPrice] = useState<number>(30000);

  const origins = useMemo(() => ['All', ...Array.from(new Set(FABRICS.map(f => f.origin)))], []);

  const filtered = useMemo(() => {
    let list: Fabric[] = FABRICS.filter(f =>
      (category === 'All' || f.category === category) &&
      (origin === 'All' || f.origin === origin) &&
      f.pricePerMeter <= maxPrice
    );
    switch (sort) {
      case 'price-asc':
        list = [...list].sort((a, b) => a.pricePerMeter - b.pricePerMeter);
        break;
      case 'price-desc':
        list = [...list].sort((a, b) => b.pricePerMeter - a.pricePerMeter);
        break;
      case 'rating':
        list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      default:
        break;
    }
    return list;
  }, [category, origin, sort, maxPrice]);

  return (
    <section className="pt-[140px] pb-32 bg-brand-bg min-h-screen">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="mb-16">
          <span className="text-brand-gold text-[9px] uppercase tracking-[0.4em] mb-4 block font-bold">
            The Atelier
          </span>
          <h1 className="text-4xl md:text-6xl font-serif leading-tight">
            Shop <span className="italic">Our Weaves</span>
          </h1>
          <p className="text-brand-ink/60 font-light mt-4 max-w-xl text-sm">
            Browse the full catalogue. Order by the meter; we cut to length, parcel with care, and ship worldwide.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-12">
          {/* Filters */}
          <aside className="border border-brand-border bg-white p-8 h-fit lg:sticky lg:top-[120px]">
            <h2 className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-gold mb-6">Refine</h2>

            <div className="mb-8">
              <p className="text-[10px] uppercase tracking-widest font-semibold mb-4">Category</p>
              <div className="flex flex-col gap-2">
                {['All', ...CATEGORIES].map(c => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`text-left text-sm py-1 transition-colors ${
                      category === c ? 'text-brand-gold font-semibold' : 'text-brand-ink/70 hover:text-brand-ink'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <p className="text-[10px] uppercase tracking-widest font-semibold mb-4">Origin</p>
              <select
                value={origin}
                onChange={e => setOrigin(e.target.value)}
                className="w-full border border-brand-border bg-brand-bg px-3 py-2 text-sm focus:outline-none focus:border-brand-gold"
              >
                {origins.map(o => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-8">
              <p className="text-[10px] uppercase tracking-widest font-semibold mb-4">
                Max Price · {formatINR(maxPrice)}/m
              </p>
              <input
                type="range"
                min={1500}
                max={30000}
                step={500}
                value={maxPrice}
                onChange={e => setMaxPrice(Number(e.target.value))}
                className="w-full accent-brand-gold"
              />
            </div>

            <button
              onClick={() => {
                setCategory('All');
                setOrigin('All');
                setSort('featured');
                setMaxPrice(30000);
              }}
              className="text-[10px] uppercase tracking-[0.2em] font-bold underline text-brand-ink/60 hover:text-brand-gold"
            >
              Reset Filters
            </button>
          </aside>

          {/* Grid */}
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <p className="text-sm text-brand-ink/60">
                {filtered.length} {filtered.length === 1 ? 'weave' : 'weaves'}
              </p>
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-widest text-brand-ink/50">Sort</span>
                <select
                  value={sort}
                  onChange={e => setSort(e.target.value as SortKey)}
                  className="border border-brand-border bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand-gold"
                >
                  <option value="featured">Featured</option>
                  <option value="price-asc">Price · Low to High</option>
                  <option value="price-desc">Price · High to Low</option>
                  <option value="rating">Top Rated</option>
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="border border-brand-border bg-white p-16 text-center">
                <p className="font-serif italic text-2xl mb-2">No weaves match your filters.</p>
                <p className="text-sm text-brand-ink/60">Try widening your selection.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-px bg-brand-border border border-brand-border">
                {filtered.map((fabric, idx) => (
                  <motion.button
                    key={fabric.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: idx * 0.04 }}
                    onClick={() => navigate({ name: 'product', id: fabric.id })}
                    className="group bg-brand-bg text-left p-6 hover:bg-brand-accent/30 transition-colors duration-500"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden mb-5 bg-white border border-brand-border">
                      <img
                        src={fabric.image}
                        alt={fabric.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000"
                      />
                      {(fabric.inStockMeters ?? 0) < 15 && (
                        <span className="absolute top-3 left-3 bg-brand-ink text-white text-[8px] uppercase tracking-widest px-2 py-1">
                          Limited
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] uppercase tracking-[0.3em] text-brand-gold font-bold mb-2">
                      {fabric.origin}
                    </p>
                    <h3 className="text-xl font-serif italic mb-2 group-hover:not-italic transition-all">
                      {fabric.name}
                    </h3>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-sm font-medium">
                        {formatINR(fabric.pricePerMeter)} <span className="text-xs text-brand-ink/50">/ meter</span>
                      </span>
                      {fabric.rating && (
                        <span className="flex items-center gap-1 text-xs text-brand-ink/60">
                          <Star className="w-3 h-3 fill-brand-gold stroke-brand-gold" />
                          {fabric.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ShopPage;
