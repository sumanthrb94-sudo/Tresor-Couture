import React, { useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from '../context/RouterContext';
import { useCatalog } from '../context/CatalogContext';
import { MIN_CARDS, buildEntries } from '../lib/lookbook';

/**
 * The Lookbook — one card per part of the catalogue that actually has stock.
 *
 * This used to be eight hardcoded entries: fixed photographs, fixed copy about
 * Patola and Jamdani and Mashru, and CTAs pointing at `?category=Silk`. None of
 * it was wrong when it was written and all of it was wrong afterwards — the
 * atelier sells laces and lehengas, `Silk` is a SUBcategory rather than a master
 * one so every button landed on an unfiltered shop, and a customer scrolling the
 * home page was reading about six weaves the shop has never listed.
 *
 * It is now derived, so it cannot say that again. One card per subcategory that
 * has a live product; the photograph, the words and the destination all come
 * from a real piece. Add a Kanjivaram tomorrow and a Kanjivaram card appears;
 * sell the last one and the card leaves with it.
 *
 * The editorial job the hardcoded version was doing — telling a shopper what a
 * weave IS — now falls to the product descriptions, which is where it belongs:
 * one place to write it, and it shows up on the product page too.
 */

const LookbookRail: React.FC = () => {
  const { navigate } = useRouter();
  const { products, loading } = useCatalog();
  const trackRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => buildEntries(products), [products]);

  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-look-card]');
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: step * dir, behavior: 'smooth' });
  };

  // Nothing rather than a skeleton: the rail is editorial, and a shimmering
  // placeholder for a section that may not appear at all is worse than the
  // page simply being shorter for a moment.
  if (loading || entries.length < MIN_CARDS) return null;

  return (
    <section className="bg-[color:var(--color-myntra-bg-soft)] py-10 md:py-14">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10">
        <div className="flex items-end justify-between mb-5 md:mb-7">
          <div>
            <span className="section-eyebrow">The Lookbook</span>
            <h2 className="text-2xl md:text-3xl font-extrabold mt-1">Stories Woven by Hand</h2>
            <p className="text-[13px] md:text-[14px] text-[color:var(--color-myntra-ink-soft)] mt-2 max-w-xl">
              Every edit on our shelves right now — photographed in the studio, ready to ship.
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
          {entries.map(entry => (
            <article
              key={entry.key}
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
                  onClick={() => navigate({ name: 'shop', category: entry.category, subCategory: entry.subCategory })}
                  className="text-[12px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-pink)] self-start hover:underline"
                >
                  Shop {entry.title} →
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
