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
  tags: string[];
}

const STYLE_CODE = 'TC-BD1349';
const BUNDLE_PRICE = 1349;
const MRP = 1999;
const BUNDLE_SIZE_METERS = 9;
const DEFAULT_STOCK_BUNDLES = 10;

const VARIANTS: LaceVariant[] = [
  {
    id: 'BD1349-01',
    colourName: 'Champagne Emerald',
    hex: '#0f6d50',
    name: 'Champagne Emerald Zardozi Vine Lace Border',
    description: 'Intricate gold zardozi leafy vine on translucent champagne net, accented with alternating emerald green and peach floral stone centers and cultured seed pearls. Sold as a complete 9-meter bundle for ₹1,349.',
    tags: ['Lace', 'Champagne', 'Emerald Green', 'Zardozi', 'Pearls', '9m Bundle', 'Couture']
  },
  {
    id: 'BD1349-02',
    colourName: 'Dusty Rose Olive',
    hex: '#c87d85',
    name: 'Dusty Rose Olive Zardozi Vine Lace Border',
    description: 'Delicate dusty rose net embellished with radiant gold zardozi embroidery, featuring olive green and blush pink floral centers with pearl accents. Sold as a complete 9-meter bundle for ₹1,349.',
    tags: ['Lace', 'Dusty Rose', 'Olive', 'Zardozi', 'Pearls', '9m Bundle', 'Bridal']
  },
  {
    id: 'BD1349-03',
    colourName: 'Pale Gold Teal',
    hex: '#2b8a8e',
    name: 'Pale Gold Teal Zardozi Vine Lace Border',
    description: 'Shimmering pale gold and sage ground decorated with detailed zardozi leaf work and vibrant turquoise teal floral stone highlights. Sold as a complete 9-meter bundle for ₹1,349.',
    tags: ['Lace', 'Pale Gold', 'Teal', 'Zardozi', 'Pearls', '9m Bundle', 'Pastel']
  },
  {
    id: 'BD1349-04',
    colourName: 'Midnight Black',
    hex: '#1a1a1a',
    name: 'Midnight Black Zardozi Vine Lace Border',
    description: 'Dramatic midnight black velvet and net base enriched with gleaming antique gold zardozi vines, fine seed pearls, and crystal florets. Sold as a complete 9-meter bundle for ₹1,349.',
    tags: ['Lace', 'Midnight Black', 'Gold', 'Zardozi', 'Pearls', '9m Bundle', 'Statement']
  },
  {
    id: 'BD1349-05',
    colourName: 'Pastel Blush Mint',
    hex: '#e8a5a5',
    name: 'Pastel Blush Mint Zardozi Vine Lace Border',
    description: 'Soft pastel blush ground interwoven with warm gold zari vines, crowned by fresh mint green and peach florets with seed pearls. Sold as a complete 9-meter bundle for ₹1,349.',
    tags: ['Lace', 'Pastel Blush', 'Mint', 'Zardozi', 'Pearls', '9m Bundle', 'Festive']
  },
  {
    id: 'BD1349-06',
    colourName: 'Seafoam Mint Lilac',
    hex: '#88b0a2',
    name: 'Seafoam Mint Lilac Zardozi Vine Lace Border',
    description: 'Ethereal seafoam mint net detailed with fine gold corded vines, pastel lilac and peach crystal flower centers, and delicate pearl beads. Sold as a complete 9-meter bundle for ₹1,349.',
    tags: ['Lace', 'Seafoam Mint', 'Lilac', 'Zardozi', 'Pearls', '9m Bundle', 'Pastel']
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
  console.log(`✅ Updated public/products/lace/manifest.json with 6 entries (unitType: bundle, ₹${BUNDLE_PRICE}/9m).`);

  // 2. Write to Firestore database
  const batch = db.batch();
  for (const v of VARIANTS) {
    const ref = db.collection('products').doc(v.id);
    const photoUrl = `/products/lace/${v.id}.jpg`;
    const gallery = [photoUrl];

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
      materialType: 'Zardozi, Pearls & Stone Cutdana',
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

    console.log(`  + ${v.id.padEnd(10)} [${v.colourName.padEnd(20)}] ₹${BUNDLE_PRICE} (9m bundle)`);
  }

  await batch.commit();
  console.log(`\n🎉 Successfully committed 6 bundle lace products to Firestore database "${projectId}"!`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
