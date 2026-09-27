import fs from 'node:fs';
import path from 'node:path';
import { FieldValue } from 'firebase-admin/firestore';
import { initAdmin } from './lib/admin';

const { db, prod, projectId } = initAdmin();

export interface LaceVariant {
  id: string;
  styleCode: string;
  colourName: string;
  hex: string;
  name: string;
  description: string;
  tags: string[];
  unitType: 'unit' | 'meter';
  unit: 'bundle' | 'meter';
  bundleSizeMeters: number | null;
  bundlePrice: number | null;
  price: number;
  mrp: number;
  materialType: string;
  stock: number;
}

const BATCH6_VARIANTS: LaceVariant[] = [
  {
    id: 'BD899B-01',
    styleCode: 'TC-BD899B',
    colourName: 'Royal Purple',
    hex: '#5B215E',
    name: 'Royal Purple Velvet Pearl Zardozi Lace Border',
    description: 'Plush royal purple velvet ribbon border lavishly decorated with antique gold zardozi wire filigree, bugle beads, and a running line of lustrous cultured seed pearls. Sold as a complete 9-meter bundle for ₹899.',
    tags: ['Lace', 'Royal Purple', 'Velvet', 'Zardozi', 'Pearls', '9m Bundle', 'Festive'],
    unitType: 'unit',
    unit: 'bundle',
    bundleSizeMeters: 9,
    bundlePrice: 899,
    price: 899,
    mrp: 1299,
    materialType: 'Velvet, Zardozi & Cultured Pearls',
    stock: 10
  },
  {
    id: 'BD899B-02',
    styleCode: 'TC-BD899B',
    colourName: 'Rani Magenta',
    hex: '#A81B5E',
    name: 'Rani Magenta Velvet Pearl Zardozi Lace Border',
    description: 'Vibrant rani magenta velvet ribbon border featuring intricate gold zardozi scrollwork, sparkling cutdana accents, and pearl borders. Sold as a complete 9-meter bundle for ₹899.',
    tags: ['Lace', 'Rani Magenta', 'Velvet', 'Zardozi', 'Pearls', '9m Bundle', 'Bridal'],
    unitType: 'unit',
    unit: 'bundle',
    bundleSizeMeters: 9,
    bundlePrice: 899,
    price: 899,
    mrp: 1299,
    materialType: 'Velvet, Zardozi & Cultured Pearls',
    stock: 10
  },
  {
    id: 'BD899B-03',
    styleCode: 'TC-BD899B',
    colourName: 'Crimson Red',
    hex: '#A01524',
    name: 'Crimson Red Velvet Pearl Zardozi Lace Border',
    description: 'Opulent crimson bridal red velvet ground edged with glowing gold zardozi leaf flourishes and radiant seed-pearl rows. Sold as a complete 9-meter bundle for ₹899.',
    tags: ['Lace', 'Crimson Red', 'Velvet', 'Zardozi', 'Pearls', '9m Bundle', 'Bridal'],
    unitType: 'unit',
    unit: 'bundle',
    bundleSizeMeters: 9,
    bundlePrice: 899,
    price: 899,
    mrp: 1299,
    materialType: 'Velvet, Zardozi & Cultured Pearls',
    stock: 10
  },
  {
    id: 'BD899B-04',
    styleCode: 'TC-BD899B',
    colourName: 'Wine Plum',
    hex: '#661937',
    name: 'Wine Plum Velvet Pearl Zardozi Lace Border',
    description: 'Regal deep wine plum velvet ribbon embellished with antique gold zari loops, bugle beads, and delicate cultured pearl beads. Sold as a complete 9-meter bundle for ₹899.',
    tags: ['Lace', 'Wine Plum', 'Velvet', 'Zardozi', 'Pearls', '9m Bundle', 'Royal'],
    unitType: 'unit',
    unit: 'bundle',
    bundleSizeMeters: 9,
    bundlePrice: 899,
    price: 899,
    mrp: 1299,
    materialType: 'Velvet, Zardozi & Cultured Pearls',
    stock: 10
  },
  {
    id: 'BD899B-05',
    styleCode: 'TC-BD899B',
    colourName: 'Antique Gold',
    hex: '#BFA253',
    name: 'Antique Gold Velvet Pearl Zardozi Lace Border',
    description: 'Luminous antique gold velvet border adorned with tone-on-tone gold zardozi embroidery and pearl accents. Sold as a complete 9-meter bundle for ₹899.',
    tags: ['Lace', 'Antique Gold', 'Velvet', 'Zardozi', 'Pearls', '9m Bundle', 'Classic'],
    unitType: 'unit',
    unit: 'bundle',
    bundleSizeMeters: 9,
    bundlePrice: 899,
    price: 899,
    mrp: 1299,
    materialType: 'Velvet, Zardozi & Cultured Pearls',
    stock: 10
  },
  {
    id: 'BD899B-06',
    styleCode: 'TC-BD899B',
    colourName: 'Midnight Black',
    hex: '#1A1A1A',
    name: 'Midnight Black Velvet Pearl Zardozi Lace Border',
    description: 'Dramatic midnight black velvet border highlighted by glistening gold zardozi filigree and bright cultured seed pearls. Sold as a complete 9-meter bundle for ₹899.',
    tags: ['Lace', 'Midnight Black', 'Velvet', 'Zardozi', 'Pearls', '9m Bundle', 'Statement'],
    unitType: 'unit',
    unit: 'bundle',
    bundleSizeMeters: 9,
    bundlePrice: 899,
    price: 899,
    mrp: 1299,
    materialType: 'Velvet, Zardozi & Cultured Pearls',
    stock: 10
  },
  {
    id: 'BD899B-07',
    styleCode: 'TC-BD899B',
    colourName: 'Dusty Rose',
    hex: '#C77C8D',
    name: 'Dusty Rose Velvet Pearl Zardozi Lace Border',
    description: 'Soft dusty rose velvet ground accentuated by delicate antique gold wirework, bugle beads, and pearl trim. Sold as a complete 9-meter bundle for ₹899.',
    tags: ['Lace', 'Dusty Rose', 'Velvet', 'Zardozi', 'Pearls', '9m Bundle', 'Pastel'],
    unitType: 'unit',
    unit: 'bundle',
    bundleSizeMeters: 9,
    bundlePrice: 899,
    price: 899,
    mrp: 1299,
    materialType: 'Velvet, Zardozi & Cultured Pearls',
    stock: 10
  },
  {
    id: 'BD899B-08',
    styleCode: 'TC-BD899B',
    colourName: 'Emerald Green',
    hex: '#144D29',
    name: 'Emerald Green Velvet Pearl Zardozi Lace Border',
    description: 'Rich bottle emerald green velvet ribbon crowned by radiant gold zardozi scrollwork and cultured pearl drops. Sold as a complete 9-meter bundle for ₹899.',
    tags: ['Lace', 'Emerald Green', 'Velvet', 'Zardozi', 'Pearls', '9m Bundle', 'Couture'],
    unitType: 'unit',
    unit: 'bundle',
    bundleSizeMeters: 9,
    bundlePrice: 899,
    price: 899,
    mrp: 1299,
    materialType: 'Velvet, Zardozi & Cultured Pearls',
    stock: 10
  },
  {
    id: 'BD899B-09',
    styleCode: 'TC-BD899B',
    colourName: 'Olive Green',
    hex: '#6E7238',
    name: 'Olive Green Velvet Pearl Zardozi Lace Border',
    description: 'Earthy olive green velvet border detailed with fine gold zardozi embroidery and pearl accents. Sold as a complete 9-meter bundle for ₹899.',
    tags: ['Lace', 'Olive Green', 'Velvet', 'Zardozi', 'Pearls', '9m Bundle', 'Vintage'],
    unitType: 'unit',
    unit: 'bundle',
    bundleSizeMeters: 9,
    bundlePrice: 899,
    price: 899,
    mrp: 1299,
    materialType: 'Velvet, Zardozi & Cultured Pearls',
    stock: 10
  },
  {
    id: 'BD899B-10',
    styleCode: 'TC-BD899B',
    colourName: 'Ivory Cream',
    hex: '#E5DAC2',
    name: 'Ivory Cream Velvet Pearl Zardozi Lace Border',
    description: 'Chic ivory cream ground embellished with shining gold zardozi loops and matching cultured seed pearls. Sold as a complete 9-meter bundle for ₹899.',
    tags: ['Lace', 'Ivory Cream', 'Velvet', 'Zardozi', 'Pearls', '9m Bundle', 'Bridal'],
    unitType: 'unit',
    unit: 'bundle',
    bundleSizeMeters: 9,
    bundlePrice: 899,
    price: 899,
    mrp: 1299,
    materialType: 'Velvet, Zardozi & Cultured Pearls',
    stock: 10
  }
];

const BATCH7_VARIANTS: LaceVariant[] = [
  {
    id: 'LC199-01',
    styleCode: 'TC-LC199',
    colourName: 'Rani Pink',
    hex: '#D04A6C',
    name: 'Rani Pink Chain & Sequin Drop Ribbon Lace',
    description: 'High-density ribbed grosgrain base ribbon in vibrant rani pink, finished with an interlocking gold metal loop chain and a dangling scalloped coin sequin fringe. Sold per meter at ₹199/m.',
    tags: ['Lace', 'Rani Pink', 'Ribbon', 'Gold Chain', 'Sequin Fringe', 'Per Meter'],
    unitType: 'meter',
    unit: 'meter',
    bundleSizeMeters: null,
    bundlePrice: null,
    price: 199,
    mrp: 299,
    materialType: 'Grosgrain Ribbon, Ring Chain & Sequins',
    stock: 50
  },
  {
    id: 'LC199-02',
    styleCode: 'TC-LC199',
    colourName: 'Royal Navy Blue',
    hex: '#17182B',
    name: 'Royal Navy Chain & Sequin Drop Ribbon Lace',
    description: 'Deep royal navy blue grosgrain ribbon trim detailed with polished gold metal ring chains and glimmering drop coin sequins. Sold per meter at ₹199/m.',
    tags: ['Lace', 'Royal Navy', 'Ribbon', 'Gold Chain', 'Sequin Fringe', 'Per Meter'],
    unitType: 'meter',
    unit: 'meter',
    bundleSizeMeters: null,
    bundlePrice: null,
    price: 199,
    mrp: 299,
    materialType: 'Grosgrain Ribbon, Ring Chain & Sequins',
    stock: 50
  },
  {
    id: 'LC199-03',
    styleCode: 'TC-LC199',
    colourName: 'Midnight Black',
    hex: '#1A130D',
    name: 'Midnight Black Chain & Sequin Drop Ribbon Lace',
    description: 'Sleek midnight black grosgrain ribbon accented with radiant gold metal chainwork and sparkling dangling sequins. Sold per meter at ₹199/m.',
    tags: ['Lace', 'Midnight Black', 'Ribbon', 'Gold Chain', 'Sequin Fringe', 'Per Meter'],
    unitType: 'meter',
    unit: 'meter',
    bundleSizeMeters: null,
    bundlePrice: null,
    price: 199,
    mrp: 299,
    materialType: 'Grosgrain Ribbon, Ring Chain & Sequins',
    stock: 50
  },
  {
    id: 'LC199-04',
    styleCode: 'TC-LC199',
    colourName: 'Crimson Red',
    hex: '#C02838',
    name: 'Crimson Red Chain & Sequin Drop Ribbon Lace',
    description: 'Festive crimson red ribbon border edged with gleaming gold cable chain links and reflective circular coin sequins. Sold per meter at ₹199/m.',
    tags: ['Lace', 'Crimson Red', 'Ribbon', 'Gold Chain', 'Sequin Fringe', 'Per Meter'],
    unitType: 'meter',
    unit: 'meter',
    bundleSizeMeters: null,
    bundlePrice: null,
    price: 199,
    mrp: 299,
    materialType: 'Grosgrain Ribbon, Ring Chain & Sequins',
    stock: 50
  },
  {
    id: 'LC199-05',
    styleCode: 'TC-LC199',
    colourName: 'Brick Rose',
    hex: '#962E3B',
    name: 'Brick Rose Chain & Sequin Drop Ribbon Lace',
    description: 'Refined brick rose ribbed ribbon completed with antique gold interlocking rings and shimmering sequin drops. Sold per meter at ₹199/m.',
    tags: ['Lace', 'Brick Rose', 'Ribbon', 'Gold Chain', 'Sequin Fringe', 'Per Meter'],
    unitType: 'meter',
    unit: 'meter',
    bundleSizeMeters: null,
    bundlePrice: null,
    price: 199,
    mrp: 299,
    materialType: 'Grosgrain Ribbon, Ring Chain & Sequins',
    stock: 50
  },
  {
    id: 'LC199-06',
    styleCode: 'TC-LC199',
    colourName: 'Emerald Green',
    hex: '#1E5E35',
    name: 'Emerald Green Chain & Sequin Drop Ribbon Lace',
    description: 'Lush emerald green grosgrain ribbon border decorated with golden metal loops and a lively scallop sequin fringe. Sold per meter at ₹199/m.',
    tags: ['Lace', 'Emerald Green', 'Ribbon', 'Gold Chain', 'Sequin Fringe', 'Per Meter'],
    unitType: 'meter',
    unit: 'meter',
    bundleSizeMeters: null,
    bundlePrice: null,
    price: 199,
    mrp: 299,
    materialType: 'Grosgrain Ribbon, Ring Chain & Sequins',
    stock: 50
  }
];

const ALL_NEW_VARIANTS: LaceVariant[] = [...BATCH6_VARIANTS, ...BATCH7_VARIANTS];

async function main() {
  console.log(`🌸 Seeding ${ALL_NEW_VARIANTS.length} lace variants:`);
  console.log(`   - 10 under style code "TC-BD899B" (9m bundles @ ₹899)`);
  console.log(`   - 6 under style code "TC-LC199" (per meter @ ₹199/m)`);
  console.log(`   Target: ${prod ? 'PRODUCTION' : 'EMULATOR'} "${projectId}"...\n`);

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

  for (const v of ALL_NEW_VARIANTS) {
    manifest[v.id] = {
      name: v.name,
      desc: v.description,
      price: v.price,
      mrp: v.mrp,
      sub: 'Trim & Edging',
      unit: v.unit,
      bundle: v.bundleSizeMeters,
      perM: v.unitType === 'meter' ? v.price : null,
      styleCode: v.styleCode,
      colourName: v.colourName,
    };
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1), 'utf-8');
  console.log(`✅ Updated public/products/lace/manifest.json with ${ALL_NEW_VARIANTS.length} entries.`);

  // 2. Write to Firestore database
  const batch = db.batch();
  for (const v of ALL_NEW_VARIANTS) {
    const ref = db.collection('products').doc(v.id);
    const photoUrl = `/products/lace/${v.id}.jpg`;
    const gallery = [photoUrl];

    batch.set(ref, {
      id: v.id,
      brand: 'TRESOR',
      name: v.name,
      productCode: v.id,
      styleCode: v.styleCode,
      colourName: v.colourName,
      description: v.description,
      price: v.price,
      mrp: v.mrp,
      photo: photoUrl,
      photoGallery: gallery,
      image: photoUrl,
      gallery: gallery,
      category: 'Laces',
      masterCategory: 'Laces',
      subCategory: 'Trim & Edging',
      materialType: v.materialType,
      colors: [{ name: v.colourName, hex: v.hex }],
      tags: v.tags,
      stock: v.stock,
      unitType: v.unitType,
      bundleSizeMeters: v.bundleSizeMeters,
      bundlePrice: v.bundlePrice,
      sellingPricePerMeter: v.unitType === 'meter' ? v.price : null,
      listingStatus: 'Active',
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const priceLabel = v.unitType === 'meter' ? `₹${v.price}/m` : `₹${v.price} (9m bundle)`;
    console.log(`  + ${v.id.padEnd(10)} [${v.colourName.padEnd(18)}] ${priceLabel}`);
  }

  await batch.commit();
  console.log(`\n🎉 Successfully committed ${ALL_NEW_VARIANTS.length} lace products to Firestore database "${projectId}"!`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
