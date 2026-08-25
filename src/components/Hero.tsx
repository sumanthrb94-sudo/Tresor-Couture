import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MASTER_CATEGORY_TILES } from '../constants';
import { useRouter } from '../context/RouterContext';
import { useCatalog } from '../context/CatalogContext';
import { categoryShowcase } from '../lib/showcase';
import FabricImage from './FabricImage';

/**
 * The hero, built from the catalogue.
 *
 * It was three fixed slides: stock photography, and copy promising Banarasi,
 * Kanjivaram, Patola and Bandhani — "six families of weavers" the atelier has
 * never listed — over CTAs pointing at `Sarees` and `Fabrics`. The very first
 * screen a customer saw was the one part of the site with no connection to what
 * is for sale.
 *
 * Now one slide per master category that has live pieces, deepest shelf first:
 * a real photograph of a real piece, the subcategories actually in stock, and a
 * CTA into that category. Photograph a lehenga today and it is the hero
 * tomorrow, with nobody editing a constant.
 *
 * The tagline under each title is the one piece of hand-written copy left, from
 * MASTER_CATEGORY_TILES — it describes the CATEGORY rather than any particular
 * stock ("For the aisle and after"), so it stays true as pieces come and go.
 */

const MAX_SLIDES = 4;

/** Warm neutrals for the panel behind each slide, cycled. */
const BACKDROPS = [
  { bg: 'linear-gradient(135deg,#FBF5EB 0%,#F2E4C4 55%,#E5C97A 100%)', accent: '#B8915A' },
  { bg: 'linear-gradient(135deg,#FBF6EE 0%,#F0E2C5 55%,#D9C28B 100%)', accent: '#A07840' },
  { bg: 'linear-gradient(135deg,#F5EFE2 0%,#E5D9BC 55%,#B89F6E 100%)', accent: '#6B5A2E' },
  { bg: 'linear-gradient(135deg,#FAF3F0 0%,#EBD9CF 55%,#D6B79F 100%)', accent: '#8E6520' },
];

interface Slide {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  category: string;
  photo: string;
  fallback: string;
  bg: string;
  accent: string;
}

const Hero: React.FC = () => {
  const { navigate } = useRouter();
  const { products } = useCatalog();
  const [idx, setIdx] = useState(0);

  const slides = useMemo<Slide[]>(() => {
    const tagline = new Map(MASTER_CATEGORY_TILES.map(t => [t.name as string, t.tagline]));
    return categoryShowcase(products).slice(0, MAX_SLIDES).map((s, i) => {
      const back = BACKDROPS[i % BACKDROPS.length];
      return {
        id: s.category,
        eyebrow: s.category.toUpperCase(),
        title: tagline.get(s.category) ?? s.category,
        // What is on the shelf, in the designer's order — and a plain count when
        // a category has no subcategories yet, rather than an empty line.
        subtitle: s.subcategories.length
          ? `${s.subcategories.slice(0, 5).join(' · ')} — ${s.count} piece${s.count === 1 ? '' : 's'} ready to ship.`
          : `${s.count} piece${s.count === 1 ? '' : 's'} ready to ship.`,
        ctaLabel: `Shop ${s.category}`,
        category: s.category,
        photo: s.photo,
        fallback: s.hero?.image ?? s.photo,
        ...back,
      };
    });
  }, [products]);

  const total = slides.length;

  useEffect(() => {
    // Reset when the catalogue arrives and the slide count changes, or the
    // index can point past the end for a frame.
    setIdx(i => (total ? i % total : 0));
  }, [total]);

  useEffect(() => {
    if (total < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % total), 5500);
    return () => clearInterval(t);
  }, [total]);

  const banner = slides[idx];

  const go = (n: number) => setIdx((n + total) % total);

  // Nothing to show is a shorter page, not a fake one. The catalogue load is
  // quick and this only ever renders empty before it lands or if it failed.
  if (!banner) return null;

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
                {/* On mobile the eyebrow sits over the photograph itself, above
                    where the bottom gradient has any strength, so it carries the
                    same shadow as the title or it washes out on a bright frame. */}
                <p
                  className="text-[11px] md:text-[12px] font-extrabold tracking-[0.2em] uppercase mb-3 text-[color:var(--color-myntra-yellow)] md:text-[color:var(--color-myntra-pink)] drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] md:drop-shadow-none"
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
                      navigate({ name: 'shop', category: banner.category });
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
          {slides.map((_, i) => (
            <button
              key={slides[i].id}
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
