import React from 'react';
import { MASTER_CATEGORY_TILES } from '../constants';
import { useRouter } from '../context/RouterContext';
import { useCatalog } from '../context/CatalogContext';
import { categoryShowcase } from '../lib/showcase';
import FabricImage from './FabricImage';

/**
 * Shop the House — a tile per category that has something in it.
 *
 * Each tile used to be the category's first LETTER over a gradient, which is
 * what you draw when you have no picture. There are pictures: every category
 * with a live product has a photographed piece in it, and that piece is a far
 * better argument for tapping the tile than a large translucent "L".
 *
 * The colour is kept as the ground beneath the photograph, so a slow image or a
 * category whose only pieces are still unphotographed degrades to the old look
 * rather than to a hole in the page.
 */
const CategoryStrip: React.FC = () => {
  const { navigate } = useRouter();
  const { products } = useCatalog();

  // A tile promising a category the shop cannot show is worse than one tile
  // fewer, and a category is declared in the admin long before its first piece
  // is photographed.
  const shown = React.useMemo(() => {
    const live = new Map(categoryShowcase(products).map(s => [s.category, s]));
    return MASTER_CATEGORY_TILES
      .filter(t => live.has(t.name))
      .map(t => ({ ...t, showcase: live.get(t.name)! }));
  }, [products]);

  if (shown.length === 0) return null;

  return (
    <section className="py-8 md:py-12 px-4 md:px-8 lg:px-10 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between mb-5 md:mb-7">
        <h2 className="section-title mb-0">Shop the House</h2>
        <button
          onClick={() => navigate({ name: 'shop' })}
          className="text-[12px] md:text-[13px] font-bold uppercase tracking-[0.14em] text-[color:var(--color-myntra-pink)] hover:underline"
        >
          View all
        </button>
      </div>
      <div className="grid grid-flow-col auto-cols-[78%] sm:auto-cols-[44%] md:auto-cols-auto md:grid-flow-row md:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory scrollbar-none pb-2">
        {shown.map(tile => (
          <button
            key={tile.name}
            onClick={() => navigate({ name: 'shop', category: tile.name })}
            className="snap-start text-left group no-tap-highlight focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-myntra-pink)]"
            aria-label={`Shop ${tile.name}`}
          >
            <div
              className="relative aspect-square w-full overflow-hidden rounded-sm shadow-sm transition-transform duration-500 group-hover:-translate-y-0.5"
              style={{
                background: `linear-gradient(135deg, ${tile.color} 0%, var(--color-myntra-bg-soft) 100%)`
              }}
            >
              <FabricImage
                photo={tile.showcase.photo}
                fallback={tile.showcase.hero?.image ?? tile.showcase.photo}
                alt={tile.name}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              {/* The name sits on the photograph, so it needs its own ground. */}
              <span className="absolute inset-x-0 bottom-0 pt-8 pb-3 px-3 bg-gradient-to-t from-black/70 via-black/25 to-transparent">
                <span className="block font-serif font-semibold text-[18px] md:text-[20px] leading-tight text-white">
                  {tile.name}
                </span>
              </span>
            </div>
            <p className="mt-2 text-[11px] md:text-[12px] tracking-wide text-[color:var(--color-myntra-ink-soft)]">
              {tile.tagline}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
};

export default CategoryStrip;
