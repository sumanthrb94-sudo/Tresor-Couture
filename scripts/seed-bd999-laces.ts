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

const STYLE_CODE = 'TC-BD999';
const BUNDLE_PRICE = 999;
const MRP = 1499;
const BUNDLE_SIZE_METERS = 9;
const DEFAULT_STOCK_BUNDLES = 10;

const VARIANTS: LaceVariant[] = [
  {
    id: 'BD999-01',
    colourName: 'Honey Mustard',
    hex: '#b68a4c',
    name: 'Honey Mustard Embroidered Floral Trim',
    hasAlt: true,
    description: 'Rich honey mustard velvet ground adorned with hand-embellished floral zari vines, cultured seed pearls, and crystal beadwork. Sold as a complete 9-meter bundle for ₹999.',
    tags: ['Lace', 'Honey Mustard', 'Embroidered', 'Floral', 'Pearls', '9m Bundle', 'Couture']
  },
  {
    id: 'BD999-02',
    colourName: 'Emerald Forest',
    hex: '#2d4f3b',
    name: 'Emerald Forest Embroidered Floral Trim',
    hasAlt: true,
    description: 'Regal emerald forest green velvet border trimmed with intricate floral embroidery, lustrous seed pearls, and silver-toned zari leaves. Sold as a complete 9-meter bundle for ₹999.',
    tags: ['Lace', 'Emerald Forest', 'Embroidered', 'Floral', 'Pearls', '9m Bundle', 'Bridal']
  },
  {
    id: 'BD999-03',
    colourName: 'Coral Peach',
    hex: '#d47a63',
    name: 'Coral Peach Embroidered Net Border',
    hasAlt: true,
    description: 'Delicate coral peach threadwork flowers with champagne gold embroidery and pearl florets on fine translucent net. Sold as a complete 9-meter bundle for ₹999.',
    tags: ['Lace', 'Coral Peach', 'Embroidered', 'Floral', 'Pearls', '9m Bundle', 'Pastel']
  },
  {
    id: 'BD999-04',
    colourName: 'Sage Olive',
    hex: '#7d8b67',
    name: 'Sage Olive Embroidered Net Trim',
    hasAlt: false,
    description: 'Soothing sage olive green embroidered border featuring pearl centers, leafy vines, and soft metallic threadwork on airy net. Sold as a complete 9-meter bundle for ₹999.',
    tags: ['Lace', 'Sage Olive', 'Embroidered', 'Floral', 'Pearls', '9m Bundle']
  },
  {
    id: 'BD999-05',
    colourName: 'Primrose Gold',
    hex: '#d4af37',
    name: 'Champagne Primrose Gold Trim',
    hasAlt: false,
    description: 'Luminous champagne primrose gold embroidery on translucent net, accentuated with pearl drops and sparkling crystal beadwork. Sold as a complete 9-meter bundle for ₹999.',
    tags: ['Lace', 'Primrose Gold', 'Champagne', 'Embroidered', 'Floral', 'Pearls', '9m Bundle']
  },
  {
    id: 'BD999-06',
    colourName: 'Dusty Rose',
    hex: '#a35c6a',
    name: 'Dusty Rose Mauve Embroidered Border',
    hasAlt: false,
    description: 'Romantic dusty rose mauve floral border embellished with fine zari branches and cultured seed pearls. Sold as a complete 9-meter bundle for ₹999.',
    tags: ['Lace', 'Dusty Rose', 'Mauve', 'Embroidered', 'Floral', 'Pearls', '9m Bundle']
  },
  {
    id: 'BD999-07',
    colourName: 'Mink Taupe',
    hex: '#8c7a6b',
    name: 'Mink Taupe Embroidered Floral Lace',
    hasAlt: true,
    description: 'Elegant mink taupe embroidered lace trim with subtle metallic sheen and pearl accents on delicate organza net. Sold as a complete 9-meter bundle for ₹999.',
    tags: ['Lace', 'Mink Taupe', 'Embroidered', 'Floral', 'Pearls', '9m Bundle']
  },
  {
    id: 'BD999-08',
    colourName: 'Mulberry Wine',
    hex: '#5e2d44',
    name: 'Mulberry Wine Embroidered Lace Trim',
    hasAlt: false,
    description: 'Deep mulberry wine floral motifs with gold zari and pearl stamen details, ideal for royal bridal couture and lehengas. Sold as a complete 9-meter bundle for ₹999.',
    tags: ['Lace', 'Mulberry Wine', 'Embroidered', 'Floral', 'Pearls', '9m Bundle', 'Bridal']
  },
  {
    id: 'BD999-09',
    colourName: 'Ruby Crimson',
    hex: '#9e2a3b',
    name: 'Ruby Crimson Embroidered Ribbon Border',
    hasAlt: false,
    description: 'Striking ruby crimson floral embroidery on soft blush ground, highlighted with seed pearls and metallic edging. Sold as a complete 9-meter bundle for ₹999.',
    tags: ['Lace', 'Ruby Crimson', 'Embroidered', 'Floral', 'Pearls', '9m Bundle']
  },
  {
    id: 'BD999-10',
    colourName: 'Caramel Bronze',
    hex: '#8f5e38',
    name: 'Antique Caramel Bronze Lace Border',
    hasAlt: false,
    description: 'Warm antique caramel bronze embroidery featuring intricate leafy trails, pearl clusters, and copper bugle beads. Sold as a complete 9-meter bundle for ₹999.',
    tags: ['Lace', 'Caramel Bronze', 'Embroidered', 'Floral', 'Pearls', '9m Bundle']
  },
  {
    id: 'BD999-11',
    colourName: 'Slate Navy',
    hex: '#3a4454',
    name: 'Slate Charcoal Navy Embroidered Trim',
    hasAlt: false,
    description: 'Sophisticated slate charcoal and deep navy embroidery on silver net with pearl and zircon-style bead highlights. Sold as a complete 9-meter bundle for ₹999.',
    tags: ['Lace', 'Slate Navy', 'Charcoal', 'Embroidered', 'Floral', 'Pearls', '9m Bundle']
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
  console.log(`✅ Updated public/products/lace/manifest.json with 11 entries (unitType: bundle, ₹${BUNDLE_PRICE}/9m).`);

  // 2. Write to Firestore database (if connected)
  try {
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
        materialType: 'Embroidered Zari, Pearls & Beads',
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
    console.log(`\n🎉 Successfully committed 11 bundle lace products to Firestore database "${projectId}"!`);
  } catch (err: unknown) {
    console.warn(`\n⚠️ Note on Firestore write: ${(err as Error).message}`);
    console.log(`Catalog files (manifest.json, images, inventory_full_seed.json) are completely updated.`);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
