import React, { useState } from 'react';
import { Heart, Star, ShoppingBag, Check } from 'lucide-react';
import { Fabric } from '../types';
import { formatINR } from '../constants';
import { useRouter } from '../context/RouterContext';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import FabricImage from './FabricImage';
import QuickAddModal from './QuickAddModal';
import { inStock } from '../lib/availability';

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
  const soldOut = !inStock(fabric);

  const [justAdded, setJustAdded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const handleAdd = (quantity: number, color?: string) => {
    addItem({ fabricId: fabric.id, quantity, color: color ?? fabric.colors?.[0]?.name });
    setModalOpen(false);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1500);
  };

  const openModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (soldOut) return;
    setModalOpen(true);
  };

  const goToProduct = () => navigate({ name: 'product', id: fabric.id });

  return (
    <div className={`card-product group ${compact ? 'w-[170px] md:w-[200px] shrink-0' : ''}`}>
      {/* Card link area: not a <button> so action buttons remain valid and clickable. */}
      <div
        role="button"
        tabIndex={0}
        onClick={goToProduct}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            goToProduct();
          }
        }}
        className="block w-full text-left no-tap-highlight outline-none cursor-pointer"
        aria-label={fabric.name}
      >
        <div className="relative aspect-[3/4] bg-[color:var(--color-myntra-bg-soft)] overflow-hidden">
          <FabricImage
            photo={fabric.photo}
            fallback={fabric.image}
            alt={fabric.name}
            className={`w-full h-full object-cover transition-transform duration-700 ${
              soldOut ? 'opacity-45 grayscale' : 'group-hover:scale-105'
            }`}
          />
          {soldOut && (
            <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--color-myntra-navy)] bg-white/85 py-1.5">
              Sold out
            </span>
          )}
          {/* A stock-out outranks a marketing sticker: don't badge a piece
              "Trending" on a card the customer cannot buy from. */}
          {fabric.sticker && !soldOut && (
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
      </div>

      {/* Add-to-bag button — opens the QuickAddModal so colour/qty selection never overlaps card content. */}
      <button
        type="button"
        onClick={openModal}
        disabled={soldOut}
        aria-label={soldOut ? `${fabric.name} is sold out` : 'Add to bag'}
        title={soldOut ? 'Sold out' : 'Add to bag'}
        className={`absolute bottom-3 right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-sm no-tap-highlight ${
          soldOut
            ? 'bg-[color:var(--color-myntra-bg-soft)] text-[color:var(--color-myntra-ink-mute)] border border-[color:var(--color-myntra-border-soft)] cursor-not-allowed'
            : justAdded
            ? 'bg-[color:var(--color-myntra-green)] text-white border border-[color:var(--color-myntra-green)] tap-scale'
            : 'bg-[color:var(--color-myntra-navy)] text-white border border-[color:var(--color-myntra-navy)] tap-scale'
        }`}
      >
        {justAdded && !soldOut ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
      </button>

      <button
        type="button"
        onClick={() => toggle(fabric.id)}
        aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
        className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/95 border border-[color:var(--color-myntra-border-soft)] flex items-center justify-center hover:scale-110 tap-scale no-tap-highlight"
      >
        <Heart
          className={`w-4 h-4 ${wished ? 'fill-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)]' : 'text-[color:var(--color-myntra-navy)]'}`}
        />
      </button>

      <QuickAddModal
        fabric={fabric}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={(quantity, color) => handleAdd(quantity, color)}
      />
    </div>
  );
};

export default ProductCard;
