// All fabric photographs are now served from the local `public/products/`
// directory, sourced from the in-house catalogue shoot. Local paths bypass
// the images.weserv.nl proxy entirely; legacy upstream URLs continue to be
// proxied for any future external imagery.

interface PhotoOpts {
  w?: number;
  h?: number;
  fit?: 'cover' | 'contain' | 'inside' | 'outside';
}

const PROXY = 'https://images.weserv.nl/';

export const photoUrl = (sourceUrl: string, { w = 1000, h = 1250, fit = 'cover' }: PhotoOpts = {}): string => {
  // Local assets shipped from /public — return unchanged so Vite serves them directly.
  if (sourceUrl.startsWith('/') || sourceUrl.startsWith('data:')) return sourceUrl;

  const cleaned = sourceUrl.replace(/^https?:\/\//, '');
  const params = new URLSearchParams({
    url: cleaned,
    w: String(w),
    h: String(h),
    fit,
    output: 'webp',
    q: '80'
  });
  return `${PROXY}?${params.toString()}`;
};

// Catalogue photography paths — each is /public/products/<file>.jpg, served
// at runtime as /products/<file>.jpg. Filenames are descriptive so reordering
// the catalogue stays obvious in source.

export const SOURCES = {
  // Mashru Silk-Satin — saffron / yellow drape on swing
  mashru: '/products/mashru-saffron-1.jpg',
  mashru2: '/products/bandhani-red-1.jpg',
  mashru3: '/products/bandhani-red-2.jpg',

  // Real Zari Banarasi — purple sequined brocade
  banarasi: '/products/banarasi-purple-1.jpg',
  banarasi2: '/products/banarasi-purple-2.jpg',
  banarasi3: '/products/banarasi-purple-4.jpg',

  // Patan Patola — purple + kalamkari multicolor border
  patola: '/products/patola-purple-1.jpg',
  patola2: '/products/patola-purple-2.jpg',

  // Dhakai Jamdani — pink/yellow kalamkari prints
  jamdani: '/products/jamdani-pink-1.jpg',
  jamdani2: '/products/jamdani-pink-2.jpg',

  // Chanderi — cream multicolour swirl
  chanderi: '/products/kalamkari-cream-1.jpg',
  chanderi2: '/products/kalamkari-cream-2.jpg',
  chanderi3: '/products/kalamkari-cream-3.jpg',

  // Pashmina — solid purple sari
  pashmina: '/products/banarasi-purple-3.jpg',
  pashmina2: '/products/banarasi-purple-2.jpg',

  // Belgian Linen — olive kalamkari (closest natural-toned shot)
  linen: '/products/kanjivaram-olive-1.jpg',
  linen2: '/products/kanjivaram-olive-2.jpg',

  // Kanjivaram — peacock / olive kalamkari
  kanjivaram: '/products/kanjivaram-olive-1.jpg',
  kanjivaram2: '/products/kanjivaram-olive-2.jpg',

  // Kalamkari Cotton — cream hand-painted prints
  kalamkari: '/products/kalamkari-cream-2.jpg',
  kalamkari2: '/products/kalamkari-cream-4.jpg',

  // Italian Merino Wool — olive / cream tones
  merino: '/products/kanjivaram-olive-2.jpg',
  merino2: '/products/kalamkari-cream-3.jpg',

  // Bandhani — red dotted silk on swing
  bandhani: '/products/bandhani-red-1.jpg',
  bandhani2: '/products/bandhani-red-2.jpg',

  // Linen-Silk Blend — teal + pink kalamkari
  linenSilk: '/products/linensilk-teal-1.jpg',
  linenSilk2: '/products/jamdani-pink-3.jpg',

  // Hero — kalamkari cream signature shot
  hero: '/products/kalamkari-cream-1.jpg',

  // Collection covers
  lostLoom: '/products/banarasi-purple-1.jpg',
  aether: '/products/kalamkari-cream-2.jpg'
};
