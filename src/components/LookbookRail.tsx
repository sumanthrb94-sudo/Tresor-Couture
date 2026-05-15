import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from '../context/RouterContext';

interface LookbookEntry {
  id: string;
  photo: string;
  eyebrow: string;
  title: string;
  blurb: string;
  ctaLabel: string;
  ctaCategory?: string;
}

const ENTRIES: LookbookEntry[] = [
  {
    id: 'patola',
    photo: '/products/patola-purple-1.jpg',
    eyebrow: 'The Royal Edit',
    title: 'Patan Patola',
    blurb: 'A double-ikkat masterpiece taking master weavers up to six months. Reversible, mathematically precise.',
    ctaLabel: 'Shop Patola',
    ctaCategory: 'Silk'
  },
  {
    id: 'banarasi',
    photo: '/products/banarasi-purple-1.jpg',
    eyebrow: 'Bridal Heritage',
    title: 'Real Zari Banarasi',
    blurb: 'Pit-loom brocade with authentic silver-and-gold zari — for sherwanis, lehengas and statement saris.',
    ctaLabel: 'Shop Banarasi',
    ctaCategory: 'Silk'
  },
  {
    id: 'kalamkari',
    photo: '/products/kalamkari-cream-2.jpg',
    eyebrow: 'Story Cloth',
    title: 'Kalamkari',
    blurb: 'Hand-painted with bamboo pens and natural dyes — every meter carries a story drawn from the epics.',
    ctaLabel: 'Shop Kalamkari',
    ctaCategory: 'Cotton'
  },
  {
    id: 'kanjivaram',
    photo: '/products/kanjivaram-olive-1.jpg',
    eyebrow: 'Temple Border',
    title: 'Kanjivaram Silk',
    blurb: 'Pure mulberry silk woven in a three-shuttle technique. Heavy, regal, and unmistakably Tamil.',
    ctaLabel: 'Shop Kanjivaram',
    ctaCategory: 'Silk'
  },
  {
    id: 'jamdani',
    photo: '/products/jamdani-pink-1.jpg',
    eyebrow: 'The Ghost Fabric',
    title: 'Dhakai Jamdani',
    blurb: 'Translucent 300-count muslin once reserved for Mughal courts. Featherlight and ethereally drapey.',
    ctaLabel: 'Shop Jamdani',
    ctaCategory: 'Cotton'
  },
  {
    id: 'bandhani',
    photo: '/products/bandhani-red-1.jpg',
    eyebrow: 'Festive Constellations',
    title: 'Bandhani Tie-Dye',
    blurb: 'Each dot hand-tied before dyeing — a Gujarat craft that turns silk into points of light.',
    ctaLabel: 'Shop Bandhani',
    ctaCategory: 'Silk'
  },
  {
    id: 'mashru',
    photo: '/products/mashru-saffron-1.jpg',
    eyebrow: 'The Permitted Cloth',
    title: 'Mashru Silk-Satin',
    blurb: 'A historical weave where silk never touches the skin. Lustrous face on a cotton ground.',
    ctaLabel: 'Shop Mashru',
    ctaCategory: 'Satin'
  },
  {
    id: 'linen-silk',
    photo: '/products/linensilk-teal-1.jpg',
    eyebrow: 'Modern Blends',
    title: 'Linen-Silk',
    blurb: 'The crispness of linen with the lustre of silk — elegant for shirts, drapes and contemporary saris.',
    ctaLabel: 'Shop Blends',
    ctaCategory: 'Mixed'
  }
];

const LookbookRail: React.FC = () => {
  const { navigate } = useRouter();
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-look-card]');
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: step * dir, behavior: 'smooth' });
  };

  return (
    <section className="bg-[color:var(--color-myntra-bg-soft)] py-10 md:py-14">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10">
        <div className="flex items-end justify-between mb-5 md:mb-7">
          <div>
            <span className="section-eyebrow">The Lookbook</span>
            <h2 className="text-2xl md:text-3xl font-extrabold mt-1">Stories Woven by Hand</h2>
            <p className="text-[13px] md:text-[14px] text-[color:var(--color-myntra-ink-soft)] mt-2 max-w-xl">
              Scroll through the weaves that built our atelier — each photographed in our studio, each one available by the meter.
            </p>
          </div>
          <div className="hidden md:flex gap-2 shrink-0">
            <button
              onClick={() => scroll(-1)}
              aria-label="Scroll left"
              className="w-10 h-10 rounded-full bg-white border border-[color:var(--color-myntra-border)] flex items-center justify-center hover:border-[color:var(--color-myntra-pink)]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll(1)}
              aria-label="Scroll right"
              className="w-10 h-10 rounded-full bg-white border border-[color:var(--color-myntra-border)] flex items-center justify-center hover:border-[color:var(--color-myntra-pink)]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          className="flex gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-3 -mx-4 md:mx-0 px-4 md:px-0"
        >
          {ENTRIES.map(entry => (
            <article
              key={entry.id}
              data-look-card
              className="snap-start shrink-0 w-[78%] sm:w-[58%] md:w-[44%] lg:w-[32%] xl:w-[28%] bg-white border border-[color:var(--color-myntra-border-soft)] overflow-hidden flex flex-col"
            >
              <div className="relative aspect-[3/4] bg-[color:var(--color-myntra-bg-soft)] overflow-hidden">
                <img
                  src={entry.photo}
                  alt={entry.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                />
                <span className="absolute top-3 left-3 bg-[color:var(--color-myntra-navy)]/85 text-white text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded">
                  {entry.eyebrow}
                </span>
              </div>
              <div className="p-4 md:p-5 flex flex-col flex-1">
                <h3 className="text-lg md:text-xl font-extrabold mb-2 text-[color:var(--color-myntra-navy)]">
                  {entry.title}
                </h3>
                <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] leading-relaxed mb-4 flex-1">
                  {entry.blurb}
                </p>
                <button
                  onClick={() => navigate({ name: 'shop', category: entry.ctaCategory })}
                  className="text-[12px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-pink)] self-start hover:underline"
                >
                  {entry.ctaLabel} →
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LookbookRail;
