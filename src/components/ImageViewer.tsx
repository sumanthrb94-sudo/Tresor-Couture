/**
 * Full-screen photo viewer: open, move between shots, zoom in.
 *
 * Lace is bought on detail — the bead work, the weave of the net, whether the
 * gold is bright or antique. A 3:4 thumbnail cropped with object-cover cannot
 * answer any of that, so the product page needs somewhere to actually LOOK at
 * the photograph: edge to edge, uncropped, and magnified.
 *
 * Zoom is pointer-based rather than CSS hover, because the people buying this
 * are on phones. One finger pans a zoomed photo and swipes between shots when
 * it is not zoomed; two fingers pinch; a mouse wheel zooms toward the cursor
 * and a double tap toggles. The same gestures work for both input kinds
 * without a device sniff, because Pointer Events report touch and mouse
 * through one API.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import FabricImage from './FabricImage';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export interface ViewerPhoto {
  photo: string;
  fallback: string;
}

interface Props {
  photos: ViewerPhoto[];
  index: number;
  alt: string;
  onIndex: (next: number) => void;
  onClose: () => void;
}

/* z-150 puts the viewer above the sticky header (z-50), the quick-add and
   payment modals (z-100) and the consent banner (z-140). At z-120 the header's
   logo and the cookie notice were painted OVER the photograph; at 95% opacity
   they still ghosted through it. A photo viewer needs a solid, neutral ground,
   so the backdrop is fully opaque — the whole point is to see the piece and
   nothing else. */
const MAX_SCALE = 5;
const MIN_SCALE = 1;
/** What a double-tap jumps to — enough to read bead work, not so far that the
 *  viewer loses where they are on the piece. */
const DOUBLE_TAP_SCALE = 2.5;
/** Horizontal travel, in px, that counts as "next photo" rather than a tap. */
const SWIPE_THRESHOLD = 60;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const ImageViewer: React.FC<Props> = ({ photos, index, alt, onIndex, onClose }) => {
  useBodyScrollLock(true);

  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);

  // Live pointers, for telling a pinch from a drag. A ref rather than state:
  // these change on every pointermove and must not each cause a render.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startDist: number; startScale: number } | null>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: number } | null>(null);
  const lastTap = useRef(0);

  const reset = useCallback(() => { setScale(1); setTx(0); setTy(0); }, []);

  // A new photograph starts unzoomed: carrying a 4x magnification of one corner
  // over to the next shot lands the viewer somewhere meaningless.
  useEffect(() => { reset(); }, [index, reset]);

  const go = useCallback((delta: number) => {
    if (photos.length < 2) return;
    onIndex((index + delta + photos.length) % photos.length);
  }, [index, photos.length, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === '+' || e.key === '=') setScale(s => clamp(s * 1.4, MIN_SCALE, MAX_SCALE));
      else if (e.key === '-') setScale(s => { const n = clamp(s / 1.4, MIN_SCALE, MAX_SCALE); if (n === 1) { setTx(0); setTy(0); } return n; });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  /** Zoom about a point so the pixel under the cursor stays under the cursor. */
  const zoomAt = useCallback((factor: number, clientX: number, clientY: number) => {
    const box = stageRef.current?.getBoundingClientRect();
    if (!box) return;
    const cx = clientX - box.left - box.width / 2;
    const cy = clientY - box.top - box.height / 2;
    setScale(prev => {
      const next = clamp(prev * factor, MIN_SCALE, MAX_SCALE);
      const ratio = next / prev;
      if (next === MIN_SCALE) { setTx(0); setTy(0); }
      else {
        setTx(x => (x - cx) * ratio + cx);
        setTy(y => (y - cy) * ratio + cy);
      }
      return next;
    });
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { startDist: Math.hypot(a.x - b.x, a.y - b.y), startScale: scale };
      drag.current = null;
    } else if (pointers.current.size === 1) {
      drag.current = { x: e.clientX, y: e.clientY, tx, ty, moved: 0 };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const next = clamp(gesture.current.startScale * (dist / gesture.current.startDist), MIN_SCALE, MAX_SCALE);
      setScale(next);
      if (next === MIN_SCALE) { setTx(0); setTy(0); }
      return;
    }

    if (drag.current) {
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      drag.current.moved = Math.max(drag.current.moved, Math.hypot(dx, dy));
      // Panning only makes sense once there is something off-screen to pan to.
      if (scale > 1) {
        setTx(drag.current.tx + dx);
        setTy(drag.current.ty + dy);
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;

    if (d && pointers.current.size === 0) {
      const dx = e.clientX - d.x;
      // Unzoomed, a horizontal drag is a swipe between photographs. Zoomed, the
      // same drag was a pan and must not also change the picture.
      if (scale === 1 && Math.abs(dx) > SWIPE_THRESHOLD) {
        go(dx < 0 ? 1 : -1);
      } else if (d.moved < 10) {
        const now = Date.now();
        if (now - lastTap.current < 300) {
          lastTap.current = 0;
          if (scale > 1) reset();
          else zoomAt(DOUBLE_TAP_SCALE, e.clientX, e.clientY);
        } else {
          lastTap.current = now;
        }
      }
      drag.current = null;
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && Math.abs(e.deltaY) < 2) return;
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
  };

  const current = photos[index];
  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} — photo ${index + 1} of ${photos.length}`}
      className="fixed inset-0 z-[150] bg-black flex flex-col select-none"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-between px-3 py-2 text-white shrink-0">
        <span className="text-[12px] font-semibold tabular-nums opacity-80">
          {index + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => zoomAt(1 / 1.4, window.innerWidth / 2, window.innerHeight / 2)}
            disabled={scale <= MIN_SCALE}
            aria-label="Zoom out"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-[11px] tabular-nums w-10 text-center opacity-80">{scale.toFixed(1)}×</span>
          <button
            type="button"
            onClick={() => zoomAt(1.4, window.innerWidth / 2, window.innerHeight / 2)}
            disabled={scale >= MAX_SCALE}
            aria-label="Zoom in"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        className="relative flex-1 overflow-hidden touch-none"
        style={{ cursor: scale > 1 ? 'grab' : 'zoom-in' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
            transition: drag.current || gesture.current ? 'none' : 'transform 180ms ease-out',
          }}
        >
          {/* object-contain, not cover: the point of opening this is to see the
              WHOLE piece, including the scalloped edge a 3:4 crop cuts off. */}
          <FabricImage
            photo={current.photo}
            fallback={current.fallback}
            alt={alt}
            loading="eager"
            draggable={false}
            className="max-w-full max-h-full object-contain"
          />
        </div>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex gap-2 px-3 py-3 overflow-x-auto scrollbar-none shrink-0">
          {photos.map((p, i) => (
            <button
              key={p.photo}
              type="button"
              onClick={() => onIndex(i)}
              aria-label={`Photo ${i + 1}`}
              aria-current={i === index}
              className={`w-12 h-16 shrink-0 overflow-hidden rounded border-2 ${
                i === index ? 'border-white' : 'border-transparent opacity-50'
              }`}
            >
              <FabricImage photo={p.photo} fallback={p.fallback} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <p className="text-center text-[11px] text-white/45 pb-2 shrink-0">
        Double-tap or pinch to zoom · swipe for the next photo
      </p>
    </div>
  );
};

export default ImageViewer;
