import type { Fabric } from '../types';

/**
 * The image rail on a product page.
 *
 * A product stores its photographs in two places: `photo` (the main shot, the
 * one the grid, the cart, the home page and the label all use) and
 * `photoGallery` (up to three more). `image` and `gallery` are the matching
 * SVG-swatch fallbacks, used when a photograph fails to load.
 *
 * The rail used to be built as:
 *
 *     photoGallery?.length ? photoGallery : [photo]
 *
 * which silently DROPPED the main photograph the moment a single gallery slot
 * was filled. A piece shot three times showed two, and the missing one was the
 * shot the shop lists it by everywhere else — so a customer saw an image in the
 * grid, opened the product, and could not find that image. On the live
 * catalogue that hid the main photograph on 13 of the 43 products that have a
 * gallery.
 */

export interface GalleryEntry {
  photo: string;
  fallback: string;
}

/** A generated swatch is what a piece carries INSTEAD of a photograph. */
export const isSwatch = (s: string | undefined): boolean =>
  !s || !s.trim() || s.trim().startsWith('data:image/svg+xml');

export function buildGallery(fabric: Pick<Fabric, 'photo' | 'image' | 'photoGallery' | 'gallery'>): GalleryEntry[] {
  const extras = fabric.photoGallery ?? [];
  const extraFallbacks = fabric.gallery ?? [];

  // Main photograph first, then the gallery slots in the order they were saved.
  const pairs: GalleryEntry[] = [
    { photo: fabric.photo, fallback: fabric.image },
    ...extras.map((photo, i) => ({ photo, fallback: extraFallbacks[i] ?? fabric.image })),
  ];

  // A swatch must never lead a rail that holds a real photograph — two live
  // products have no main photo but do have gallery shots. When everything is a
  // swatch the piece is simply unphotographed, and one is kept so the page
  // still renders rather than showing an empty rail.
  const photographed = pairs.filter(p => !isSwatch(p.photo));
  const usable = photographed.length ? photographed : pairs.slice(0, 1);

  // The studio routinely puts the main photo in Gallery 1 as well — 30 of the
  // 43 products with a gallery are like that — and the same shot twice in the
  // rail reads as a bug to a shopper.
  const seen = new Set<string>();
  return usable.filter(p => {
    const key = (p.photo ?? '').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
