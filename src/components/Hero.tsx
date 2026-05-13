import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HERO_BANNERS } from '../constants';
import { useRouter } from '../context/RouterContext';
import FabricImage from './FabricImage';

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
    <section className="relative pt-[88px] md:pt-[100px]">
      <div className="relative w-full h-[420px] md:h-[520px] lg:h-[560px] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={banner.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{ background: banner.bg }}
            className="absolute inset-0 grid grid-cols-1 md:grid-cols-2 items-center"
          >
            <div className="px-6 md:px-12 lg:px-20 py-8 md:py-0 text-[color:var(--color-myntra-navy)]">
              <p
                className="text-[11px] md:text-[12px] font-extrabold tracking-[0.2em] uppercase mb-3"
                style={{ color: banner.accent }}
              >
                {banner.eyebrow}
              </p>
              <h1 className="text-[34px] md:text-[44px] lg:text-[56px] font-extrabold leading-[1.05] mb-4 max-w-[520px]">
                {banner.title}
              </h1>
              <p className="text-[14px] md:text-[16px] text-[color:var(--color-myntra-ink)] max-w-[480px] mb-7 md:mb-9">
                {banner.subtitle}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate({ name: 'shop', category: banner.ctaCategory })}
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
            <div className="hidden md:block relative h-full overflow-hidden">
              <FabricImage
                photo={banner.photo}
                fallback={banner.fallback}
                alt={banner.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${banner.bg.includes('linear-gradient') ? 'rgba(255,255,255,0.0)' : '#fff'} 0%, transparent 30%)` }} />
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Arrows */}
        <button
          onClick={() => go(idx - 1)}
          aria-label="Previous"
          className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => go(idx + 1)}
          aria-label="Next"
          className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
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
