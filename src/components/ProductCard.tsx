import React from 'react';
import { Heart, Star } from 'lucide-react';
import { Fabric } from '../types';
import { formatINR } from '../constants';
import { useRouter } from '../context/RouterContext';
import { useWishlist } from '../context/WishlistContext';
import FabricImage from './FabricImage';

interface Props {
  fabric: Fabric;
  /** Optional compact mode for horizontal scroll rails. */
  compact?: boolean;
}

const ProductCard: React.FC<Props> = ({ fabric, compact = false }) => {
  const { navigate } = useRouter();
  const { has, toggle } = useWishlist();
  const wished = has(fabric.id);

  return (
    <div className={`card-product group ${compact ? 'w-[170px] md:w-[200px] shrink-0' : ''}`}>
      <button
        onClick={() => navigate({ name: 'product', id: fabric.id })}
        className="block w-full text-left no-tap-highlight"
        aria-label={fabric.name}
      >
        <div className="relative aspect-[3/4] bg-[color:var(--color-myntra-bg-soft)] overflow-hidden">
          <FabricImage
            photo={fabric.photo}
            fallback={fabric.image}
            alt={fabric.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          {fabric.sticker && (
            <span className="badge-trending">{fabric.sticker}</span>
          )}
          {fabric.rating !== undefined && (
            <span className="absolute bottom-2 left-2 badge-rating">
              {fabric.rating.toFixed(1)} <Star className="w-3 h-3 fill-current star" />
              {fabric.reviewCount !== undefined && (
                <span className="text-[color:var(--color-myntra-ink-mute)] font-medium ml-1">| {fabric.reviewCount}</span>
              )}
            </span>
          )}
        </div>

        <div className="px-2.5 pt-2.5 pb-3">
          <p className="text-[14px] font-extrabold text-[color:var(--color-myntra-navy)] truncate">
            {fabric.brand}
          </p>
          <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] truncate mb-1.5">
            {fabric.name}
          </p>
          {fabric.subCategory && (
            <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[color:var(--color-myntra-ink-mute)] mb-1">
              {fabric.subCategory}
            </p>
          )}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-[14px] font-bold text-[color:var(--color-myntra-navy)]">
              {formatINR(fabric.pricePerMeter)}
            </span>
          </div>
        </div>
      </button>

      <button
        onClick={() => toggle(fabric.id)}
        aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
        className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/95 border border-[color:var(--color-myntra-border-soft)] flex items-center justify-center hover:scale-110 transition-transform"
      >
        <Heart
          className={`w-4 h-4 ${wished ? 'fill-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)]' : 'text-[color:var(--color-myntra-navy)]'}`}
        />
      </button>
    </div>
  );
};

export default ProductCard;
