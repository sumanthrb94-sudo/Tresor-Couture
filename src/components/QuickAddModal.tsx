import React, { useState } from 'react';
import { Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { Fabric } from '../types';
import { formatINR } from '../constants';
import FabricImage from './FabricImage';

interface Props {
  fabric: Fabric;
  isOpen: boolean;
  onClose: () => void;
  onAdd: (quantity: number, color?: string) => void;
}

const QuickAddModal: React.FC<Props> = ({ fabric, isOpen, onClose, onAdd }) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string | undefined>(fabric.colors?.[0]?.name);

  if (!isOpen) return null;

  const stock = fabric.stock ?? 0;
  const maxQty = Math.max(1, stock);
  const clamp = (q: number) => Math.max(1, Math.min(q, maxQty));

  const handleAdd = () => {
    onAdd(quantity, selectedColor);
    setQuantity(1);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4 py-0 sm:py-6"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-lg rounded-t-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-[color:var(--color-myntra-border-soft)]">
          <div className="w-16 h-20 rounded overflow-hidden bg-[color:var(--color-myntra-bg-soft)] shrink-0">
            <FabricImage photo={fabric.photo} fallback={fabric.image} alt={fabric.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-extrabold text-[color:var(--color-myntra-navy)] truncate">{fabric.brand}</p>
            <p className="text-[13px] text-[color:var(--color-myntra-ink-soft)] truncate">{fabric.name}</p>
            <p className="text-[14px] font-bold text-[color:var(--color-myntra-navy)] mt-1">{formatINR(fabric.price)}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[color:var(--color-myntra-bg-soft)]" aria-label="Close">
            <X className="w-5 h-5 text-[color:var(--color-myntra-ink-soft)]" />
          </button>
        </div>

        <div className="p-4 space-y-5 max-h-[60vh] overflow-y-auto">
          {fabric.colors && fabric.colors.length > 0 && (
            <div>
              <p className="text-[13px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)] mb-3">
                Select Colour
              </p>
              <div className="flex flex-wrap gap-2">
                {fabric.colors.map(c => (
                  <button
                    key={c.name}
                    onClick={() => setSelectedColor(c.name)}
                    className={`flex items-center gap-2 pl-1 pr-3 py-1.5 rounded-full border transition-all ${
                      selectedColor === c.name
                        ? 'border-[color:var(--color-myntra-pink)] bg-[#F5E8C8]'
                        : 'border-[color:var(--color-myntra-border)] hover:border-[color:var(--color-myntra-navy)]'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-full border border-white outline outline-1 outline-[color:var(--color-myntra-border)]"
                      style={{ background: c.hex }}
                    />
                    <span className="text-[12px] font-semibold">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[13px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-navy)] mb-3">
              Quantity
            </p>
            <div className="inline-flex items-center border-2 border-[color:var(--color-myntra-border)] rounded-full overflow-hidden">
              <button
                onClick={() => setQuantity(q => clamp(q - 1))}
                disabled={quantity <= 1}
                className="w-11 h-11 flex items-center justify-center text-[color:var(--color-myntra-navy)] disabled:opacity-40 hover:bg-[color:var(--color-myntra-bg-soft)]"
                aria-label="Decrease quantity"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="min-w-[48px] text-center text-[15px] font-bold text-[color:var(--color-myntra-navy)]">{quantity}</span>
              <button
                onClick={() => setQuantity(q => clamp(q + 1))}
                disabled={quantity >= maxQty}
                className="w-11 h-11 flex items-center justify-center text-[color:var(--color-myntra-navy)] disabled:opacity-40 hover:bg-[color:var(--color-myntra-bg-soft)]"
                aria-label="Increase quantity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[color:var(--color-myntra-border-soft)]">
          <button
            onClick={handleAdd}
            disabled={stock <= 0}
            className="btn-primary w-full inline-flex justify-center items-center gap-2"
          >
            <ShoppingBag className="w-5 h-5" />
            {stock <= 0 ? 'Out of Stock' : 'Add to Bag'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickAddModal;
