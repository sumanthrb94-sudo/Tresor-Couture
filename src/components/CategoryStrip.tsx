import React from 'react';
import { MASTER_CATEGORY_TILES } from '../constants';
import { useRouter } from '../context/RouterContext';

const CategoryStrip: React.FC = () => {
  const { navigate } = useRouter();
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
        {MASTER_CATEGORY_TILES.map(tile => (
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
              <span
                className="absolute top-3 left-3 font-serif font-semibold text-[44px] md:text-[56px] leading-none text-white/40 select-none"
                aria-hidden="true"
              >
                {tile.name[0]}
              </span>
              <span className="absolute inset-x-3 bottom-3">
                <span className="block font-serif font-semibold text-[18px] md:text-[20px] leading-tight text-[color:var(--color-myntra-navy)] group-hover:text-[color:var(--color-myntra-pink)] transition-colors">
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
