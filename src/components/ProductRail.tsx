import React from 'react';
import { Fabric, MasterCategory } from '../types';
import ProductCard from './ProductCard';
import { useRouter } from '../context/RouterContext';

interface Props {
  title: string;
  eyebrow?: string;
  items: Fabric[];
  ctaCategory?: string;
  masterCategory?: MasterCategory;
  bg?: 'white' | 'soft';
  /** When true, render placeholder cards instead of items (data still loading). */
  loading?: boolean;
  /** Skeleton card count when loading. */
  skeletonCount?: number;
  /** Subcategory deep-link for the "See all" CTA. */
  ctaSubCategory?: string;
}

const SkeletonCard: React.FC = () => (
  <div className="animate-pulse">
    <div className="aspect-[3/4] bg-[color:var(--color-myntra-bg-soft)] rounded" />
    <div className="mt-2 h-3 w-3/4 bg-[color:var(--color-myntra-bg-soft)] rounded" />
    <div className="mt-1.5 h-3 w-1/2 bg-[color:var(--color-myntra-bg-soft)] rounded" />
    <div className="mt-2 h-4 w-1/3 bg-[color:var(--color-myntra-bg-soft)] rounded" />
  </div>
);

const ProductRail: React.FC<Props> = ({
  title,
  eyebrow,
  items,
  ctaCategory,
  ctaSubCategory,
  masterCategory,
  bg = 'white',
  loading = false,
  skeletonCount = 4
}) => {
  const { navigate } = useRouter();
  const ctaTarget = masterCategory ?? ctaCategory;

  // Don't render a sad empty rail — if data has loaded and there's nothing to show,
  // pull the whole section out of the document flow.
  if (!loading && items.length === 0) return null;

  return (
    <section className={bg === 'soft' ? 'bg-[color:var(--color-myntra-bg-soft)] py-8 md:py-12' : 'py-8 md:py-12'}>
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10">
        <div className="flex items-end justify-between mb-5 md:mb-6">
          <div>
            {eyebrow && <span className="section-eyebrow">{eyebrow}</span>}
            <h2 className="text-2xl md:text-3xl font-extrabold mt-1">{title}</h2>
          </div>
          <button
            onClick={() => navigate({ name: 'shop', category: ctaTarget, subCategory: ctaSubCategory })}
            className="text-[13px] font-bold uppercase tracking-wide text-[color:var(--color-myntra-pink)] hover:underline"
          >
            See All →
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            {Array.from({ length: skeletonCount }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            {items.slice(0, 5).map(f => <ProductCard key={f.id} fabric={f} />)}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductRail;
