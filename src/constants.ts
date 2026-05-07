import { Fabric, Collection, Testimonial } from './types';
import { fabricSwatch } from './lib/swatch';
import { photoUrl, SOURCES } from './lib/photo';

const swatch = (
  id: string,
  primary: string,
  secondary: string,
  accent: string,
  weave: 'satin' | 'brocade' | 'ikat' | 'jamdani' | 'tie-dye' | 'plain' | 'twill' | 'kalamkari' | 'kanjivaram',
  name: string,
  origin: string
) => fabricSwatch({ id, primary, secondary, accent, weave, name, origin });

const p = (src: string, w = 1000, h = 1250) => photoUrl(src, { w, h });

export const FABRICS: Fabric[] = [
  {
    id: '1',
    name: 'Mashru Silk-Satin',
    description:
      'A "permitted" fabric where silk never touches the skin. Hand-woven by the last four families of Mandvi keeping this craft alive. Lustrous satin face on a cotton ground, ideal for jackets, lehengas and cushion covers.',
    pricePerMeter: 4500,
    photo: p(SOURCES.mashru),
    photoGallery: [p(SOURCES.mashru), p(SOURCES.mashru2), p(SOURCES.mashru3)],
    image: swatch('f1', '#2A3F66', '#E2A33A', '#F2EBDD', 'satin', 'Mashru Silk-Satin', 'Mandvi'),
    gallery: [
      swatch('f1a', '#2A3F66', '#E2A33A', '#F2EBDD', 'satin', 'Mashru Silk-Satin', 'Indigo'),
      swatch('f1b', '#E2A33A', '#7A1F2C', '#F2EBDD', 'satin', 'Mashru Silk-Satin', 'Saffron'),
      swatch('f1c', '#F2EBDD', '#C5A059', '#7A1F2C', 'satin', 'Mashru Silk-Satin', 'Ivory')
    ],
    category: 'Satin',
    origin: 'Mandvi, Gujarat',
    tags: ['Endangered', 'Handloom', 'Heritage'],
    colors: [
      { name: 'Indigo', hex: '#2A3F66' },
      { name: 'Saffron', hex: '#E2A33A' },
      { name: 'Ivory', hex: '#F2EBDD' }
    ],
    widthInches: 44,
    inStockMeters: 38,
    weaveType: 'Warp-faced satin',
    rating: 4.8,
    reviewCount: 64
  },
  {
    id: '2',
    name: 'Real Zari Banarasi',
    description:
      'Woven on traditional pit looms with authentic silver-and-gold zari. A regal weave for bridal lehengas, sherwanis and statement saris.',
    pricePerMeter: 12500,
    photo: p(SOURCES.banarasi),
    photoGallery: [p(SOURCES.banarasi), p(SOURCES.banarasi2), p(SOURCES.banarasi3)],
    image: swatch('f2', '#7A1F2C', '#C5A059', '#F2EBDD', 'brocade', 'Real Zari Banarasi', 'Varanasi'),
    gallery: [
      swatch('f2a', '#7A1F2C', '#C5A059', '#F2EBDD', 'brocade', 'Real Zari Banarasi', 'Maroon'),
      swatch('f2b', '#1F5D4F', '#C5A059', '#F2EBDD', 'brocade', 'Real Zari Banarasi', 'Emerald'),
      swatch('f2c', '#C5A059', '#7A1F2C', '#F2EBDD', 'brocade', 'Real Zari Banarasi', 'Gold')
    ],
    category: 'Silk',
    origin: 'Varanasi',
    tags: ['Royal Heritage', 'Silver Thread', 'Authentic'],
    colors: [
      { name: 'Maroon', hex: '#7A1F2C' },
      { name: 'Emerald', hex: '#1F5D4F' },
      { name: 'Gold', hex: '#C5A059' }
    ],
    widthInches: 45,
    inStockMeters: 22,
    weaveType: 'Kadhua Brocade',
    rating: 4.9,
    reviewCount: 128
  },
  {
    id: '3',
    name: 'Patan Patola',
    description:
      'The "King of Textiles". A double-ikkat masterpiece taking master weavers up to six months per sari. Reversible, mathematically precise and museum-grade.',
    pricePerMeter: 28000,
    photo: p(SOURCES.patola),
    photoGallery: [p(SOURCES.patola), p(SOURCES.patola2)],
    image: swatch('f3', '#9B1B30', '#1E3A8A', '#F2EBDD', 'ikat', 'Patan Patola', 'Patan'),
    gallery: [
      swatch('f3a', '#9B1B30', '#1E3A8A', '#F2EBDD', 'ikat', 'Patan Patola', 'Crimson'),
      swatch('f3b', '#1E3A8A', '#C5A059', '#F2EBDD', 'ikat', 'Patan Patola', 'Royal Blue')
    ],
    category: 'Silk',
    origin: 'Patan, Gujarat',
    tags: ['Rarest', 'Double Ikkat', 'Museum Grade'],
    colors: [
      { name: 'Crimson', hex: '#9B1B30' },
      { name: 'Royal Blue', hex: '#1E3A8A' }
    ],
    widthInches: 44,
    inStockMeters: 8,
    weaveType: 'Double Ikkat',
    rating: 5.0,
    reviewCount: 42
  },
  {
    id: '4',
    name: 'Dhakai Jamdani Muslin',
    description:
      'The "Ghost Fabric". A translucent, 300-count cotton weave once reserved for Mughal courts. Featherlight and ethereally drapey.',
    pricePerMeter: 3800,
    photo: p(SOURCES.jamdani),
    photoGallery: [p(SOURCES.jamdani), p(SOURCES.jamdani2)],
    image: swatch('f4', '#EDE7DA', '#B5B8B1', '#C5A059', 'jamdani', 'Dhakai Jamdani', 'West Bengal'),
    gallery: [
      swatch('f4a', '#EDE7DA', '#B5B8B1', '#C5A059', 'jamdani', 'Dhakai Jamdani', 'Pearl'),
      swatch('f4b', '#B5B8B1', '#EDE7DA', '#7A7A4F', 'jamdani', 'Dhakai Jamdani', 'Mist Grey')
    ],
    category: 'Cotton',
    origin: 'West Bengal',
    tags: ['Ethereal', 'Ancient Craft', 'Hand-spun'],
    colors: [
      { name: 'Pearl', hex: '#EDE7DA' },
      { name: 'Mist Grey', hex: '#B5B8B1' }
    ],
    widthInches: 42,
    inStockMeters: 56,
    weaveType: 'Discontinuous Supplementary Weft',
    rating: 4.7,
    reviewCount: 88
  },
  {
    id: '5',
    name: 'Chanderi Silk-Cotton',
    description:
      'A glassy, sheer weave from Madhya Pradesh blending silk warp with cotton weft. Subtle sheen, perfect for summer saris and dupattas.',
    pricePerMeter: 2200,
    photo: p(SOURCES.chanderi),
    photoGallery: [p(SOURCES.chanderi), p(SOURCES.chanderi2), p(SOURCES.chanderi3)],
    image: swatch('f5', '#E8C7C8', '#C5A059', '#F2EBDD', 'plain', 'Chanderi', 'Chanderi'),
    gallery: [
      swatch('f5a', '#E8C7C8', '#C5A059', '#F2EBDD', 'plain', 'Chanderi', 'Powder Pink'),
      swatch('f5b', '#B6D7C9', '#C5A059', '#F2EBDD', 'plain', 'Chanderi', 'Mint'),
      swatch('f5c', '#E5D3A8', '#C5A059', '#7A1F2C', 'plain', 'Chanderi', 'Champagne')
    ],
    category: 'Mixed',
    origin: 'Chanderi, Madhya Pradesh',
    tags: ['Sheer', 'Lightweight', 'Summer'],
    colors: [
      { name: 'Powder Pink', hex: '#E8C7C8' },
      { name: 'Mint', hex: '#B6D7C9' },
      { name: 'Champagne', hex: '#E5D3A8' }
    ],
    widthInches: 44,
    inStockMeters: 110,
    weaveType: 'Plain weave with zari motifs',
    rating: 4.6,
    reviewCount: 154
  },
  {
    id: '6',
    name: 'Pashmina Cashmere',
    description:
      'Hand-spun and hand-woven from the under-fleece of Changthangi goats in Ladakh. The warmest, softest wool on earth.',
    pricePerMeter: 9800,
    photo: p(SOURCES.pashmina),
    photoGallery: [p(SOURCES.pashmina), p(SOURCES.pashmina2)],
    image: swatch('f6', '#D8C8AE', '#3A3A3A', '#C5A059', 'twill', 'Pashmina', 'Ladakh'),
    gallery: [
      swatch('f6a', '#D8C8AE', '#3A3A3A', '#C5A059', 'twill', 'Pashmina', 'Natural'),
      swatch('f6b', '#3A3A3A', '#D8C8AE', '#C5A059', 'twill', 'Pashmina', 'Charcoal')
    ],
    category: 'Wool',
    origin: 'Ladakh',
    tags: ['Heirloom', 'Hand-spun', 'Winter'],
    colors: [
      { name: 'Natural', hex: '#D8C8AE' },
      { name: 'Charcoal', hex: '#3A3A3A' }
    ],
    widthInches: 36,
    inStockMeters: 18,
    weaveType: 'Twill',
    rating: 4.9,
    reviewCount: 71
  },
  {
    id: '7',
    name: 'Belgian Linen',
    description:
      'European flax linen with a crisp hand and natural slub. Ages beautifully and softens with each wash. A modern essential.',
    pricePerMeter: 1850,
    photo: p(SOURCES.linen),
    photoGallery: [p(SOURCES.linen), p(SOURCES.linen2)],
    image: swatch('f7', '#D9CDB3', '#7A7A4F', '#F2EBDD', 'plain', 'Belgian Linen', 'Belgium'),
    gallery: [
      swatch('f7a', '#D9CDB3', '#7A7A4F', '#F2EBDD', 'plain', 'Belgian Linen', 'Oat'),
      swatch('f7b', '#6E747B', '#D9CDB3', '#F2EBDD', 'plain', 'Belgian Linen', 'Slate'),
      swatch('f7c', '#7A7A4F', '#D9CDB3', '#F2EBDD', 'plain', 'Belgian Linen', 'Olive'),
      swatch('f7d', '#F2EBDD', '#D9CDB3', '#7A7A4F', 'plain', 'Belgian Linen', 'Ivory')
    ],
    category: 'Linen',
    origin: 'Flanders, Belgium',
    tags: ['Sustainable', 'Modern', 'Everyday'],
    colors: [
      { name: 'Oat', hex: '#D9CDB3' },
      { name: 'Slate', hex: '#6E747B' },
      { name: 'Olive', hex: '#7A7A4F' },
      { name: 'Ivory', hex: '#F2EBDD' }
    ],
    widthInches: 58,
    inStockMeters: 240,
    weaveType: 'Plain weave',
    rating: 4.5,
    reviewCount: 312
  },
  {
    id: '8',
    name: 'Kanjivaram Silk',
    description:
      'Pure mulberry silk woven with three-shuttle technique. Heavy, regal and known for its temple-border motifs.',
    pricePerMeter: 8400,
    photo: p(SOURCES.kanjivaram),
    photoGallery: [p(SOURCES.kanjivaram), p(SOURCES.kanjivaram2)],
    image: swatch('f8', '#0E5E6F', '#C5A059', '#F2EBDD', 'kanjivaram', 'Kanjivaram', 'Tamil Nadu'),
    gallery: [
      swatch('f8a', '#0E5E6F', '#C5A059', '#F2EBDD', 'kanjivaram', 'Kanjivaram', 'Peacock'),
      swatch('f8b', '#C9266B', '#C5A059', '#F2EBDD', 'kanjivaram', 'Kanjivaram', 'Rani Pink')
    ],
    category: 'Silk',
    origin: 'Kanchipuram, Tamil Nadu',
    tags: ['Bridal', 'Temple Border', 'Mulberry'],
    colors: [
      { name: 'Peacock', hex: '#0E5E6F' },
      { name: 'Rani Pink', hex: '#C9266B' }
    ],
    widthInches: 47,
    inStockMeters: 30,
    weaveType: 'Three-shuttle',
    rating: 4.8,
    reviewCount: 96
  },
  {
    id: '9',
    name: 'Kalamkari Cotton',
    description:
      'Hand-painted with natural dyes using bamboo pens. Each meter tells a story drawn from epics and folk traditions.',
    pricePerMeter: 1650,
    photo: p(SOURCES.kalamkari),
    photoGallery: [p(SOURCES.kalamkari), p(SOURCES.kalamkari2)],
    image: swatch('f9', '#9B3A2A', '#2A3F66', '#F2EBDD', 'kalamkari', 'Kalamkari', 'Andhra Pradesh'),
    gallery: [
      swatch('f9a', '#9B3A2A', '#2A3F66', '#F2EBDD', 'kalamkari', 'Kalamkari', 'Madder Red'),
      swatch('f9b', '#2A3F66', '#9B3A2A', '#F2EBDD', 'kalamkari', 'Kalamkari', 'Indigo')
    ],
    category: 'Cotton',
    origin: 'Srikalahasti, Andhra Pradesh',
    tags: ['Hand-painted', 'Natural Dyes', 'Story Cloth'],
    colors: [
      { name: 'Madder Red', hex: '#9B3A2A' },
      { name: 'Indigo', hex: '#2A3F66' }
    ],
    widthInches: 44,
    inStockMeters: 78,
    weaveType: 'Plain woven, hand-painted',
    rating: 4.7,
    reviewCount: 142
  },
  {
    id: '10',
    name: 'Italian Merino Wool',
    description:
      'Super-130s merino from Biella, Italy. The standard for bespoke suiting and winter couture.',
    pricePerMeter: 6200,
    photo: p(SOURCES.merino),
    photoGallery: [p(SOURCES.merino), p(SOURCES.merino2)],
    image: swatch('f10', '#0F1B2D', '#9A958A', '#C5A059', 'twill', 'Italian Merino', 'Biella'),
    gallery: [
      swatch('f10a', '#0F1B2D', '#9A958A', '#C5A059', 'twill', 'Italian Merino', 'Midnight'),
      swatch('f10b', '#3A3A3A', '#9A958A', '#C5A059', 'twill', 'Italian Merino', 'Charcoal'),
      swatch('f10c', '#9A958A', '#3A3A3A', '#C5A059', 'twill', 'Italian Merino', 'Stone')
    ],
    category: 'Wool',
    origin: 'Biella, Italy',
    tags: ['Suiting', 'Super 130s', 'Bespoke'],
    colors: [
      { name: 'Midnight', hex: '#0F1B2D' },
      { name: 'Charcoal', hex: '#3A3A3A' },
      { name: 'Stone', hex: '#9A958A' }
    ],
    widthInches: 60,
    inStockMeters: 96,
    weaveType: 'Twill',
    rating: 4.6,
    reviewCount: 58
  },
  {
    id: '11',
    name: 'Bandhani Tie-Dye Silk',
    description:
      'Each dot tied by hand before dyeing. A Gujarat craft that turns silk into a constellation of colour.',
    pricePerMeter: 3200,
    photo: p(SOURCES.bandhani),
    photoGallery: [p(SOURCES.bandhani), p(SOURCES.bandhani2)],
    image: swatch('f11', '#C8312B', '#D6A93B', '#F2EBDD', 'tie-dye', 'Bandhani', 'Kutch'),
    gallery: [
      swatch('f11a', '#C8312B', '#D6A93B', '#F2EBDD', 'tie-dye', 'Bandhani', 'Vermilion'),
      swatch('f11b', '#D6A93B', '#C8312B', '#F2EBDD', 'tie-dye', 'Bandhani', 'Mustard')
    ],
    category: 'Silk',
    origin: 'Kutch, Gujarat',
    tags: ['Tie-Dye', 'Festive', 'Hand-knotted'],
    colors: [
      { name: 'Vermilion', hex: '#C8312B' },
      { name: 'Mustard', hex: '#D6A93B' }
    ],
    widthInches: 44,
    inStockMeters: 44,
    weaveType: 'Resist-dyed plain weave',
    rating: 4.7,
    reviewCount: 109
  },
  {
    id: '12',
    name: 'Linen-Silk Blend',
    description:
      'A modern blend: the crispness of linen with the lustre of silk. Elegant for shirts, drapes and saris alike.',
    pricePerMeter: 2950,
    photo: p(SOURCES.linenSilk),
    photoGallery: [p(SOURCES.linenSilk), p(SOURCES.linenSilk2)],
    image: swatch('f12', '#E7DFCF', '#A6B89A', '#C5A059', 'plain', 'Linen-Silk', 'Bhagalpur'),
    gallery: [
      swatch('f12a', '#E7DFCF', '#A6B89A', '#C5A059', 'plain', 'Linen-Silk', 'Bone'),
      swatch('f12b', '#A6B89A', '#E7DFCF', '#C5A059', 'plain', 'Linen-Silk', 'Sage')
    ],
    category: 'Mixed',
    origin: 'Bhagalpur',
    tags: ['Blend', 'Drape', 'Versatile'],
    colors: [
      { name: 'Bone', hex: '#E7DFCF' },
      { name: 'Sage', hex: '#A6B89A' }
    ],
    widthInches: 54,
    inStockMeters: 130,
    weaveType: 'Plain weave',
    rating: 4.5,
    reviewCount: 67
  }
];

export const COLLECTIONS: Collection[] = [
  {
    id: 'heritage',
    name: 'The Lost Loom',
    subtitle: 'Revival Series 01',
    description:
      'A dedicated initiative to rescue and restore weaving techniques that are on the brink of extinction.',
    coverPhoto: p(SOURCES.lostLoom, 1400, 800),
    coverImage: swatch('chero', '#7A1F2C', '#C5A059', '#F2EBDD', 'brocade', 'The Lost Loom', 'Heritage Revival'),
    items: FABRICS.filter(f => f.category === 'Silk' || f.category === 'Satin')
  },
  {
    id: 'ethereal',
    name: 'Aether',
    subtitle: 'Light & Legacy',
    description:
      'Focusing on the fine muslins and translucent weaves that defined elegance in a bygone era.',
    coverPhoto: p(SOURCES.aether, 1400, 800),
    coverImage: swatch('caether', '#EDE7DA', '#C5A059', '#7A7A4F', 'jamdani', 'Aether', 'Light & Legacy'),
    items: FABRICS.filter(f => f.category === 'Cotton' || f.category === 'Linen')
  }
];

export const HERO_PHOTO = p(SOURCES.hero, 1600, 1800);
export const HERO_IMAGE = swatch(
  'hero',
  '#7A1F2C',
  '#C5A059',
  '#F2EBDD',
  'brocade',
  'Varanasi Gold',
  'Selected Weave'
);

export const TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    name: 'Ananya Sharma',
    role: 'Fashion Designer',
    content:
      'The quality of silk from Trésor Couture is unparalleled. My bridal collection owes its success to these exquisite fabrics.',
    avatar: 'https://i.pravatar.cc/150?u=ananya'
  },
  {
    id: '2',
    name: 'Vikram Mehta',
    role: 'Bespoke Tailor',
    content:
      'Their Italian wool is a dream to work with. The drape and finish are exactly what luxury tailoring requires.',
    avatar: 'https://i.pravatar.cc/150?u=vikram'
  }
];

export const CATEGORIES: Fabric['category'][] = ['Silk', 'Cotton', 'Wool', 'Linen', 'Satin', 'Mixed'];

export const SHIPPING_FLAT_RATE = 250;
export const FREE_SHIPPING_THRESHOLD = 10000;
export const TAX_RATE = 0.05;

export const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(n);
