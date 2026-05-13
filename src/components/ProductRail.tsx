import React from 'react';
import { Fabric } from '../types';
import ProductCard from './ProductCard';
import { useRouter } from '../context/RouterContext';

interface Props {
  title: string;
  eyebrow?: string;
  items: Fabric[];
  ctaCategory?: string;
  bg?: 'white' | 'soft';
}

const ProductRail: React.FC<Props> = ({ title, eyebrow, items, ctaCategory, bg = 'white' }) => {
  const { navigate } = useRouter();

  return (
    <section className={bg === 'soft' ? 'bg-[color:var(--color-myntra-bg-soft)] py-8 md:py-12' : 'py-8 md:py-12'}>
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10">
        <div className="flex items-end justify-between mb-5 md:mb-6">
          <div>
            {eyebrow && <span className="section-eyebrow">{eyebrow}</span>}
            <h2 className="text-2xl md:text-3xl font-extrabold mt-1">{title}</h2>
          </div>
          <button
            onClick={() => navigate({ name: 'shop', category: ctaCategory })}
            className="text-[13px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-pink)] hover:underline"
          >
            View All →
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {items.slice(0, 5).map(f => <ProductCard key={f.id} fabric={f} />)}
        </div>
      </div>
    </section>
  );
};

export default ProductRail;
