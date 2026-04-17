import { Fabric, Collection, Testimonial } from './types';

export const FABRICS: Fabric[] = [
  {
    id: '1',
    name: 'Mashru Silk-Satin',
    description: 'A "permitted" fabric where silk never touches the skin. Rescuing the last 4 families of Mandvi weavers keeping this craft alive.',
    pricePerMeter: 4500,
    image: 'https://images.unsplash.com/photo-1620164233772-246d88ff7536?auto=format&fit=crop&q=80&w=800',
    category: 'Satin',
    origin: 'Mandvi, Gujarat',
    tags: ['Endangered', 'Handloom', 'Heritage']
  },
  {
    id: '2',
    name: 'Real Zari Banarasi',
    description: 'Woven with authentic silver and gold wires. We are fighting to restore this art against the rise of cheap metallic substitutes.',
    pricePerMeter: 12500,
    image: 'https://images.unsplash.com/photo-1610406534231-0701fd0326c4?auto=format&fit=crop&q=80&w=800',
    category: 'Silk',
    origin: 'Varanasi',
    tags: ['Royal Heritage', 'Silver Thread', 'Authentic']
  },
  {
    id: '3',
    name: 'Patan Patola',
    description: 'The "King of Textiles". A double-ikkat weave so complex it takes mathematicians and master weavers 6 months to finish one sari.',
    pricePerMeter: 28000,
    image: 'https://images.unsplash.com/photo-1590736910113-f9630613914b?auto=format&fit=crop&q=80&w=800',
    category: 'Silk',
    origin: 'Patan, Gujarat',
    tags: ['Rarest', 'Double Ikkat', 'Museum Grade']
  },
  {
    id: '4',
    name: 'Dhakai Jamdani Muslin',
    description: 'The "Ghost Fabric". Recreating the translucent, 300-count cotton weave that was once the pride of the Mughal courts.',
    pricePerMeter: 3800,
    image: 'https://images.unsplash.com/photo-1589363360147-442ca02cc047?auto=format&fit=crop&q=80&w=1200',
    category: 'Cotton',
    origin: 'West Bengal',
    tags: ['Ethereal', 'Ancient Craft', 'Hand-spun']
  }
];

export const COLLECTIONS: Collection[] = [
  {
    id: 'heritage',
    name: 'The Lost Loom',
    subtitle: 'Revival Series 01',
    description: 'A dedicated initiative to rescue and restore weaving techniques that are on the brink of extinction.',
    coverImage: 'https://images.unsplash.com/photo-1574169208538-4f45163a14e6?auto=format&fit=crop&q=80&w=1200',
    items: FABRICS.filter(f => f.category === 'Silk' || f.category === 'Satin')
  },
  {
    id: 'ethereal',
    name: 'Aether',
    subtitle: 'Light & Legacy',
    description: 'Focusing on the fine muslins and translucent weaves that defined elegance in a bygone era.',
    coverImage: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&q=80&w=1200',
    items: FABRICS.filter(f => f.category === 'Cotton' || f.category === 'Linen')
  }
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    name: 'Ananya Sharma',
    role: 'Fashion Designer',
    content: 'The quality of silk from Trésor Couture is unparalleled. My bridal collection owes its success to these exquisite fabrics.',
    avatar: 'https://i.pravatar.cc/150?u=ananya'
  },
  {
    id: '2',
    name: 'Vikram Mehta',
    role: 'Bespoke Tailor',
    content: 'Their Italian wool is a dream to work with. The drape and finish are exactly what luxury tailoring requires.',
    avatar: 'https://i.pravatar.cc/150?u=vikram'
  }
];
