import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Star } from 'lucide-react';
import { COLLECTIONS, FABRICS, formatINR } from '../constants';
import { useRouter } from '../context/RouterContext';
import FabricImage from './FabricImage';

const FEATURED_IDS = ['2', '3', '6', '8'];

const CollectionSection = () => {
  const { navigate } = useRouter();
  const featured = FEATURED_IDS
    .map(id => FABRICS.find(f => f.id === id))
    .filter((f): f is NonNullable<typeof f> => f !== undefined);

  return (
    <section id="collections" className="py-32 bg-brand-bg border-t border-brand-border">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
          <div className="max-w-2xl">
            <span className="text-brand-gold text-[9px] uppercase tracking-[0.4em] mb-6 block font-bold">
              Collections
            </span>
            <h2 className="text-4xl md:text-6xl font-serif leading-tight">
              A Symphony of <span className="italic">Texture</span> & Balance
            </h2>
          </div>
          <button
            onClick={() => navigate({ name: 'shop' })}
            className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 group border-b border-brand-ink/20 pb-2 hover:border-brand-gold transition-all duration-500"
          >
            Shop All Weaves <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Curated catalogues */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-brand-border border border-brand-border overflow-hidden mb-24">
          {COLLECTIONS.map((collection, index) => (
            <motion.button
              key={collection.id}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
              viewport={{ once: true }}
              onClick={() => navigate({ name: 'shop' })}
              className="bg-brand-bg group cursor-pointer p-12 hover:bg-brand-accent/20 transition-all duration-700 text-left"
            >
              <div className="relative aspect-[16/9] overflow-hidden mb-10 shadow-sm border border-brand-border p-2 bg-white">
                <FabricImage
                  photo={collection.coverPhoto}
                  fallback={collection.coverImage}
                  alt={collection.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-all duration-1000"
                />
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-3xl font-serif mb-3 italic group-hover:not-italic transition-all">
                    {collection.name}
                  </h3>
                  <p className="text-[10px] font-bold text-brand-gold uppercase tracking-[0.2em]">
                    {collection.subtitle}
                  </p>
                </div>
                <div className="group-hover:translate-x-2 transition-transform duration-500 text-brand-ink/20 group-hover:text-brand-gold">
                  <ArrowRight className="w-10 h-10" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Featured products */}
        <div className="flex justify-between items-end mb-10">
          <div>
            <span className="text-brand-gold text-[9px] uppercase tracking-[0.4em] mb-3 block font-bold">
              Featured
            </span>
            <h3 className="text-3xl md:text-4xl font-serif italic">House Selections</h3>
          </div>
          <button
            onClick={() => navigate({ name: 'shop' })}
            className="text-[10px] uppercase tracking-widest font-bold hidden sm:flex items-center gap-2 group hover:text-brand-gold"
          >
            View All <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-brand-border border border-brand-border">
          {featured.map((fabric, idx) => (
            <motion.button
              key={fabric.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              onClick={() => navigate({ name: 'product', id: fabric.id })}
              className="group bg-brand-bg p-6 text-left hover:bg-brand-accent/20 transition-colors duration-500"
            >
              <div className="aspect-[4/5] overflow-hidden mb-5 bg-white border border-brand-border">
                <FabricImage
                  photo={fabric.photo}
                  fallback={fabric.image}
                  alt={fabric.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-all duration-1000"
                />
              </div>
              <p className="text-[9px] uppercase tracking-[0.3em] text-brand-gold font-bold mb-2">
                {fabric.origin}
              </p>
              <h4 className="text-lg font-serif italic mb-2 group-hover:not-italic transition-all">
                {fabric.name}
              </h4>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{formatINR(fabric.pricePerMeter)}<span className="text-xs text-brand-ink/50">/m</span></span>
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
      </div>
    </section>
  );
};

export default CollectionSection;
