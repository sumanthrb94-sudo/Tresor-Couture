import { Fabric, Collection, Testimonial } from './types';

export const FABRICS: Fabric[] = [
  {
    id: '1',
    name: 'Mashru Silk-Satin',
    description:
      'A "permitted" fabric where silk never touches the skin. Hand-woven by the last four families of Mandvi keeping this craft alive. Lustrous satin face on a cotton ground, ideal for jackets, lehengas and cushion covers.',
    pricePerMeter: 4500,
    image: 'https://images.unsplash.com/photo-1620164233772-246d88ff7536?auto=format&fit=crop&q=80&w=1200',
    gallery: [
      'https://images.unsplash.com/photo-1620164233772-246d88ff7536?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1551803091-e20673f15770?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1605518293442-3eaeae5e421b?auto=format&fit=crop&q=80&w=1200'
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
    image: 'https://images.unsplash.com/photo-1610406534231-0701fd0326c4?auto=format&fit=crop&q=80&w=1200',
    gallery: [
      'https://images.unsplash.com/photo-1610406534231-0701fd0326c4?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1200'
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
    image: 'https://images.unsplash.com/photo-1590736910113-f9630613914b?auto=format&fit=crop&q=80&w=1200',
    gallery: [
      'https://images.unsplash.com/photo-1590736910113-f9630613914b?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1200'
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
    image: 'https://images.unsplash.com/photo-1589363360147-442ca02cc047?auto=format&fit=crop&q=80&w=1200',
    gallery: [
      'https://images.unsplash.com/photo-1589363360147-442ca02cc047?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&q=80&w=1200'
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
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=1200',
    gallery: [
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=1200'
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
    image: 'https://images.unsplash.com/photo-1605518293442-3eaeae5e421b?auto=format&fit=crop&q=80&w=1200',
    gallery: [
      'https://images.unsplash.com/photo-1605518293442-3eaeae5e421b?auto=format&fit=crop&q=80&w=1200'
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
    image: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&q=80&w=1200',
    gallery: [
      'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&q=80&w=1200'
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
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1200',
    gallery: [
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1200'
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
    image: 'https://images.unsplash.com/photo-1551803091-e20673f15770?auto=format&fit=crop&q=80&w=1200',
    gallery: [
      'https://images.unsplash.com/photo-1551803091-e20673f15770?auto=format&fit=crop&q=80&w=1200'
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
    image: 'https://images.unsplash.com/photo-1574169208538-4f45163a14e6?auto=format&fit=crop&q=80&w=1200',
    gallery: [
      'https://images.unsplash.com/photo-1574169208538-4f45163a14e6?auto=format&fit=crop&q=80&w=1200'
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
    image: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&q=80&w=1200',
    gallery: [
      'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&q=80&w=1200'
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
    image: 'https://images.unsplash.com/photo-1606293459380-e7d8b1c2e8e9?auto=format&fit=crop&q=80&w=1200',
    gallery: [
      'https://images.unsplash.com/photo-1606293459380-e7d8b1c2e8e9?auto=format&fit=crop&q=80&w=1200'
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
    coverImage: 'https://images.unsplash.com/photo-1574169208538-4f45163a14e6?auto=format&fit=crop&q=80&w=1200',
    items: FABRICS.filter(f => f.category === 'Silk' || f.category === 'Satin')
  },
  {
    id: 'ethereal',
    name: 'Aether',
    subtitle: 'Light & Legacy',
    description:
      'Focusing on the fine muslins and translucent weaves that defined elegance in a bygone era.',
    coverImage: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&q=80&w=1200',
    items: FABRICS.filter(f => f.category === 'Cotton' || f.category === 'Linen')
  }
];

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
