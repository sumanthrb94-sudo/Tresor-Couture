import React, { useEffect, useState } from 'react';
import { Heart, Star, ShoppingBag, Check, Minus, Plus } from 'lucide-react';
import { Fabric } from '../types';
import { formatINR } from '../constants';
import { useRouter } from '../context/RouterContext';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import FabricImage from './FabricImage';

interface Props {
  fabric: Fabric;
  /** Optional compact mode for horizontal scroll rails. */
  compact?: boolean;
}

const ProductCard: React.FC<Props> = ({ fabric, compact = false }) => {
  const { navigate } = useRouter();
  const { has, toggle } = useWishlist();
  const { addItem } = useCart();
  const wished = has(fabric.id);

  const [active, setActive] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const stock = fabric.stock ?? 99;
  const maxQty = Math.max(1, stock);

  useEffect(() => {
    if (!active) setQuantity(1);
  }, [active]);

  const handleAdd = () => {
    const color = fabric.colors?.[0]?.name;
    addItem({ fabricId: fabric.id, quantity, color });
    setActive(false);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1500);
  };

  const openStepper = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActive(true);
    setQuantity(1);
  };

  const bump = (delta: number) => {
    setQuantity(q => Math.max(1, Math.min(q + delta, maxQty)));
  };

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
          {fabric.category === 'Laces' && fabric.unitType && (
            <p className="text-[11px] font-semibold text-[#5C3A8E] mb-1.5">
              {fabric.unitType === 'bundle' && fabric.bundleSizeMeters
                ? `${fabric.bundleSizeMeters}m bundle`
                : fabric.unitType === 'per meter'
                ? 'Sold per meter'
                : 'Sold as unit'}
            </p>
          )}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-[14px] font-bold text-[color:var(--color-myntra-navy)]">
              {formatINR(fabric.price)}
            </span>
          </div>
        </div>
      </button>

      {/* Inline quick-add stepper (Myntra-style) */}
      {active ? (
        <div
          className={`absolute bottom-2 z-10 flex items-center gap-1 bg-white border border-[color:var(--color-myntra-border-soft)] rounded-full shadow-md p-1 animate-[popIn_150ms_ease-out] ${
            compact ? 'right-1' : 'right-2'
          }`}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={e => { e.stopPropagation(); bump(-1); }}
            disabled={quantity <= 1}
            aria-label="Decrease quantity"
            className="w-7 h-7 rounded-full flex items-center justify-center text-[color:var(--color-myntra-navy)] hover:bg-[color:var(--color-myntra-bg-soft)] disabled:opacity-40 tap-scale no-tap-highlight"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="min-w-[22px] text-center text-[13px] font-extrabold text-[color:var(--color-myntra-navy)]">
            {quantity}
          </span>
          <button
            onClick={e => { e.stopPropagation(); bump(1); }}
            disabled={quantity >= maxQty}
            aria-label="Increase quantity"
            className="w-7 h-7 rounded-full flex items-center justify-center text-[color:var(--color-myntra-navy)] hover:bg-[color:var(--color-myntra-bg-soft)] disabled:opacity-40 tap-scale no-tap-highlight"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); handleAdd(); }}
            className="h-7 px-2.5 rounded-full bg-[color:var(--color-myntra-navy)] text-white text-[11px] font-extrabold tap-scale no-tap-highlight"
          >
            ADD
          </button>
        </div>
      ) : (
        <button
          onClick={openStepper}
          aria-label="Add to bag"
          className={`absolute bottom-3 right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-sm tap-scale no-tap-highlight ${
            justAdded
              ? 'bg-[color:var(--color-myntra-green)] text-white border border-[color:var(--color-myntra-green)]'
              : 'bg-[color:var(--color-myntra-navy)] text-white border border-[color:var(--color-myntra-navy)]'
          }`}
        >
          {justAdded ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
        </button>
      )}

      <button
        onClick={() => toggle(fabric.id)}
        aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
        className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/95 border border-[color:var(--color-myntra-border-soft)] flex items-center justify-center hover:scale-110 tap-scale no-tap-highlight"
      >
        <Heart
          className={`w-4 h-4 ${wished ? 'fill-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)]' : 'text-[color:var(--color-myntra-navy)]'}`}
        />
      </button>
    </div>
  );
};

export default ProductCard;
