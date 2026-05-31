import React, { useEffect, useState } from 'react';
import { Heart, ShoppingBag } from 'lucide-react';
import FabricImage from './FabricImage';
import { formatINR } from '../constants';
import type { Fabric } from '../types';

interface Props {
  product: Fabric;
  onAdd: () => void;
  onWishlist: () => void;
  wished?: boolean;
  /** Disable both buttons (e.g. out-of-stock / invalid length). */
  disabled?: boolean;
  /** id of the in-card "Add to bag" trigger; once the user scrolls past it
   *  the sticky bar appears. */
  triggerId?: string;
}

const StickyAddToCart: React.FC<Props> = ({
  product,
  onAdd,
  onWishlist,
  wished = false,
  disabled = false,
  triggerId
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // If we have a trigger id, observe it: bar appears once the original
    // CTA scrolls fully out of view. Otherwise, fall back to a fixed
    // viewport-scroll threshold so the component remains useful in unit
    // tests / pages without the anchor.
    if (triggerId) {
      const el = document.getElementById(triggerId);
      if (!el) {
        setVisible(true);
        return;
      }
      const io = new IntersectionObserver(
        entries => {
          for (const entry of entries) setVisible(!entry.isIntersecting);
        },
        { threshold: 0, rootMargin: '0px 0px 0px 0px' }
      );
      io.observe(el);
      return () => io.disconnect();
    }

    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [triggerId]);

  return (
    <div
      className={`md:hidden fixed inset-x-0 bottom-0 z-40 transition-transform duration-200 ease-out ${visible ? 'translate-y-0' : 'translate-y-full'}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-hidden={!visible}
    >
      <div className="bg-white border-t border-[color:var(--color-myntra-border-soft)] shadow-[0_-4px_12px_rgba(0,0,0,0.06)] px-3 py-2 flex items-center gap-2">
        <div className="w-11 h-14 shrink-0 bg-[color:var(--color-myntra-bg-soft)] overflow-hidden">
          <FabricImage
            photo={product.photo}
            fallback={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-extrabold text-[color:var(--color-myntra-navy)] truncate leading-tight">{product.brand}</p>
          <p className="text-[11px] text-[color:var(--color-myntra-ink-soft)] truncate leading-tight">{product.name}</p>
          <p className="text-[13px] font-bold text-[color:var(--color-myntra-navy)] leading-tight mt-0.5">{formatINR(product.price)}</p>
        </div>
        <button
          type="button"
          onClick={onWishlist}
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          className="btn-outline px-3 py-2 inline-flex items-center justify-center"
        >
          <Heart className={`w-4 h-4 ${wished ? 'fill-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)]' : ''}`} />
        </button>
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          className="btn-primary px-4 py-2 inline-flex items-center gap-1.5 text-[13px]"
        >
          <ShoppingBag className="w-4 h-4" /> Add to bag
        </button>
      </div>
    </div>
  );
};

export default StickyAddToCart;
