import React from 'react';
import { Check } from 'lucide-react';
import type { OrderStatus } from '../types';

interface Props {
  currentStatus: OrderStatus;
  /** ISO timestamp of order placement, used to derive "Placed N hours ago". */
  placedAt?: string;
}

/**
 * Steps in the active-order pipeline. 'Out for Delivery' isn't a stored
 * OrderStatus today, so we synthesise it from 'shipped' once enough time
 * has passed — see deriveStepIndex(). Keeping it in the visual flow lets
 * us light the step up automatically when ETA logic lands.
 */
const STEPS: { id: string; label: string }[] = [
  { id: 'placed', label: 'Placed' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'ofd', label: 'Out for Delivery' },
  { id: 'delivered', label: 'Delivered' }
];

const statusToIndex = (s: OrderStatus): number => {
  switch (s) {
    case 'placed': return 0;
    case 'processing': return 1;
    case 'shipped': return 2;
    case 'delivered': return 4;
    default: return 0;
  }
};

const formatRelative = (iso?: string): string | null => {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const OrderStatusTracker: React.FC<Props> = ({ currentStatus, placedAt }) => {
  if (currentStatus === 'cancelled' || currentStatus === 'refunded') {
    const label = currentStatus === 'cancelled' ? 'Cancelled' : 'Refunded';
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-[color:var(--color-myntra-bg-sale)] border border-[color:var(--color-myntra-border-soft)]">
        <span className="inline-block w-2 h-2 rounded-full bg-[color:var(--color-myntra-pink)]" aria-hidden />
        <span className="text-[12px] font-extrabold uppercase tracking-wider text-[color:var(--color-myntra-pink-dark)]">
          {label}
        </span>
        {placedAt && (
          <span className="text-[11px] text-[color:var(--color-myntra-ink-mute)] ml-auto">
            Placed {formatRelative(placedAt)}
          </span>
        )}
      </div>
    );
  }

  const activeIndex = statusToIndex(currentStatus);
  const placedRel = formatRelative(placedAt);

  return (
    <div className="w-full" role="group" aria-label="Order progress">
      <ol className="flex items-start justify-between gap-1 sm:gap-2">
        {STEPS.map((step, idx) => {
          const isComplete = idx < activeIndex;
          const isActive = idx === activeIndex;
          const isFuture = idx > activeIndex;
          const isLast = idx === STEPS.length - 1;

          // Segment line colour: full when the upcoming step is reached.
          const segmentReached = idx < activeIndex;

          return (
            <li key={step.id} className="flex-1 min-w-0 relative">
              <div className="flex items-center">
                <span
                  className={[
                    'relative z-10 inline-flex items-center justify-center shrink-0 w-6 h-6 rounded-full border-2 transition-colors',
                    isComplete ? 'bg-[color:var(--color-myntra-green)] border-[color:var(--color-myntra-green)] text-white' : '',
                    isActive ? 'bg-white border-[color:var(--color-myntra-pink)] text-[color:var(--color-myntra-pink)]' : '',
                    isFuture ? 'bg-white border-[color:var(--color-myntra-border)] text-[color:var(--color-myntra-ink-mute)]' : ''
                  ].join(' ')}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isComplete ? (
                    <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />
                  ) : isActive ? (
                    <span className="block w-2 h-2 rounded-full bg-[color:var(--color-myntra-pink)] animate-pulse" aria-hidden />
                  ) : (
                    <span className="block w-1.5 h-1.5 rounded-full bg-[color:var(--color-myntra-border)]" aria-hidden />
                  )}
                </span>

                {!isLast && (
                  <span
                    className={[
                      'flex-1 h-[2px] mx-1 transition-colors',
                      segmentReached ? 'bg-[color:var(--color-myntra-green)]' : 'bg-[color:var(--color-myntra-border-soft)]'
                    ].join(' ')}
                    aria-hidden
                  />
                )}
              </div>
              <p
                className={[
                  'mt-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wide leading-tight whitespace-normal break-words',
                  isComplete ? 'text-[color:var(--color-myntra-green)]' : '',
                  isActive ? 'text-[color:var(--color-myntra-pink)]' : '',
                  isFuture ? 'text-[color:var(--color-myntra-ink-mute)]' : ''
                ].join(' ')}
              >
                {step.label}
              </p>
              {idx === 0 && placedRel && (
                <p className="text-[10px] text-[color:var(--color-myntra-ink-mute)] truncate">
                  {placedRel}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default OrderStatusTracker;
