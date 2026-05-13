import React from 'react';
import { CATEGORY_TILES } from '../constants';
import { useRouter } from '../context/RouterContext';

const CategoryStrip: React.FC = () => {
  const { navigate } = useRouter();
  return (
    <section className="py-8 md:py-10 px-4 md:px-8 lg:px-10 max-w-[1400px] mx-auto">
      <h2 className="section-title">Shop by Weave</h2>
      <div className="flex gap-3 md:gap-6 overflow-x-auto scrollbar-none pb-2 justify-start md:justify-center">
        {CATEGORY_TILES.map(tile => (
          <button
            key={tile.name}
            onClick={() => navigate(tile.category === 'All' ? { name: 'shop' } : { name: 'shop', category: tile.category })}
            className="flex flex-col items-center gap-2 shrink-0 group no-tap-highlight"
          >
            <div
              className="w-[84px] h-[84px] md:w-[110px] md:h-[110px] rounded-full flex items-center justify-center transition-transform group-hover:scale-105"
              style={{ background: tile.color }}
            >
              <span className="text-2xl md:text-3xl font-extrabold text-[color:var(--color-myntra-navy)]">
                {tile.name[0]}
              </span>
            </div>
            <span className="text-[12px] md:text-[13px] font-bold tracking-wide text-[color:var(--color-myntra-navy)] group-hover:text-[color:var(--color-myntra-pink)]">
              {tile.name}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default CategoryStrip;
