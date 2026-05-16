import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HERO_BANNERS } from '../constants';
import type { MasterCategory } from '../types';
import { useRouter } from '../context/RouterContext';
import FabricImage from './FabricImage';

// Maps the legacy weave-based banner CTAs onto the new master taxonomy so each
// banner deep-links into a real catalogue section instead of an orphan filter.
const BANNER_DESTINATION: Record<string, { category: MasterCategory; subCategory?: string }> = {
  bridal: { category: 'Lehenga Cholis', subCategory: 'Bridal' },
  summer: { category: 'Fabrics', subCategory: 'Linen' },
  winter: { category: 'Fabrics', subCategory: 'Wool' }
};

const Hero: React.FC = () => {
  const { navigate } = useRouter();
  const [idx, setIdx] = useState(0);
  const total = HERO_BANNERS.length;

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % total), 5500);
    return () => clearInterval(t);
  }, [total]);

  const banner = HERO_BANNERS[idx];

  const go = (n: number) => setIdx((n + total) % total);

  return (
    <section className="relative pt-[92px] md:pt-[108px]">
      <div className="relative w-full h-[520px] md:h-[560px] lg:h-[600px] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={banner.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{ background: banner.bg }}
            className="absolute inset-0"
          >
            {/* Mobile: full-bleed image with gradient overlay; Desktop: split layout */}
            <div className="absolute inset-0 md:hidden">
              <FabricImage
                photo={banner.photo}
                fallback={banner.fallback}
                alt={banner.title}
                loading="eager"
                fetchPriority="high"
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(42,37,32,0.78)] via-[rgba(42,37,32,0.35)] to-[rgba(42,37,32,0.0)]" />
            </div>

            <div className="absolute inset-0 grid md:grid-cols-2 items-end md:items-center">
              <div className="px-6 md:px-12 lg:px-20 pb-10 md:pb-0 pt-8 md:pt-0 text-white md:text-[color:var(--color-myntra-navy)]">
                <p
                  className="text-[11px] md:text-[12px] font-extrabold tracking-[0.2em] uppercase mb-3 text-[color:var(--color-myntra-yellow)] md:text-[color:var(--color-myntra-pink)]"
                  style={{ color: undefined }}
                >
                  <span className="md:hidden">{banner.eyebrow}</span>
                  <span className="hidden md:inline" style={{ color: banner.accent }}>{banner.eyebrow}</span>
                </p>
                <h1 className="text-[32px] md:text-[44px] lg:text-[56px] font-extrabold leading-[1.05] mb-4 max-w-[520px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)] md:drop-shadow-none">
                  {banner.title}
                </h1>
                <p className="text-[14px] md:text-[16px] text-white/90 md:text-[color:var(--color-myntra-ink)] max-w-[480px] mb-6 md:mb-9 drop-shadow md:drop-shadow-none">
                  {banner.subtitle}
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      const dest = BANNER_DESTINATION[banner.id];
                      navigate(
                        dest
                          ? { name: 'shop', category: dest.category, subCategory: dest.subCategory }
                          : { name: 'shop' }
                      );
                    }}
                    className="btn-primary"
                    style={{ background: banner.accent }}
                  >
                    {banner.ctaLabel}
                  </button>
                  <button onClick={() => navigate({ name: 'shop' })} className="btn-outline">
                    View All
                  </button>
                </div>
              </div>

              {/* Desktop image panel */}
              <div className="hidden md:block relative h-full overflow-hidden">
                <FabricImage
                  photo={banner.photo}
                  fallback={banner.fallback}
                  alt={banner.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(90deg, var(--color-myntra-bg) 0%, rgba(251,245,235,0.2) 35%, transparent 60%)' }}
                />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Arrows */}
        <button
          onClick={() => go(idx - 1)}
          aria-label="Previous"
          className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center z-10"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => go(idx + 1)}
          aria-label="Next"
          className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center z-10"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {HERO_BANNERS.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-8 bg-[color:var(--color-myntra-pink)]' : 'w-3 bg-white/80'}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Hero;
