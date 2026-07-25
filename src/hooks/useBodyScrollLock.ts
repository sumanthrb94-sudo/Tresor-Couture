import { useEffect } from 'react';

/**
 * Freeze background page scrolling while an overlay (modal/drawer) is open.
 *
 * Without this, scrolling inside a modal on a touch device bleeds through and
 * scrolls the page behind it once the modal's own content hits its end — the
 * classic "scroll chaining" bug. Mirrors what BottomNav already does for its
 * full-screen account menu.
 *
 * Restores whatever `overflow` the body had before, so nested/stacked overlays
 * don't clobber each other.
 */
export function useBodyScrollLock(active: boolean = true): void {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [active]);
}

export default useBodyScrollLock;
