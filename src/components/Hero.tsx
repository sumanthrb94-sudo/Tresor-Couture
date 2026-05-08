import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { HERO_PHOTO, HERO_IMAGE } from '../constants';
import { useRouter } from '../context/RouterContext';
import FabricImage from './FabricImage';

const Hero = () => {
  const { navigate } = useRouter();

  return (
    <section className="pt-[120px] pb-[120px] px-6 md:px-16 max-w-[1280px] mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-gold mb-6 block">
            Heritage · Revival · Couture
          </span>
          <h1 className="font-serif text-5xl md:text-[64px] leading-[1.1] tracking-[-0.02em] gold-text mb-6">
            A Textile <em>Treasure</em><br />for the Discerning Creator
          </h1>
          <p className="text-lg text-brand-ink-soft leading-relaxed mb-10 max-w-md">
            We rescue India's dying weaves and place them in the hands of designers who care.
            Each meter is hand-cut and dispatched with an authenticity card signed by the master weaver.
          </p>
          <div className="flex flex-wrap gap-4 items-center">
            <button onClick={() => navigate({ name: 'shop' })} className="btn-gold">
              Shop the Atelier
            </button>
            <button
              onClick={() => navigate({ name: 'shop', category: 'Silk' })}
              className="text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-ink hover:text-brand-gold flex items-center gap-2 group"
            >
              Browse Silks <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2 }}
          className="relative aspect-[4/5] bg-brand-surface overflow-hidden"
        >
          <FabricImage
            photo={HERO_PHOTO}
            fallback={HERO_IMAGE}
            alt="Selected weave"
            fetchPriority="high"
            className="w-full h-full object-cover"
          />
          <div
            className="absolute bottom-6 left-6 bg-brand-bg-soft px-6 py-4 max-w-[200px] border border-brand-outline/30"
          >
            <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-brand-gold mb-1">Selected Weave</p>
            <p className="font-serif italic text-xl text-brand-ink leading-tight">Varanasi Gold</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
