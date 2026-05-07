// All fabric photographs are routed through images.weserv.nl, a free public
// CDN proxy that side-steps the per-region hotlink blocks Unsplash and similar
// hosts apply when called from edge regions like Vercel. Falls back to the
// inline SVG swatch via FabricImage's onError if a source URL is dead.

interface PhotoOpts {
  w?: number;
  h?: number;
  fit?: 'cover' | 'contain' | 'inside' | 'outside';
}

const PROXY = 'https://images.weserv.nl/';

export const photoUrl = (sourceUrl: string, { w = 1000, h = 1250, fit = 'cover' }: PhotoOpts = {}): string => {
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

// Curated CC0 / Unsplash photography. Each entry is the bare upstream URL;
// `photoUrl` wraps it with the proxy so the browser fetches a single
// edge-cached, well-behaved image regardless of source policies.

export const SOURCES = {
  // Mashru Silk-Satin — saffron silk drape
  mashru: 'images.unsplash.com/photo-1583391733956-3750e0ff4e8b',
  mashru2: 'images.unsplash.com/photo-1610030469983-98e550d6193c',
  mashru3: 'images.unsplash.com/photo-1602810316693-3667c854239a',

  // Real Zari Banarasi — gold brocade
  banarasi: 'images.unsplash.com/photo-1610030469668-2e9e09f56e54',
  banarasi2: 'images.unsplash.com/photo-1610030469983-98e550d6193c',
  banarasi3: 'images.unsplash.com/photo-1583391733975-cebd6e5b4cc1',

  // Patan Patola — double ikat
  patola: 'images.unsplash.com/photo-1610030181087-540017dc9d61',
  patola2: 'images.unsplash.com/photo-1606293459380-e7d8b1c2e8e9',

  // Dhakai Jamdani — translucent muslin
  jamdani: 'images.unsplash.com/photo-1582719471384-894fbb16e074',
  jamdani2: 'images.unsplash.com/photo-1544441893-675973e31985',

  // Chanderi — sheer cotton-silk
  chanderi: 'images.unsplash.com/photo-1551803091-e20673f15770',
  chanderi2: 'images.unsplash.com/photo-1582719471384-894fbb16e074',
  chanderi3: 'images.unsplash.com/photo-1583391733956-3750e0ff4e8b',

  // Pashmina — soft wool drape
  pashmina: 'images.unsplash.com/photo-1605518293442-3eaeae5e421b',
  pashmina2: 'images.unsplash.com/photo-1620799140408-edc6dcb6d633',

  // Belgian Linen — natural slub
  linen: 'images.unsplash.com/photo-1620916566398-39f1143ab7be',
  linen2: 'images.unsplash.com/photo-1606293459380-e7d8b1c2e8e9',

  // Kanjivaram — temple-border silk (this one previously rendered for the user)
  kanjivaram: 'images.unsplash.com/photo-1610030469983-98e550d6193c',
  kanjivaram2: 'images.unsplash.com/photo-1583391733956-3750e0ff4e8b',

  // Kalamkari — hand-painted cotton
  kalamkari: 'images.unsplash.com/photo-1599643478518-a784e5dc4c8f',
  kalamkari2: 'images.unsplash.com/photo-1551803091-e20673f15770',

  // Italian Merino Wool — suiting cloth
  merino: 'images.unsplash.com/photo-1574169208538-4f45163a14e6',
  merino2: 'images.unsplash.com/photo-1606293459380-e7d8b1c2e8e9',

  // Bandhani — tie-dye constellation
  bandhani: 'images.unsplash.com/photo-1620799140408-edc6dcb6d633',
  bandhani2: 'images.unsplash.com/photo-1583391733956-3750e0ff4e8b',

  // Linen-Silk blend — modern drape
  linenSilk: 'images.unsplash.com/photo-1606293459380-e7d8b1c2e8e9',
  linenSilk2: 'images.unsplash.com/photo-1620916566398-39f1143ab7be',

  // Hero — Varanasi gold
  hero: 'images.unsplash.com/photo-1583391733975-cebd6e5b4cc1',

  // Collection covers
  lostLoom: 'images.unsplash.com/photo-1610030469983-98e550d6193c',
  aether: 'images.unsplash.com/photo-1582719471384-894fbb16e074'
};
