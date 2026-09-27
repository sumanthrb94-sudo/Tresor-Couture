import fs from 'node:fs';
import path from 'node:path';
import { FieldValue } from 'firebase-admin/firestore';
import { initAdmin } from './lib/admin';

const { db, prod, projectId } = initAdmin();

export interface PatchProduct {
  id: string;
  styleCode: string;
  colourName: string;
  hex: string;
  name: string;
  description: string;
  tags: string[];
  unitType: 'unit';
  unit: 'piece';
  price: number;
  mrp: number;
  materialType: string;
  stock: number;
  photo: string;
  photoGallery: string[];
}

const PATCH_PRODUCTS: PatchProduct[] = [
  {
    id: 'PT800-01',
    styleCode: 'TC-PT800',
    colourName: 'Antique Gold',
    hex: '#C4A058',
    name: 'Antique Gold Zardozi & Pearl Gala Bodice Yoke Patch',
    description: 'Ornate handcrafted bodice gala patch on sheer net base, embellished with antique gold zardozi wirework, bugle beads, and a fine seed-pearl fringe border. Sold per piece at ₹800 (Only 1 in stock).',
    tags: ['Lace', 'Patch', 'Neckline', 'Gala', 'Zardozi', 'Antique Gold', 'Pearls', '1 in Stock', 'Couture'],
    unitType: 'unit',
    unit: 'piece',
    price: 800,
    mrp: 1299,
    materialType: 'Handcrafted Antique Gold Zardozi, Cultured Pearls & Bugle Beads',
    stock: 1,
    photo: '/products/lace/PT800-01.jpg',
    photoGallery: ['/products/lace/PT800-01.jpg']
  },
  {
    id: 'PT800-02',
    styleCode: 'TC-PT800',
    colourName: 'Rani Magenta & Sage',
    hex: '#A81B5E',
    name: 'Rani Magenta & Sage Floral Beaded Neckline Collar Patch',
    description: 'Exquisite scalloped V-neckline collar patch intricately embroidered with vibrant rani magenta and sage green floral bouquets, silver sequins, cultured pearls, and cutdana beads. Includes overview and close-up detail photos. Sold per piece at ₹800 (Only 1 in stock).',
    tags: ['Lace', 'Patch', 'Neckline', 'Collar', 'Floral', 'Rani Magenta', 'Sage Green', '1 in Stock', 'Couture'],
    unitType: 'unit',
    unit: 'piece',
    price: 800,
    mrp: 1299,
    materialType: 'Handcrafted Glass Cutdana, Sequins, Pearls & Silk Threadwork',
    stock: 1,
    photo: '/products/lace/PT800-02.jpg',
    photoGallery: ['/products/lace/PT800-02.jpg', '/products/lace/PT800-02-detail.jpg']
  },
  {
    id: 'PT800-03',
    styleCode: 'TC-PT800',
    colourName: 'Pastel Rainbow Sorbet',
    hex: '#E2C29B',
    name: 'Pastel Rainbow Sorbet Floral Beaded Neckline Collar Patch',
    description: 'Whimsical pastel rainbow sorbet V-neck collar patch featuring floral sprays in powder blue, baby pink, sunny lemon, and mint green, heavily frosted with seed pearls and micro-beads. Sold per piece at ₹800 (Only 1 in stock).',
    tags: ['Lace', 'Patch', 'Neckline', 'Collar', 'Floral', 'Pastel Rainbow', 'Sorbet', '1 in Stock', 'Festive'],
    unitType: 'unit',
    unit: 'piece',
    price: 800,
    mrp: 1299,
    materialType: 'Handcrafted Pastel Seed Beads, Cutdana & Crystal Flowers',
    stock: 1,
    photo: '/products/lace/PT800-03.jpg',
    photoGallery: ['/products/lace/PT800-03.jpg']
  },
  {
    id: 'PT800-04',
    styleCode: 'TC-PT800',
    colourName: 'Ivory Bridal White',
    hex: '#F4EFE6',
    name: 'Ivory Bridal Pearl & Crystal Floral Neckline Collar Patch',
    description: 'Tone-on-tone pure bridal ivory white scalloped collar patch lavishly hand-worked with cultured seed pearls, translucent sequins, and sparkling crystal cutdana florets. Sold per piece at ₹800 (Only 1 in stock).',
    tags: ['Lace', 'Patch', 'Neckline', 'Collar', 'Floral', 'Ivory White', 'Pearls', 'Bridal', '1 in Stock'],
    unitType: 'unit',
    unit: 'piece',
    price: 800,
    mrp: 1299,
    materialType: 'Handcrafted Bridal Ivory Pearls, Micro-Sequins & Crystal Cutdana',
    stock: 1,
    photo: '/products/lace/PT800-04.jpg',
    photoGallery: ['/products/lace/PT800-04.jpg']
  },
  {
    id: 'PT800-05',
    styleCode: 'TC-PT800',
    colourName: 'Midnight Black',
    hex: '#1A1A1A',
    name: 'Midnight Black Cutdana & Sequin Floral Neckline Collar Patch',
    description: 'Dramatic couture midnight black collar patch embroidered with glossy black glass cutdana, shimmering night-sky sequins, and faceted micro-beads on sheer tulle. Sold per piece at ₹800 (Only 1 in stock).',
    tags: ['Lace', 'Patch', 'Neckline', 'Collar', 'Floral', 'Midnight Black', 'Cutdana', '1 in Stock', 'Statement'],
    unitType: 'unit',
    unit: 'piece',
    price: 800,
    mrp: 1299,
    materialType: 'Handcrafted Glossy Black Jet Cutdana, Micro-Beads & Sequins',
    stock: 1,
    photo: '/products/lace/PT800-05.jpg',
    photoGallery: ['/products/lace/PT800-05.jpg']
  }
];

async function main() {
  console.log(`🌸 Seeding ${PATCH_PRODUCTS.length} patch products under style code "TC-PT800" (Target: ${prod ? 'PRODUCTION' : 'EMULATOR'} "${projectId}")...\n`);

  // 1. Update public/products/lace/manifest.json
  const manifestPath = path.resolve('public/products/lace/manifest.json');
  let manifest: Record<string, unknown> = {};
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {
      manifest = {};
    }
  }

  for (const p of PATCH_PRODUCTS) {
    manifest[p.id] = {
      name: p.name,
      desc: p.description,
      price: p.price,
      mrp: p.mrp,
      sub: 'Patch',
      unit: p.unit,
      bundle: null,
      perM: null,
      styleCode: p.styleCode,
      colourName: p.colourName,
    };
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1), 'utf-8');
  console.log(`✅ Updated public/products/lace/manifest.json with ${PATCH_PRODUCTS.length} entries.`);

  // 2. Write to Firestore database
  const batch = db.batch();
  for (const p of PATCH_PRODUCTS) {
    const ref = db.collection('products').doc(p.id);

    batch.set(ref, {
      id: p.id,
      brand: 'TRESOR',
      name: p.name,
      productCode: p.id,
      styleCode: p.styleCode,
      colourName: p.colourName,
      description: p.description,
      price: p.price,
      mrp: p.mrp,
      photo: p.photo,
      photoGallery: p.photoGallery,
      image: p.photo,
      gallery: p.photoGallery,
      category: 'Laces',
      masterCategory: 'Laces',
      subCategory: 'Patch',
      materialType: p.materialType,
      colors: [{ name: p.colourName, hex: p.hex }],
      tags: p.tags,
      stock: p.stock,
      unitType: p.unitType,
      bundleSizeMeters: null,
      bundlePrice: null,
      sellingPricePerMeter: null,
      listingStatus: 'Active',
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`  + ${p.id.padEnd(10)} [${p.colourName.padEnd(24)}] ₹${p.price}/piece (Stock: ${p.stock})`);
  }

  await batch.commit();
  console.log(`\n🎉 Successfully committed ${PATCH_PRODUCTS.length} patch products to Firestore database "${projectId}"!`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
