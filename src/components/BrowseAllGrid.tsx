import React, { useEffect, useMemo, useRef, useState } from 'react';
import ProductCard from './ProductCard';
import { useRouter } from '../context/RouterContext';
import { useCatalog } from '../context/CatalogContext';
import { browseAll } from '../lib/homeRails';

const PAGE = 20;

/**
 * "Everything in the atelier" — the part of the home page that scrolls on.
 *
 * The curated rails show five cards each, which is right for merchandising and
 * wrong as the only answer to "what do you sell": a shop with hundreds of pieces
 * looked like a shop with twenty. This is the rest of it, a page at a time.
 *
 * Paged rather than rendered whole because every card is an image and a
 * handful of React subtrees; mounting several hundred at once is what makes a
 * home page janky on a phone. The next page is requested as the sentinel nears
 * the viewport, and the button underneath is the same action for anyone whose
 * browser or assistive tech never fires the observer.
 */
const BrowseAllGrid: React.FC = () => {
  const { navigate } = useRouter();
  const { homeProducts: products, homeLoading: loading } = useCatalog();
  const all = useMemo(() => browseAll(products), [products]);
  const [shown, setShown] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  const more = shown < all.length;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) setShown(n => Math.min(n + PAGE, all.length));
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [more, shown, all.length]);

  if (loading || all.length === 0) return null;

  return (
    <section className="py-8 md:py-12" aria-labelledby="browse-all-heading">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10">
        <div className="flex items-end justify-between mb-5 md:mb-6">
          <div>
            <span className="section-eyebrow">The Whole Atelier</span>
            <h2 id="browse-all-heading" className="text-2xl md:text-3xl font-extrabold mt-1">
              Everything We Have
            </h2>
            <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] mt-1.5">
              {all.length} design{all.length === 1 ? '' : 's'}, newest first.
            </p>
          </div>
          <button
            onClick={() => navigate({ name: 'shop' })}
            className="text-[13px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-pink)] hover:underline"
          >
            Open the Shop →
          </button>
        </div>

        <div
          data-testid="browse-all-grid"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4"
        >
          {all.slice(0, shown).map(f => <ProductCard key={f.id} fabric={f} />)}
        </div>

        {more && (
          <div ref={sentinel} className="flex justify-center mt-8">
            <button
              type="button"
              onClick={() => setShown(n => Math.min(n + PAGE, all.length))}
              className="btn-outline"
            >
              Show more ({all.length - shown} left)
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default BrowseAllGrid;
