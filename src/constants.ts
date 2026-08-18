import { Fabric, Collection, Testimonial } from './types';
import type { MasterCategory } from './types';
import { fabricSwatch } from './lib/swatch';
import { photoUrl, SOURCES } from './lib/photo';

const swatch = (
  id: string,
  primary: string,
  secondary: string,
  accent: string,
  weave: 'satin' | 'brocade' | 'ikat' | 'jamdani' | 'tie-dye' | 'plain' | 'twill' | 'kalamkari' | 'kanjivaram',
  name: string
) => fabricSwatch({ id, primary, secondary, accent, weave, name });

const p = (src: string, w = 1000, h = 1250) => photoUrl(src, { w, h });

const BRAND = 'TRESOR';

export const FABRICS: Fabric[] = [
  {
    id: '1',
    brand: BRAND,
    name: 'Mashru Silk-Satin Fabric',
    description:
      'A "permitted" fabric where silk never touches the skin. Hand-woven by the last four families of Mandvi keeping this craft alive. Lustrous satin face on a cotton ground, ideal for jackets, lehengas and cushion covers.',
    price: 4500,
    mrp: 7999,
    photo: p(SOURCES.mashru),
    photoGallery: [p(SOURCES.mashru), p(SOURCES.mashru2), p(SOURCES.mashru3)],
    image: swatch('f1', '#2A3F66', '#E2A33A', '#F2EBDD', 'satin', 'Mashru Silk-Satin'),
    gallery: [
      swatch('f1a', '#2A3F66', '#E2A33A', '#F2EBDD', 'satin', 'Mashru Silk-Satin'),
      swatch('f1b', '#E2A33A', '#7A1F2C', '#F2EBDD', 'satin', 'Mashru Silk-Satin'),
      swatch('f1c', '#F2EBDD', '#C5A059', '#7A1F2C', 'satin', 'Mashru Silk-Satin')
    ],
    category: 'Fabrics',
    masterCategory: 'Fabrics',
    materialType: 'Silk',
    tags: ['Endangered', 'Handloom', 'Heritage'],
    sticker: 'Bestseller',
    colors: [
      { name: 'Indigo', hex: '#2A3F66' },
      { name: 'Saffron', hex: '#E2A33A' },
      { name: 'Ivory', hex: '#F2EBDD' }
    ],
    stock: 38,
    weaveType: 'Warp-faced satin',
    rating: 4.8,
    reviewCount: 64
  },
  {
    id: '2',
    brand: BRAND,
    name: 'Real Zari Banarasi Bridal Fabric',
    description:
      'Woven on traditional pit looms with authentic silver-and-gold zari. A regal weave for bridal lehengas, sherwanis and statement saris.',
    price: 12500,
    mrp: 19999,
    photo: p(SOURCES.banarasi),
    photoGallery: [p(SOURCES.banarasi), p(SOURCES.banarasi2), p(SOURCES.banarasi3)],
    image: swatch('f2', '#7A1F2C', '#C5A059', '#F2EBDD', 'brocade', 'Real Zari Banarasi'),
    gallery: [
      swatch('f2a', '#7A1F2C', '#C5A059', '#F2EBDD', 'brocade', 'Real Zari Banarasi'),
      swatch('f2b', '#1F5D4F', '#C5A059', '#F2EBDD', 'brocade', 'Real Zari Banarasi'),
      swatch('f2c', '#C5A059', '#7A1F2C', '#F2EBDD', 'brocade', 'Real Zari Banarasi')
    ],
    category: 'Fabrics',
    masterCategory: 'Fabrics',
    materialType: 'Silk',
    tags: ['Royal Heritage', 'Silver Thread', 'Authentic'],
    sticker: 'Trending',
    colors: [
      { name: 'Maroon', hex: '#7A1F2C' },
      { name: 'Emerald', hex: '#1F5D4F' },
      { name: 'Gold', hex: '#C5A059' }
    ],
    stock: 22,
    weaveType: 'Kadhua Brocade',
    rating: 4.9,
    reviewCount: 128
  },
  {
    id: '3',
    brand: BRAND,
    name: 'Patan Patola Double-Ikat Silk',
    description:
      'The "King of Textiles". A double-ikkat masterpiece taking master weavers up to six months per sari. Reversible, mathematically precise and museum-grade.',
    price: 28000,
    mrp: 39999,
    photo: p(SOURCES.patola),
    photoGallery: [p(SOURCES.patola), p(SOURCES.patola2)],
    image: swatch('f3', '#9B1B30', '#1E3A8A', '#F2EBDD', 'ikat', 'Patan Patola'),
    gallery: [
      swatch('f3a', '#9B1B30', '#1E3A8A', '#F2EBDD', 'ikat', 'Patan Patola'),
      swatch('f3b', '#1E3A8A', '#C5A059', '#F2EBDD', 'ikat', 'Patan Patola')
    ],
    category: 'Fabrics',
    masterCategory: 'Fabrics',
    materialType: 'Silk',
    tags: ['Rarest', 'Double Ikkat', 'Museum Grade'],
    sticker: 'Limited',
    colors: [
      { name: 'Crimson', hex: '#9B1B30' },
      { name: 'Royal Blue', hex: '#1E3A8A' }
    ],
    stock: 8,
    weaveType: 'Double Ikkat',
    rating: 5.0,
    reviewCount: 42
  },
  {
    id: '4',
    brand: BRAND,
    name: 'Dhakai Jamdani Muslin Fabric',
    description:
      'The "Ghost Fabric". A translucent, 300-count cotton weave once reserved for Mughal courts. Featherlight and ethereally drapey.',
    price: 3800,
    mrp: 5999,
    photo: p(SOURCES.jamdani),
    photoGallery: [p(SOURCES.jamdani), p(SOURCES.jamdani2)],
    image: swatch('f4', '#EDE7DA', '#B5B8B1', '#C5A059', 'jamdani', 'Dhakai Jamdani'),
    gallery: [
      swatch('f4a', '#EDE7DA', '#B5B8B1', '#C5A059', 'jamdani', 'Dhakai Jamdani'),
      swatch('f4b', '#B5B8B1', '#EDE7DA', '#7A7A4F', 'jamdani', 'Dhakai Jamdani')
    ],
    category: 'Fabrics',
    masterCategory: 'Fabrics',
    materialType: 'Cotton',
    tags: ['Ethereal', 'Ancient Craft', 'Hand-spun'],
    sticker: 'New In',
    colors: [
      { name: 'Pearl', hex: '#EDE7DA' },
      { name: 'Mist Grey', hex: '#B5B8B1' }
    ],
    stock: 56,
    weaveType: 'Discontinuous Supplementary Weft',
    rating: 4.7,
    reviewCount: 88
  },
  {
    id: '5',
    brand: BRAND,
    name: 'Chanderi Silk-Cotton Sheer Fabric',
    description:
      'A glassy, sheer weave from Madhya Pradesh blending silk warp with cotton weft. Subtle sheen, perfect for summer saris and dupattas.',
    price: 2200,
    mrp: 3499,
    photo: p(SOURCES.chanderi),
    photoGallery: [p(SOURCES.chanderi), p(SOURCES.chanderi2), p(SOURCES.chanderi3)],
    image: swatch('f5', '#E8C7C8', '#C5A059', '#F2EBDD', 'plain', 'Chanderi'),
    gallery: [
      swatch('f5a', '#E8C7C8', '#C5A059', '#F2EBDD', 'plain', 'Chanderi'),
      swatch('f5b', '#B6D7C9', '#C5A059', '#F2EBDD', 'plain', 'Chanderi'),
      swatch('f5c', '#E5D3A8', '#C5A059', '#7A1F2C', 'plain', 'Chanderi')
    ],
    category: 'Fabrics',
    masterCategory: 'Fabrics',
    materialType: 'Mixed',
    tags: ['Sheer', 'Lightweight', 'Summer'],
    colors: [
      { name: 'Powder Pink', hex: '#E8C7C8' },
      { name: 'Mint', hex: '#B6D7C9' },
      { name: 'Champagne', hex: '#E5D3A8' }
    ],
    stock: 110,
    weaveType: 'Plain weave with zari motifs',
    rating: 4.6,
    reviewCount: 154
  },
  {
    id: '6',
    brand: BRAND,
    name: 'Pashmina Cashmere Shawl Cloth',
    description:
      'Hand-spun and hand-woven from the under-fleece of Changthangi goats in Ladakh. The warmest, softest wool on earth.',
    price: 9800,
    mrp: 15999,
    photo: p(SOURCES.pashmina),
    photoGallery: [p(SOURCES.pashmina), p(SOURCES.pashmina2)],
    image: swatch('f6', '#D8C8AE', '#3A3A3A', '#C5A059', 'twill', 'Pashmina'),
    gallery: [
      swatch('f6a', '#D8C8AE', '#3A3A3A', '#C5A059', 'twill', 'Pashmina'),
      swatch('f6b', '#3A3A3A', '#D8C8AE', '#C5A059', 'twill', 'Pashmina')
    ],
    category: 'Fabrics',
    masterCategory: 'Fabrics',
    materialType: 'Wool',
    tags: ['Heirloom', 'Hand-spun', 'Winter'],
    sticker: 'Bestseller',
    colors: [
      { name: 'Natural', hex: '#D8C8AE' },
      { name: 'Charcoal', hex: '#3A3A3A' }
    ],
    stock: 18,
    weaveType: 'Twill',
    rating: 4.9,
    reviewCount: 71
  },
  {
    id: '7',
    brand: BRAND,
    name: 'Belgian Linen Fabric',
    description:
      'European flax linen with a crisp hand and natural slub. Ages beautifully and softens with each wash. A modern essential.',
    price: 1850,
    mrp: 2999,
    photo: p(SOURCES.linen),
    photoGallery: [p(SOURCES.linen), p(SOURCES.linen2)],
    image: swatch('f7', '#D9CDB3', '#7A7A4F', '#F2EBDD', 'plain', 'Belgian Linen'),
    gallery: [
      swatch('f7a', '#D9CDB3', '#7A7A4F', '#F2EBDD', 'plain', 'Belgian Linen'),
      swatch('f7b', '#6E747B', '#D9CDB3', '#F2EBDD', 'plain', 'Belgian Linen'),
      swatch('f7c', '#7A7A4F', '#D9CDB3', '#F2EBDD', 'plain', 'Belgian Linen'),
      swatch('f7d', '#F2EBDD', '#D9CDB3', '#7A7A4F', 'plain', 'Belgian Linen')
    ],
    category: 'Fabrics',
    masterCategory: 'Fabrics',
    materialType: 'Linen',
    tags: ['Sustainable', 'Modern', 'Everyday'],
    colors: [
      { name: 'Oat', hex: '#D9CDB3' },
      { name: 'Slate', hex: '#6E747B' },
      { name: 'Olive', hex: '#7A7A4F' },
      { name: 'Ivory', hex: '#F2EBDD' }
    ],
    stock: 240,
    weaveType: 'Plain weave',
    rating: 4.5,
    reviewCount: 312
  },
  {
    id: '8',
    brand: BRAND,
    name: 'Kanjivaram Silk Bridal Fabric',
    description:
      'Pure mulberry silk woven with three-shuttle technique. Heavy, regal and known for its temple-border motifs.',
    price: 8400,
    mrp: 13499,
    photo: p(SOURCES.kanjivaram),
    photoGallery: [p(SOURCES.kanjivaram), p(SOURCES.kanjivaram2)],
    image: swatch('f8', '#0E5E6F', '#C5A059', '#F2EBDD', 'kanjivaram', 'Kanjivaram'),
    gallery: [
      swatch('f8a', '#0E5E6F', '#C5A059', '#F2EBDD', 'kanjivaram', 'Kanjivaram'),
      swatch('f8b', '#C9266B', '#C5A059', '#F2EBDD', 'kanjivaram', 'Kanjivaram')
    ],
    category: 'Fabrics',
    masterCategory: 'Fabrics',
    materialType: 'Silk',
    tags: ['Bridal', 'Temple Border', 'Mulberry'],
    sticker: 'Trending',
    colors: [
      { name: 'Peacock', hex: '#0E5E6F' },
      { name: 'Rani Pink', hex: '#C9266B' }
    ],
    stock: 30,
    weaveType: 'Three-shuttle',
    rating: 4.8,
    reviewCount: 96
  },
  {
    id: '9',
    brand: BRAND,
    name: 'Kalamkari Hand-Painted Cotton',
    description:
      'Hand-painted with natural dyes using bamboo pens. Each piece tells a story drawn from epics and folk traditions.',
    price: 1650,
    mrp: 2499,
    photo: p(SOURCES.kalamkari),
    photoGallery: [p(SOURCES.kalamkari), p(SOURCES.kalamkari2)],
    image: swatch('f9', '#9B3A2A', '#2A3F66', '#F2EBDD', 'kalamkari', 'Kalamkari'),
    gallery: [
      swatch('f9a', '#9B3A2A', '#2A3F66', '#F2EBDD', 'kalamkari', 'Kalamkari'),
      swatch('f9b', '#2A3F66', '#9B3A2A', '#F2EBDD', 'kalamkari', 'Kalamkari')
    ],
    category: 'Fabrics',
    masterCategory: 'Fabrics',
    materialType: 'Cotton',
    tags: ['Hand-painted', 'Natural Dyes', 'Story Cloth'],
    colors: [
      { name: 'Madder Red', hex: '#9B3A2A' },
      { name: 'Indigo', hex: '#2A3F66' }
    ],
    stock: 78,
    weaveType: 'Plain woven, hand-painted',
    rating: 4.7,
    reviewCount: 142
  },
  {
    id: '10',
    brand: BRAND,
    name: 'Italian Super-130s Merino Suiting',
    description:
      'Super-130s merino from Biella, Italy. The standard for bespoke suiting and winter couture.',
    price: 6200,
    mrp: 9499,
    photo: p(SOURCES.merino),
    photoGallery: [p(SOURCES.merino), p(SOURCES.merino2)],
    image: swatch('f10', '#0F1B2D', '#9A958A', '#C5A059', 'twill', 'Italian Merino'),
    gallery: [
      swatch('f10a', '#0F1B2D', '#9A958A', '#C5A059', 'twill', 'Italian Merino'),
      swatch('f10b', '#3A3A3A', '#9A958A', '#C5A059', 'twill', 'Italian Merino'),
      swatch('f10c', '#9A958A', '#3A3A3A', '#C5A059', 'twill', 'Italian Merino')
    ],
    category: 'Fabrics',
    masterCategory: 'Fabrics',
    materialType: 'Wool',
    tags: ['Suiting', 'Super 130s', 'Bespoke'],
    sticker: 'Bestseller',
    colors: [
      { name: 'Midnight', hex: '#0F1B2D' },
      { name: 'Charcoal', hex: '#3A3A3A' },
      { name: 'Stone', hex: '#9A958A' }
    ],
    stock: 96,
    weaveType: 'Twill',
    rating: 4.6,
    reviewCount: 58
  },
  {
    id: '11',
    brand: BRAND,
    name: 'Bandhani Tie-Dye Silk Fabric',
    description:
      'Each dot tied by hand before dyeing. A Gujarat craft that turns silk into a constellation of colour.',
    price: 3200,
    mrp: 4999,
    photo: p(SOURCES.bandhani),
    photoGallery: [p(SOURCES.bandhani), p(SOURCES.bandhani2)],
    image: swatch('f11', '#C8312B', '#D6A93B', '#F2EBDD', 'tie-dye', 'Bandhani'),
    gallery: [
      swatch('f11a', '#C8312B', '#D6A93B', '#F2EBDD', 'tie-dye', 'Bandhani'),
      swatch('f11b', '#D6A93B', '#C8312B', '#F2EBDD', 'tie-dye', 'Bandhani')
    ],
    category: 'Fabrics',
    masterCategory: 'Fabrics',
    materialType: 'Silk',
    tags: ['Tie-Dye', 'Festive', 'Hand-knotted'],
    sticker: 'Trending',
    colors: [
      { name: 'Vermilion', hex: '#C8312B' },
      { name: 'Mustard', hex: '#D6A93B' }
    ],
    stock: 44,
    weaveType: 'Resist-dyed plain weave',
    rating: 4.7,
    reviewCount: 109
  },
  {
    id: '12',
    brand: BRAND,
    name: 'Linen-Silk Modern Blend Fabric',
    description:
      'A modern blend: the crispness of linen with the lustre of silk. Elegant for shirts, drapes and saris alike.',
    price: 2950,
    mrp: 4499,
    photo: p(SOURCES.linenSilk),
    photoGallery: [p(SOURCES.linenSilk), p(SOURCES.linenSilk2)],
    image: swatch('f12', '#E7DFCF', '#A6B89A', '#C5A059', 'plain', 'Linen-Silk'),
    gallery: [
      swatch('f12a', '#E7DFCF', '#A6B89A', '#C5A059', 'plain', 'Linen-Silk'),
      swatch('f12b', '#A6B89A', '#E7DFCF', '#C5A059', 'plain', 'Linen-Silk')
    ],
    category: 'Fabrics',
    masterCategory: 'Fabrics',
    materialType: 'Mixed',
    tags: ['Blend', 'Drape', 'Versatile'],
    sticker: 'New In',
    colors: [
      { name: 'Bone', hex: '#E7DFCF' },
      { name: 'Sage', hex: '#A6B89A' }
    ],
    stock: 130,
    weaveType: 'Plain weave',
    rating: 4.5,
    reviewCount: 67
  },
  {
    id: '13',
    brand: BRAND,
    name: 'Pure Mulberry Silk — Undyed Greige',
    description:
      'A blank canvas of pure mulberry silk in its natural greige state. Ready for your dyer, your motif, your story. Soft, lustrous and uniformly woven for flawless dye uptake.',
    price: 1450,
    mrp: 2299,
    photo: p(SOURCES.linenSilk),
    image: swatch('f13', '#EFE7D2', '#D9CDB3', '#C5A059', 'plain', 'Undyed Mulberry Silk'),
    category: 'Dyeable Fabrics',
    masterCategory: 'Dyeable Fabrics',
    materialType: 'Silk',
    subCategory: 'Silk',
    tags: ['Undyed', 'Dye-Ready', 'Pure Silk'],
    sticker: 'New In',
    colors: [{ name: 'Greige', hex: '#EFE7D2' }],
    stock: 180,
    weaveType: 'Plain weave',
    rating: 4.6,
    reviewCount: 41
  },
  {
    id: '14',
    brand: BRAND,
    name: 'Cotton Mulmul — Bleached White',
    description:
      'Featherweight cotton mulmul, gently bleached and primed for your dye bath. Breathes like a whisper, drapes like air. The dyer\'s favourite ground cloth.',
    price: 480,
    mrp: 799,
    photo: p(SOURCES.kalamkari),
    image: swatch('f14', '#F7F2E8', '#EDE7DA', '#C5A059', 'plain', 'Cotton Mulmul'),
    category: 'Dyeable Fabrics',
    masterCategory: 'Dyeable Fabrics',
    materialType: 'Cotton',
    subCategory: 'Cotton',
    tags: ['Undyed', 'Featherlight', 'Dye-Ready'],
    colors: [{ name: 'Optic White', hex: '#F7F2E8' }],
    stock: 420,
    weaveType: 'Plain weave',
    rating: 4.4,
    reviewCount: 86
  },
  {
    id: '15',
    brand: BRAND,
    name: 'Raw Linen — Natural Flax',
    description:
      'Slubbed European flax linen in its undyed, unbleached state. Honey-toned warmth straight from the loom — accepts plant and acid dyes with depth and character.',
    price: 1180,
    mrp: 1899,
    photo: p(SOURCES.linen),
    image: swatch('f15', '#D9CDB3', '#B89F6E', '#7A7A4F', 'plain', 'Raw Linen'),
    category: 'Dyeable Fabrics',
    masterCategory: 'Dyeable Fabrics',
    materialType: 'Linen',
    subCategory: 'Linen',
    tags: ['Undyed', 'Natural Flax', 'Sustainable'],
    sticker: 'New In',
    colors: [{ name: 'Natural Flax', hex: '#D9CDB3' }],
    stock: 210,
    weaveType: 'Plain weave',
    rating: 4.5,
    reviewCount: 53
  },
  {
    id: '16',
    brand: BRAND,
    name: 'Banarasi Katan Silk Saree — Imperial Maroon',
    description:
      'Six and a half yards of hand-woven Banarasi katan silk, brocaded with kadhua zari florals. Pit-loom crafted in Varanasi over forty days. A bridal heirloom.',
    price: 38500,
    mrp: 54999,
    photo: p(SOURCES.banarasi),
    photoGallery: [p(SOURCES.banarasi), p(SOURCES.banarasi2), p(SOURCES.banarasi3)],
    image: swatch('f16', '#7A1F2C', '#C5A059', '#F2EBDD', 'brocade', 'Banarasi Saree'),
    category: 'Sarees',
    masterCategory: 'Sarees',
    materialType: 'Silk',
    subCategory: 'Banarasi',
    tags: ['Bridal', 'Pure Zari', 'Heirloom'],
    sticker: 'Bestseller',
    colors: [{ name: 'Imperial Maroon', hex: '#7A1F2C' }],
    stock: 6,
    weaveType: 'Kadhua Brocade',
    rating: 4.9,
    reviewCount: 73
  },
  {
    id: '17',
    brand: BRAND,
    name: 'Kanjivaram Silk Saree — Peacock Temple Border',
    description:
      'Three-shuttle Kanjivaram silk with korvai temple borders and a contrast pallu. Heavyweight, regal and finished with hand-tied jasdi.',
    price: 24500,
    mrp: 36999,
    photo: p(SOURCES.kanjivaram),
    photoGallery: [p(SOURCES.kanjivaram), p(SOURCES.kanjivaram2)],
    image: swatch('f17', '#0E5E6F', '#C5A059', '#F2EBDD', 'kanjivaram', 'Kanjivaram Saree'),
    category: 'Sarees',
    masterCategory: 'Sarees',
    materialType: 'Silk',
    subCategory: 'Kanjivaram',
    tags: ['Temple Border', 'Korvai', 'South Indian'],
    sticker: 'Trending',
    colors: [{ name: 'Peacock', hex: '#0E5E6F' }],
    stock: 9,
    weaveType: 'Three-shuttle Korvai',
    rating: 4.8,
    reviewCount: 58
  },
  {
    id: '18',
    brand: BRAND,
    name: 'Patola Silk Saree — Crimson Geometry',
    description:
      'Single-ikat Rajkot Patola in vermilion and indigo. Geometric parrots and elephants march along the pallu — a Gujarati legacy distilled into a single drape.',
    price: 42000,
    mrp: 59999,
    photo: p(SOURCES.patola),
    photoGallery: [p(SOURCES.patola), p(SOURCES.patola2)],
    image: swatch('f18', '#9B1B30', '#1E3A8A', '#F2EBDD', 'ikat', 'Patola Saree'),
    category: 'Sarees',
    masterCategory: 'Sarees',
    materialType: 'Silk',
    subCategory: 'Patola',
    tags: ['Single Ikat', 'Heritage', 'Festive'],
    sticker: 'Limited',
    colors: [{ name: 'Crimson', hex: '#9B1B30' }],
    stock: 4,
    weaveType: 'Single Ikat',
    rating: 4.9,
    reviewCount: 31
  },
  {
    id: '19',
    brand: BRAND,
    name: 'Half Saree Set — Powder Pink Chanderi',
    description:
      'A three-piece langa-voni in featherlight Chanderi silk-cotton: pleated lehenga, fitted blouse and four-yard dupatta. A coming-of-age silhouette reimagined for today.',
    price: 8900,
    mrp: 13999,
    photo: p(SOURCES.jamdani),
    image: swatch('f19', '#E8C7C8', '#C5A059', '#F2EBDD', 'plain', 'Half Saree'),
    category: 'Sarees',
    masterCategory: 'Sarees',
    materialType: 'Mixed',
    subCategory: 'Half Sarees',
    tags: ['Langa Voni', 'Three-Piece', 'Festive'],
    sticker: 'New In',
    colors: [{ name: 'Powder Pink', hex: '#E8C7C8' }],
    stock: 12,
    weaveType: 'Chanderi plain weave',
    rating: 4.6,
    reviewCount: 27
  },
  {
    id: '20',
    brand: BRAND,
    name: 'Bandhani Gharchola Saree — Vermilion & Gold',
    description:
      'A Gujarati bridal classic: silk grid of zari checks dotted with hand-tied bandhani. Worn by Gujarati and Marwari brides for generations.',
    price: 3800,
    mrp: 5999,
    photo: p(SOURCES.bandhani),
    photoGallery: [p(SOURCES.bandhani), p(SOURCES.bandhani2)],
    image: swatch('f20', '#C8312B', '#D6A93B', '#F2EBDD', 'tie-dye', 'Bandhani Gharchola'),
    category: 'Sarees',
    masterCategory: 'Sarees',
    materialType: 'Silk',
    subCategory: 'Bandhani',
    tags: ['Gharchola', 'Bridal', 'Hand-knotted'],
    sticker: 'Trending',
    colors: [{ name: 'Vermilion', hex: '#C8312B' }],
    stock: 14,
    weaveType: 'Resist-dyed silk',
    rating: 4.7,
    reviewCount: 64
  },
  {
    id: '21',
    brand: BRAND,
    name: 'Bridal Lehenga — Banarasi Tissue & Pearl',
    description:
      'A nine-kali bridal lehenga in tissue Banarasi silk, hand-embroidered with seed pearls and zardozi. Includes choli and four-yard tissue dupatta. Made-to-measure in four weeks.',
    price: 165000,
    mrp: 229999,
    photo: p(SOURCES.banarasi),
    photoGallery: [p(SOURCES.banarasi), p(SOURCES.banarasi2)],
    image: swatch('f21', '#7A1F2C', '#C5A059', '#F2EBDD', 'brocade', 'Bridal Lehenga'),
    category: 'Lehenga Cholis',
    masterCategory: 'Lehenga Cholis',
    materialType: 'Silk',
    subCategory: 'Bridal',
    tags: ['Bridal', 'Zardozi', 'Made-to-Measure'],
    sticker: 'Limited',
    colors: [{ name: 'Imperial Maroon', hex: '#7A1F2C' }],
    stock: 3,
    weaveType: 'Tissue Banarasi with hand embroidery',
    rating: 5.0,
    reviewCount: 18
  },
  {
    id: '22',
    brand: BRAND,
    name: 'Festive Lehenga — Peacock Kanjivaram',
    description:
      'A flared Kanjivaram silk lehenga with korvai border, paired with a hand-stitched choli and tissue dupatta. Sangeet, mehendi and reception-ready.',
    price: 78500,
    mrp: 109999,
    photo: p(SOURCES.kanjivaram),
    photoGallery: [p(SOURCES.kanjivaram), p(SOURCES.kanjivaram2)],
    image: swatch('f22', '#0E5E6F', '#C5A059', '#F2EBDD', 'kanjivaram', 'Festive Lehenga'),
    category: 'Lehenga Cholis',
    masterCategory: 'Lehenga Cholis',
    materialType: 'Silk',
    subCategory: 'Festive',
    tags: ['Sangeet', 'Korvai', 'Silk'],
    sticker: 'Trending',
    colors: [{ name: 'Peacock', hex: '#0E5E6F' }],
    stock: 5,
    weaveType: 'Three-shuttle silk',
    rating: 4.8,
    reviewCount: 26
  },
  {
    id: '23',
    brand: BRAND,
    name: 'Contemporary Lehenga — Ivory Chanderi & Sequin',
    description:
      'A pared-back lehenga in ivory Chanderi with hand-applied sequin scatter. Crop blouse with cami straps and a single-shaded organza dupatta. For the modern minimalist bride.',
    price: 42500,
    mrp: 59999,
    photo: p(SOURCES.chanderi),
    photoGallery: [p(SOURCES.chanderi), p(SOURCES.chanderi2)],
    image: swatch('f23', '#F2EBDD', '#C5A059', '#E5D3A8', 'plain', 'Ivory Lehenga'),
    category: 'Lehenga Cholis',
    masterCategory: 'Lehenga Cholis',
    materialType: 'Mixed',
    subCategory: 'Contemporary',
    tags: ['Minimalist', 'Sequin', 'Cocktail'],
    sticker: 'New In',
    colors: [{ name: 'Ivory', hex: '#F2EBDD' }],
    stock: 7,
    weaveType: 'Chanderi with hand sequin work',
    rating: 4.7,
    reviewCount: 22
  },
  {
    id: '24',
    brand: BRAND,
    name: 'Reception Lehenga — Emerald Velvet & Zari',
    description:
      'A heavyweight velvet lehenga in deep emerald with raised zardozi vines and a tissue lining. Sweeping kalis for a dramatic spin under the lights.',
    price: 98500,
    mrp: 139999,
    photo: p(SOURCES.patola),
    image: swatch('f24', '#1F5D4F', '#C5A059', '#F2EBDD', 'brocade', 'Velvet Lehenga'),
    category: 'Lehenga Cholis',
    masterCategory: 'Lehenga Cholis',
    materialType: 'Silk',
    subCategory: 'Bridal',
    tags: ['Velvet', 'Zardozi', 'Reception'],
    sticker: 'Bestseller',
    colors: [{ name: 'Emerald', hex: '#1F5D4F' }],
    stock: 4,
    weaveType: 'Velvet with raised zardozi',
    rating: 4.9,
    reviewCount: 19
  },
  {
    id: '25',
    brand: BRAND,
    name: 'Floor-Length Anarkali — Blush Georgette',
    description:
      'A sweeping floor-length Anarkali in blush georgette with mirror-and-thread chikankari across the bodice. Cinched waist, churidar sleeves, scalloped hem.',
    price: 28500,
    mrp: 41999,
    photo: p(SOURCES.jamdani),
    image: swatch('f25', '#E8C7C8', '#C5A059', '#F2EBDD', 'plain', 'Anarkali'),
    category: 'Anarkalis',
    masterCategory: 'Anarkalis',
    materialType: 'Mixed',
    subCategory: 'Floor-length',
    tags: ['Chikankari', 'Floor-length', 'Festive'],
    sticker: 'Bestseller',
    colors: [{ name: 'Blush', hex: '#E8C7C8' }],
    stock: 8,
    weaveType: 'Georgette with chikankari',
    rating: 4.8,
    reviewCount: 44
  },
  {
    id: '26',
    brand: BRAND,
    name: 'Knee-Length Anarkali — Saffron Cotton',
    description:
      'A breezy knee-length Anarkali in handloom cotton with block-printed kalamkari panels. Pair with a churidar or palazzos for daywear ease.',
    price: 9800,
    mrp: 14999,
    photo: p(SOURCES.mashru),
    image: swatch('f26', '#E2A33A', '#7A1F2C', '#F2EBDD', 'kalamkari', 'Cotton Anarkali'),
    category: 'Anarkalis',
    masterCategory: 'Anarkalis',
    materialType: 'Cotton',
    subCategory: 'Knee-length',
    tags: ['Block Print', 'Daywear', 'Handloom'],
    sticker: 'New In',
    colors: [{ name: 'Saffron', hex: '#E2A33A' }],
    stock: 16,
    weaveType: 'Cotton with kalamkari print',
    rating: 4.5,
    reviewCount: 38
  },
  {
    id: '27',
    brand: BRAND,
    name: 'Embroidered Anarkali — Indigo Mashru',
    description:
      'A floor-grazing Anarkali in Mashru satin, embellished with resham vine work and gota-patti detailing along the placket. Sangeet-ready and unforgettable.',
    price: 32500,
    mrp: 47999,
    photo: p(SOURCES.banarasi),
    image: swatch('f27', '#2A3F66', '#C5A059', '#F2EBDD', 'satin', 'Embroidered Anarkali'),
    category: 'Anarkalis',
    masterCategory: 'Anarkalis',
    materialType: 'Satin',
    subCategory: 'Embroidered',
    tags: ['Gota Patti', 'Embroidered', 'Sangeet'],
    sticker: 'Trending',
    colors: [{ name: 'Indigo', hex: '#2A3F66' }],
    stock: 6,
    weaveType: 'Mashru with hand embroidery',
    rating: 4.7,
    reviewCount: 29
  },
  {
    id: '28',
    brand: BRAND,
    name: 'Slip Dress — Bias-Cut Silk-Satin',
    description:
      'A whisper-thin bias-cut slip in Mashru silk-satin. Cowl neckline, spaghetti straps, hem grazing the ankle. East-meets-West in one fluid line.',
    price: 8900,
    mrp: 13499,
    photo: p(SOURCES.mashru),
    image: swatch('f28', '#7A1F2C', '#E2A33A', '#F2EBDD', 'satin', 'Slip Dress'),
    category: 'Western Wear',
    masterCategory: 'Western Wear',
    materialType: 'Satin',
    subCategory: 'Dresses',
    tags: ['Bias Cut', 'Cocktail', 'Silk'],
    sticker: 'New In',
    colors: [{ name: 'Wine', hex: '#7A1F2C' }],
    stock: 18,
    weaveType: 'Mashru silk-satin',
    rating: 4.6,
    reviewCount: 34
  },
  {
    id: '29',
    brand: BRAND,
    name: 'Linen Co-ord Set — Oat Stone',
    description:
      'A relaxed two-piece in Belgian linen: oversized camp shirt and high-waist wide-leg trouser. Throw on, walk out.',
    price: 4800,
    mrp: 7499,
    photo: p(SOURCES.linen),
    image: swatch('f29', '#D9CDB3', '#7A7A4F', '#F2EBDD', 'plain', 'Linen Co-ord'),
    category: 'Western Wear',
    masterCategory: 'Western Wear',
    materialType: 'Linen',
    subCategory: 'Co-ords',
    tags: ['Co-ord', 'Resort', 'Linen'],
    sticker: 'New In',
    colors: [{ name: 'Oat', hex: '#D9CDB3' }],
    stock: 22,
    weaveType: 'Belgian linen',
    rating: 4.5,
    reviewCount: 51
  },
  {
    id: '30',
    brand: BRAND,
    name: 'Jumpsuit — Kalamkari Cotton Wide-Leg',
    description:
      'A sleeveless V-neck jumpsuit in hand-painted kalamkari cotton with a self-tie waist and wide cropped leg. A travel-ready statement.',
    price: 6500,
    mrp: 9999,
    photo: p(SOURCES.kalamkari),
    image: swatch('f30', '#9B3A2A', '#2A3F66', '#F2EBDD', 'kalamkari', 'Kalamkari Jumpsuit'),
    category: 'Western Wear',
    masterCategory: 'Western Wear',
    materialType: 'Cotton',
    subCategory: 'Jumpsuits',
    tags: ['Jumpsuit', 'Hand-painted', 'Resort'],
    sticker: 'Trending',
    colors: [{ name: 'Madder Red', hex: '#9B3A2A' }],
    stock: 14,
    weaveType: 'Cotton with kalamkari',
    rating: 4.6,
    reviewCount: 33
  },
  {
    id: '31',
    brand: BRAND,
    name: 'Wrap Blouse — Bandhani Silk',
    description:
      'A fluid bandhani silk wrap blouse with kimono sleeves and a tasselled tie. Pairs as easily with jeans as with a lehenga skirt.',
    price: 3200,
    mrp: 4999,
    photo: p(SOURCES.bandhani),
    image: swatch('f31', '#C8312B', '#D6A93B', '#F2EBDD', 'tie-dye', 'Bandhani Top'),
    category: 'Western Wear',
    masterCategory: 'Western Wear',
    materialType: 'Silk',
    subCategory: 'Tops',
    tags: ['Wrap', 'Fusion', 'Bandhani'],
    sticker: 'New In',
    colors: [{ name: 'Vermilion', hex: '#C8312B' }],
    stock: 24,
    weaveType: 'Bandhani silk',
    rating: 4.4,
    reviewCount: 28
  },
  {
    id: '32',
    brand: BRAND,
    name: 'Couture Gown — Hand-Embroidered Patola Tulle',
    description:
      'A signed couture gown: ivory French tulle base, embroidered with miniature Patola motifs in silk floss, sequin and bugle bead. Two-hundred-hour atelier piece, single edition.',
    price: 385000,
    mrp: 549999,
    photo: p(SOURCES.patola),
    photoGallery: [p(SOURCES.patola), p(SOURCES.patola2)],
    image: swatch('f32', '#F2EBDD', '#9B1B30', '#C5A059', 'ikat', 'Couture Gown'),
    category: 'Studios Prêt',
    masterCategory: 'Studios Prêt',
    materialType: 'Silk',
    subCategory: 'Atelier Edits',
    tags: ['One-of-One', 'Atelier', 'Red Carpet'],
    sticker: 'Limited',
    colors: [{ name: 'Ivory', hex: '#F2EBDD' }],
    stock: 1,
    weaveType: 'French tulle with hand embroidery',
    rating: 5.0,
    reviewCount: 8
  },
  {
    id: '33',
    brand: BRAND,
    name: 'Limited Edition Sherwani — Real Zari Banarasi',
    description:
      'A ten-piece numbered run: hand-tailored sherwani in real silver-and-gold Banarasi zari brocade, finished with mother-of-pearl buttons and a hand-rolled silk lapel.',
    price: 185000,
    mrp: 259999,
    photo: p(SOURCES.banarasi),
    photoGallery: [p(SOURCES.banarasi), p(SOURCES.banarasi3)],
    image: swatch('f33', '#7A1F2C', '#C5A059', '#F2EBDD', 'brocade', 'Sherwani'),
    category: 'Studios Prêt',
    masterCategory: 'Studios Prêt',
    materialType: 'Silk',
    subCategory: 'Capsule Drops',
    tags: ['Sherwani', 'Real Zari', 'Numbered Edition'],
    sticker: 'Limited',
    colors: [{ name: 'Imperial Maroon', hex: '#7A1F2C' }],
    stock: 2,
    weaveType: 'Pure zari brocade',
    rating: 4.9,
    reviewCount: 12
  },
  {
    id: '34',
    brand: BRAND,
    name: 'Made-to-Measure Cape Gown — Kanjivaram Drape',
    description:
      'A drape cape gown cut from a single Kanjivaram silk panel, made to your measurements over six weeks. Asymmetric pallu over the shoulder, fluted hem at the ankle.',
    price: 92000,
    mrp: 134999,
    photo: p(SOURCES.kanjivaram),
    image: swatch('f34', '#0E5E6F', '#C5A059', '#F2EBDD', 'kanjivaram', 'Cape Gown'),
    category: 'Studios Prêt',
    masterCategory: 'Studios Prêt',
    materialType: 'Silk',
    subCategory: 'Ready-to-Wear',
    tags: ['Bespoke', 'Drape', 'Silk'],
    sticker: 'Bestseller',
    colors: [{ name: 'Peacock', hex: '#0E5E6F' }],
    stock: 3,
    weaveType: 'Kanjivaram silk',
    rating: 4.9,
    reviewCount: 14
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
    coverImage: swatch('chero', '#7A1F2C', '#C5A059', '#F2EBDD', 'brocade', 'The Lost Loom'),
    items: FABRICS.filter(f => f.materialType === 'Silk' || f.materialType === 'Satin')
  },
  {
    id: 'ethereal',
    name: 'Aether',
    subtitle: 'Light & Legacy',
    description:
      'Focusing on the fine muslins and translucent weaves that defined elegance in a bygone era.',
    coverPhoto: p(SOURCES.aether, 1400, 800),
    coverImage: swatch('caether', '#EDE7DA', '#C5A059', '#7A7A4F', 'jamdani', 'Aether'),
    items: FABRICS.filter(f => f.materialType === 'Cotton' || f.materialType === 'Linen')
  }
];

export const HERO_PHOTO = p(SOURCES.hero, 1600, 1800);
export const HERO_IMAGE = swatch(
  'hero',
  '#7A1F2C',
  '#C5A059',
  '#F2EBDD',
  'brocade',
  'Varanasi Gold');

export const TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    name: 'Ananya Sharma',
    role: 'Fashion Designer',
    content:
      'The quality of silk from Tresor Couture is unparalleled. My bridal collection owes its success to these exquisite fabrics.',
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

/**
 * Fabric material types (informational — not product categories).
 * Used for material-type filtering inside the "Fabrics" master category.
 */
export const MATERIAL_TYPES = ['Silk', 'Cotton', 'Wool', 'Linen', 'Satin', 'Mixed'];

/**
 * The top-level catalogue sections, in the order a designer chose. These drive
 * the admin category dropdowns, the navbar mega-menu, the home-page
 * CategoryStrip, the mobile drawer and the shop filter UI.
 *
 * Adding one: see "Adding a category" in docs/ops/BULK-IMPORT.md. It reaches the
 * admin dropdowns at once and the shopper's menus on the day its first live
 * product exists — `masterCategoriesFor()` (lib/subcategories.ts) hides a
 * section with nothing in it, because that is a menu link landing on an empty
 * page. No Firestore rules change is needed; the rules require the field to be
 * present and say nothing about its value.
 */
export const MASTER_CATEGORIES: MasterCategory[] = [
  'Fabrics',
  'Dyeable Fabrics',
  'Laces',
  'Sarees',
  'One Minute Saree',
  'Half Saree',
  'Lehenga Cholis',
  'Langha Jacket',
  'Anarkalis',
  'Gown',
  'Three Piece Set',
  'Ethnic Wear',
  'Masakhali',
  'Western Wear',
  'Studios Prêt'
];

/**
 * The admin form's category dropdown. Was a second copy of the list above, which
 * meant adding a category twice or having the two disagree; it is the same array
 * now, kept only because plenty of code imports this name.
 */
export const CATEGORIES = MASTER_CATEGORIES;

/**
 * Hierarchical taxonomy: each master category may have sub-categories that
 * surface as a second-tier filter (Half Sarees under Sarees, weave types
 * under Fabrics, etc.).
 */
/**
 * The curated subcategory vocabulary: what the admin dropdown offers, and the
 * order those names appear in when they have stock.
 *
 * It is NOT the navigation menu. Shopper-facing menus are derived from the
 * catalogue by `subcategoriesFor()` (src/lib/subcategories.ts) so a name with
 * no products is never offered and a name the catalogue invented is never
 * hidden. Adding an aspirational entry here is therefore free — it surfaces the
 * day the first product uses it.
 */
export const MASTER_CATEGORY_TREE: Record<MasterCategory, string[]> = {
  Fabrics: ['Silk', 'Cotton', 'Wool', 'Linen', 'Satin', 'Mixed'],
  'Dyeable Fabrics': ['Cotton', 'Silk', 'Linen', 'Mixed'],
  Laces: ['Trim & Edging', 'Patch'],
  Sarees: ['Half Sarees', 'Banarasi', 'Kanjivaram', 'Patola', 'Bandhani', 'Jamdani', 'Mashru', 'Pre-draped Saree'],
  'One Minute Saree': ['Ready-pleated', 'Lycra', 'Georgette', 'Satin', 'Embellished'],
  'Half Saree': ['Langa Voni', 'Traditional', 'Contemporary', 'Bridal'],
  'Lehenga Cholis': ['Bridal', 'Festive', 'Contemporary', 'Zardozi Floral', 'Threadwork', 'Pearl Strand', 'Ivory Heritage'],
  'Langha Jacket': ['Long Jacket', 'Short Jacket', 'Cape', 'Shrug'],
  Anarkalis: ['Floor-length', 'Knee-length', 'Embroidered'],
  Gown: ['Anarkali Gown', 'Indo-Western', 'Evening', 'Reception'],
  'Three Piece Set': ['Kurta Pant Dupatta', 'Top Skirt Dupatta', 'Co-ord Set', 'Festive', 'Everyday'],
  'Ethnic Wear': ['Kurta Sets', 'Salwar Suits', 'Sharara Sets', 'Palazzo Sets', 'Ethnic Gowns', 'Indo-Western', 'Dupattas'],
  // Deliberately empty: Masakhali is a name, not a shape, so there is no
  // vocabulary to curate yet. Subcategories typed against it still reach the
  // menus — subcategoriesFor derives those from the catalogue — and the
  // designer's preferred ORDER can be filled in here once there is one.
  Masakhali: [],
  'Western Wear': ['Dresses', 'Tops', 'Co-ords', 'Jumpsuits'],
  'Studios Prêt': ['Ready-to-Wear', 'Capsule Drops', 'Atelier Edits']
};

/** Tile metadata for the home-page CategoryStrip and navbar mega-menu. */
export const MASTER_CATEGORY_TILES: { name: MasterCategory; color: string; tagline: string }[] = [
  { name: 'Dyeable Fabrics',  color: '#F2E4C4', tagline: 'Ready for your palette' },
  { name: 'Laces',            color: '#EDE4D2', tagline: 'Hand-knotted trims & edging' },
  { name: 'Sarees',           color: '#C9A267', tagline: 'Six yards of heritage' },
  { name: 'Lehenga Cholis',   color: '#D9B26B', tagline: 'For the aisle and after' },
  { name: 'One Minute Saree', color: '#E6CBB2', tagline: 'Pre-draped, on in a minute' },
  { name: 'Half Saree',       color: '#D9C48F', tagline: 'Langa voni for the ceremony' },
  { name: 'Langha Jacket',    color: '#CBB79A', tagline: 'Jackets and capes over the lehenga' },
  { name: 'Anarkalis',        color: '#E0BFA0', tagline: 'Royal silhouettes, modern cuts' },
  { name: 'Gown',             color: '#E3C9C0', tagline: 'Floor-sweeping silhouettes' },
  { name: 'Three Piece Set',  color: '#DED0B6', tagline: 'Kurta, bottom and dupatta together' },
  { name: 'Ethnic Wear',      color: '#D8C3A5', tagline: 'Kurta sets, suits and dupattas' },
  { name: 'Masakhali',        color: '#C7A87C', tagline: 'The Masakhali edit' },
  { name: 'Western Wear',     color: '#CBC0A7', tagline: 'East-West edit' },
  { name: 'Studios Prêt',     color: '#B8915A', tagline: 'Ready-to-wear, off the atelier rail' }
];

export const SHIPPING_FLAT_RATE = 99;
export const FREE_SHIPPING_THRESHOLD = 1999;
export const TAX_RATE = 0.05;

export const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(n);

export const discountPct = (price: number, mrp: number): number =>
  mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

/* Marketing banners for the hero carousel. */
export interface HeroBanner {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaCategory?: string;
  bg: string;
  accent: string;
  photo: string;
  fallback: string;
}

export const HERO_BANNERS: HeroBanner[] = [
  {
    id: 'bridal',
    eyebrow: 'WEDDING EDIT · LIVE NOW',
    title: 'Heritage Bridal Silks',
    subtitle: 'Banarasi · Kanjivaram · Patola · Bandhani — six families of weavers, one atelier.',
    ctaLabel: 'Shop Bridal',
    ctaCategory: 'Sarees',
    bg: 'linear-gradient(135deg,#FBF5EB 0%,#F2E4C4 55%,#E5C97A 100%)',
    accent: '#B8915A',
    photo: p(SOURCES.banarasi, 1400, 1000),
    fallback: FABRICS[1].image
  },
  {
    id: 'summer',
    eyebrow: 'SUMMER LIGHTWEIGHTS',
    title: 'Cottons & Linens for the Season',
    subtitle: 'Jamdani muslin, Belgian linen and Kalamkari — breathe easy in heritage weaves.',
    ctaLabel: 'Shop Summer',
    ctaCategory: 'Fabrics',
    bg: 'linear-gradient(135deg,#FBF6EE 0%,#F0E2C5 55%,#D9C28B 100%)',
    accent: '#A07840',
    photo: p(SOURCES.linen, 1400, 1000),
    fallback: FABRICS[6].image
  },
  {
    id: 'winter',
    eyebrow: 'WARM ESSENTIALS',
    title: 'Pashmina & Merino · From the Mountains',
    subtitle: 'Hand-spun cashmere from Ladakh and Super-130s wool from Biella.',
    ctaLabel: 'Shop Wool',
    ctaCategory: 'Fabrics',
    bg: 'linear-gradient(135deg,#F5EFE2 0%,#E5D9BC 55%,#B89F6E 100%)',
    accent: '#6B5A2E',
    photo: p(SOURCES.pashmina, 1400, 1000),
    fallback: FABRICS[5].image
  }
];

/* Pill categories rendered as circular tiles on home. */
export const CATEGORY_TILES: { name: string; category: string; color: string }[] = [
  { name: 'Silks', category: 'Silk', color: '#E5C97A' },
  { name: 'Cottons', category: 'Cotton', color: '#F2E4C4' },
  { name: 'Wool', category: 'Wool', color: '#D8C8AE' },
  { name: 'Linen', category: 'Linen', color: '#D9CDB3' },
  { name: 'Satin', category: 'Satin', color: '#EDDDB6' },
  { name: 'Mixed', category: 'Mixed', color: '#C9C09C' },
  { name: 'Bridal', category: 'Silk', color: '#C9A267' },
  { name: 'Sale', category: 'All', color: '#B8915A' }
];

/* Offer ticker — looks like Myntra's sticky deals strip. */
export const OFFER_TICKER: string[] = [
  'FREE SHIPPING ON ORDERS ABOVE ₹1,999',
  'HAND-CUT IN INDIA · SHIPPED WORLDWIDE',
  'HERITAGE CRAFTSMANSHIP · MODERN ELEGANCE'
];
