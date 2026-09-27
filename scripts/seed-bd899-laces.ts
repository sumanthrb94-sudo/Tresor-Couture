import fs from 'node:fs';
import path from 'node:path';
import { FieldValue } from 'firebase-admin/firestore';
import { initAdmin } from './lib/admin';

const { db, prod, projectId } = initAdmin();

export interface LaceVariant {
  id: string;
  colourName: string;
  hex: string;
  name: string;
  description: string;
  hasAlt: boolean;
  tags: string[];
}

const STYLE_CODE = 'TC-BD899';
const BUNDLE_PRICE = 899;
const MRP = 1299;
const BUNDLE_SIZE_METERS = 9;
const DEFAULT_STOCK_BUNDLES = 10;

const VARIANTS: LaceVariant[] = [
  {
    id: 'BD899-01',
    colourName: 'Blush Peach',
    hex: '#e48f87',
    name: 'Blush Peach Scalloped Pearl Lace Border',
    hasAlt: false,
    description: 'Delicate blush peach base adorned with scalloped fan edging, lustrous seed pearl chains, and shimmering gold zari threadwork. Sold as a complete 9-meter bundle for ₹899.',
    tags: ['Lace', 'Blush Peach', 'Scalloped', 'Pearls', 'Zari', '9m Bundle', 'Couture']
  },
  {
    id: 'BD899-02',
    colourName: 'Berry Magenta',
    hex: '#8a1f4d',
    name: 'Berry Magenta Scalloped Pearl Lace Border',
    hasAlt: true,
    description: 'Vibrant berry magenta base featuring arched scalloped embroidery, gold chain borders, and luminous embedded pearls. Sold as a complete 9-meter bundle for ₹899.',
    tags: ['Lace', 'Berry Magenta', 'Plum', 'Scalloped', 'Pearls', 'Zari', '9m Bundle', 'Bridal']
  },
  {
    id: 'BD899-03',
    colourName: 'Crimson Red',
    hex: '#9e1b26',
    name: 'Crimson Red Scalloped Pearl Lace Border',
    hasAlt: false,
    description: 'Deep royal crimson red lace border embellished with golden scalloped crowns and continuous pearl piping. Sold as a complete 9-meter bundle for ₹899.',
    tags: ['Lace', 'Crimson Red', 'Maroon', 'Scalloped', 'Pearls', 'Zari', '9m Bundle', 'Bridal']
  },
  {
    id: 'BD899-04',
    colourName: 'Champagne Cream',
    hex: '#d8b979',
    name: 'Champagne Cream Scalloped Pearl Lace Border',
    hasAlt: false,
    description: 'Luminous champagne cream and ivory ground highlighted with antique gold scallop loops and seed pearls. Sold as a complete 9-meter bundle for ₹899.',
    tags: ['Lace', 'Champagne Cream', 'Ivory', 'Scalloped', 'Pearls', 'Zari', '9m Bundle', 'Pastel']
  }
];

async function main() {
  console.log(`🌸 Seeding ${VARIANTS.length} lace variants as 9m bundles (₹${BUNDLE_PRICE}, MRP ₹${MRP}) under style code "${STYLE_CODE}" (Target: ${prod ? 'PRODUCTION' : 'EMULATOR'} "${projectId}")...\n`);

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

  for (const v of VARIANTS) {
    manifest[v.id] = {
      name: v.name,
      desc: v.description,
      price: BUNDLE_PRICE,
      mrp: MRP,
      sub: 'Trim & Edging',
      unit: 'bundle',
      bundle: BUNDLE_SIZE_METERS,
      perM: null,
      styleCode: STYLE_CODE,
      colourName: v.colourName,
    };
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1), 'utf-8');
  console.log(`✅ Updated public/products/lace/manifest.json with 4 entries (unitType: bundle, ₹${BUNDLE_PRICE}/9m).`);

  // 2. Write to Firestore database
  const batch = db.batch();
  for (const v of VARIANTS) {
    const ref = db.collection('products').doc(v.id);
    const photoUrl = `/products/lace/${v.id}.jpg`;
    const gallery = [photoUrl];
    if (v.hasAlt) {
      gallery.push(`/products/lace/${v.id}-alt.jpg`);
    }

    batch.set(ref, {
      id: v.id,
      brand: 'TRESOR',
      name: v.name,
      productCode: v.id,
      styleCode: STYLE_CODE,
      colourName: v.colourName,
      description: v.description,
      price: BUNDLE_PRICE,
      mrp: MRP,
      photo: photoUrl,
      photoGallery: gallery,
      image: photoUrl,
      gallery: gallery,
      category: 'Laces',
      masterCategory: 'Laces',
      subCategory: 'Trim & Edging',
      materialType: 'Scalloped Zari & Pearls',
      colors: [{ name: v.colourName, hex: v.hex }],
      tags: v.tags,
      stock: DEFAULT_STOCK_BUNDLES,
      unitType: 'unit',
      bundleSizeMeters: BUNDLE_SIZE_METERS,
      bundlePrice: BUNDLE_PRICE,
      sellingPricePerMeter: null,
      listingStatus: 'Active',
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`  + ${v.id.padEnd(10)} [${v.colourName.padEnd(18)}] ₹${BUNDLE_PRICE} (9m bundle)`);
  }

  await batch.commit();
  console.log(`\n🎉 Successfully committed 4 bundle lace products to Firestore database "${projectId}"!`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
