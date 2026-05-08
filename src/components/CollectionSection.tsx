import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { FABRICS, formatINR } from '../constants';
import { useRouter } from '../context/RouterContext';
import FabricImage from './FabricImage';

const FEATURED_IDS = ['2', '3', '6', '8'];

const CollectionSection = () => {
  const { navigate } = useRouter();
  const featured = FEATURED_IDS
    .map(id => FABRICS.find(f => f.id === id))
    .filter((f): f is NonNullable<typeof f> => f !== undefined);

  return (
    <section id="collections" className="py-20 md:py-[120px] px-5 md:px-16 max-w-[1280px] mx-auto">
      <div className="text-center mb-12 md:mb-16">
        <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-gold mb-3 block">
          House Selections
        </span>
        <h2 className="font-serif text-[40px] md:text-5xl lg:text-[64px] gold-text leading-[1.1] tracking-[-0.02em]">
          A Symphony of <em>Texture</em>
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-8">
        {featured.map((fabric, idx) => (
          <motion.button
            key={fabric.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: idx * 0.08 }}
            onClick={() => navigate({ name: 'product', id: fabric.id })}
            className="group text-left"
          >
            <div className="aspect-[4/5] overflow-hidden bg-brand-surface mb-3 md:mb-5">
              <FabricImage
                photo={fabric.photo}
                fallback={fabric.image}
                alt={fabric.name}
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-1000"
              />
            </div>
            <h3 className="font-serif text-lg md:text-2xl text-brand-ink leading-tight mb-1">{fabric.name}</h3>
            <p className="text-[10px] md:text-[11px] uppercase tracking-[0.1em] font-semibold text-brand-ink-soft mb-2">
              {fabric.category}
            </p>
            <p className="text-sm md:text-base text-brand-ink">
              {formatINR(fabric.pricePerMeter)}<span className="text-xs text-brand-ink-soft">/m</span>
            </p>
          </motion.button>
        ))}
      </div>

      <div className="mt-12 md:mt-16 text-center">
        <button
          onClick={() => navigate({ name: 'shop' })}
          className="text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-gold flex items-center gap-2 group mx-auto"
        >
          View Entire Collection <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </section>
  );
};

export default CollectionSection;
