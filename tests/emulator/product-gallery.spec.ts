import { test, expect } from '@playwright/test';
import { Recorder } from './lib/recorder';
import { buildGallery } from '../../src/lib/productGallery';

/**
 * What a shopper sees in the product-page image rail.
 *
 * The rail was built as `photoGallery?.length ? photoGallery : [photo]`, which
 * discarded the main photograph the moment a single gallery slot was filled.
 * A piece uploaded with three photographs showed two — and the missing one was
 * the shot the shop lists it by everywhere else, so a customer saw an image in
 * the grid, opened the product, and that image was nowhere in the gallery.
 *
 * The three cases below are not invented: they are the three shapes the live
 * catalogue actually contains across the 43 products that have a gallery.
 */

const swatch = 'data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E';
const p = (over: Partial<Parameters<typeof buildGallery>[0]> = {}) => ({
  photo: '/products/main.jpg',
  image: swatch,
  photoGallery: undefined,
  gallery: undefined,
  ...over,
});

test('Product page · the rail shows every photograph, once', async () => {
  const rec = new Recorder({
    slug: 'product-gallery',
    title: 'Product page · main photo leads, nothing shown twice',
    area: 'Storefront · Product',
    purpose:
      'A product carries a main photograph plus up to three gallery shots. The rail used to drop the main one as soon as any gallery slot was filled, which hid it on 13 live products — the very photograph the grid, the cart and the home page use to show the piece.',
    reproduce: [
      'Open a product that has both a main photo and gallery images.',
      'The rail leads with the main photograph, then the gallery shots.',
      'A shot saved in both places appears once, not twice.',
    ],
  });

  try {
    // --- The reported bug: three uploaded, two shown -----------------------
    // RED DRESS (TC00073) is exactly this shape: photo + 2 gallery entries.
    const three = buildGallery(p({
      photo: '/products/a.jpg',
      photoGallery: ['/products/b.jpg', '/products/c.jpg'],
    }));
    expect(three.map(g => g.photo)).toEqual(['/products/a.jpg', '/products/b.jpg', '/products/c.jpg']);
    rec.note('All three photographs reach the rail', 'The main shot leads; it used to be dropped entirely.');

    // --- 30 live products repeat the main photo in Gallery 1 ---------------
    // Prepending it naively would show the same shot twice, which reads as a
    // bug to a shopper even though nothing is missing.
    const repeated = buildGallery(p({
      photo: '/products/a.jpg',
      photoGallery: ['/products/a.jpg', '/products/b.jpg'],
    }));
    expect(repeated.map(g => g.photo)).toEqual(['/products/a.jpg', '/products/b.jpg']);
    rec.note('A shot saved twice is shown once', 'The studio routinely pastes the main photo into Gallery 1.');

    // --- 2 live products have no main photo but do have gallery shots ------
    // A generated swatch is what a piece carries INSTEAD of a photograph, so it
    // must never lead a rail that holds a real one.
    const swatchLead = buildGallery(p({
      photo: swatch,
      photoGallery: ['/products/real.jpg'],
    }));
    expect(swatchLead.map(g => g.photo)).toEqual(['/products/real.jpg']);
    rec.note('A placeholder never fronts a real photograph', 'Even when it is the product\'s main image field.');

    // --- An unphotographed piece still renders -----------------------------
    // If everything is a swatch the piece simply has no photographs; the rail
    // keeps one so the page shows a placeholder rather than an empty frame.
    const none = buildGallery(p({ photo: swatch, photoGallery: [] }));
    expect(none).toHaveLength(1);
    expect(none[0].photo).toBe(swatch);

    // --- Fallbacks stay aligned with their photographs ---------------------
    // The rail renders gallery[i].fallback when gallery[i].photo fails to load;
    // if the arrays drift, a broken image shows the WRONG piece's swatch.
    const aligned = buildGallery({
      photo: '/products/a.jpg',
      image: 'swatch-a',
      photoGallery: ['/products/b.jpg', '/products/c.jpg'],
      gallery: ['swatch-b', 'swatch-c'],
    });
    expect(aligned).toEqual([
      { photo: '/products/a.jpg', fallback: 'swatch-a' },
      { photo: '/products/b.jpg', fallback: 'swatch-b' },
      { photo: '/products/c.jpg', fallback: 'swatch-c' },
    ]);
    rec.note('Each photograph keeps its own fallback', 'A failed image shows this piece\'s swatch, not a neighbour\'s.');

    // A gallery with no matching fallbacks must not produce undefined — the
    // rail passes `fallback` straight to an <img src>.
    const noFallbacks = buildGallery(p({
      photo: '/products/a.jpg', image: 'swatch-a',
      photoGallery: ['/products/b.jpg'],
    }));
    expect(noFallbacks.every(g => typeof g.fallback === 'string' && g.fallback.length > 0)).toBe(true);

    rec.finish('passed');
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});
