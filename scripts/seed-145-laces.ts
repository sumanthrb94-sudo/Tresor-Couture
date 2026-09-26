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

const STYLE_CODE = 'TC-LC145';
const PRICE_PER_METER = 150; // ₹150 per meter across all colourways
const DEFAULT_STOCK_METERS = 100; // 100 meters available per colorway

const VARIANTS: LaceVariant[] = [
  {
    id: 'LC145-01',
    colourName: 'Amber Gold',
    hex: '#b4926a',
    name: 'Amber Gold Embroidered Lace Border',
    description: 'Rich amber-gold threadwork and delicate sequin detailing over fine organza net. Sold per meter at ₹150/m for custom lehenga borders, dupattas, and saree trims.',
    tags: ['Lace', 'Amber Gold', 'Embroidered', 'Border', 'Per Meter', 'Couture']
  },
  {
    id: 'LC145-02',
    colourName: 'Deep Copper',
    hex: '#825438',
    name: 'Deep Copper Antique Zari Lace',
    description: 'Deep copper tones interwoven with metallic antique zari threads. Sold per meter at ₹150/m for velvet jackets, necklines, and bridal ensemble hemlines.',
    tags: ['Lace', 'Deep Copper', 'Zari', 'Antique', 'Per Meter', 'Bridal']
  },
  {
    id: 'LC145-03',
    colourName: 'Rustic Bronze',
    hex: '#6c4c2d',
    name: 'Rustic Bronze Corded Floral Trim',
    description: 'Deep rustic bronze corded embroidery featuring interlocking floral motifs. Sold per meter at ₹150/m for rich earthy palettes, festive sleeve cuffs, and gown accents.',
    tags: ['Lace', 'Rustic Bronze', 'Corded', 'Floral', 'Per Meter']
  },
  {
    id: 'LC145-04',
    colourName: 'Rose Gold',
    hex: '#bb835e',
    name: 'Rose Gold Shimmer Lace Border',
    description: 'Luminous rose gold embroidery with micro-sequins laid on soft champagne net. Sold per meter at ₹150/m for contemporary pastel wear.',
    tags: ['Lace', 'Rose Gold', 'Shimmer', 'Pastel', 'Per Meter']
  },
  {
    id: 'LC145-05',
    colourName: 'Terracotta Blush',
    hex: '#a4634d',
    name: 'Terracotta Blush Embroidered Trim',
    description: 'Warm terracotta blush threadwork with subtle scalloped edging. Sold per meter at ₹150/m for mehendi, haldi, or festive ethnic borders.',
    tags: ['Lace', 'Terracotta Blush', 'Scalloped', 'Festive', 'Per Meter']
  },
  {
    id: 'LC145-06',
    colourName: 'Warm Honey',
    hex: '#be9369',
    name: 'Warm Honey Metallic Border Lace',
    description: 'Golden honey tones with fine metallic thread highlights and structured geometric edging. Sold per meter at ₹150/m.',
    tags: ['Lace', 'Warm Honey', 'Metallic', 'Border', 'Per Meter']
  },
  {
    id: 'LC145-07',
    colourName: 'Taupe Beige',
    hex: '#a2937a',
    name: 'Taupe Beige Corded Scallop Lace',
    description: 'Understated taupe beige corded lace with refined scalloped borders. Sold per meter at ₹150/m for subtle pipings, hem features, and tailored plackets.',
    tags: ['Lace', 'Taupe Beige', 'Scallop', 'Corded', 'Per Meter']
  },
  {
    id: 'LC145-08',
    colourName: 'Sand Gold',
    hex: '#c0a786',
    name: 'Sand Gold Fine Filigree Trim',
    description: 'Bright sand-gold threadwork rendered in a classic filigree scroll pattern. Sold per meter at ₹150/m for sheer dupattas and saree falls.',
    tags: ['Lace', 'Sand Gold', 'Filigree', 'Saree Border', 'Per Meter']
  },
  {
    id: 'LC145-09',
    colourName: 'Olive Gold',
    hex: '#a08a67',
    name: 'Olive Gold Embroidered Net Trim',
    description: 'Earthy olive green blended with muted gold metallic threads on sheer net. Sold per meter at ₹150/m for royal dark ensembles.',
    tags: ['Lace', 'Olive Gold', 'Muted Gold', 'Per Meter']
  },
  {
    id: 'LC145-10',
    colourName: 'Champagne Beige',
    hex: '#cdb490',
    name: 'Champagne Beige Pearl-Dotted Lace',
    description: 'Light champagne beige lace decorated with subtle seed-pearl accents and sparkling micro-sequin runs. Sold per meter at ₹150/m.',
    tags: ['Lace', 'Champagne Beige', 'Bridal', 'Pearl', 'Per Meter']
  },
  {
    id: 'LC145-11',
    colourName: 'Dusty Coral',
    hex: '#b88068',
    name: 'Dusty Coral Embroidered Ribbon Trim',
    description: 'Vibrant dusty coral and peach embroidery with delicate floral lace runs. Sold per meter at ₹150/m for festive wear and bridal dupattas.',
    tags: ['Lace', 'Dusty Coral', 'Floral', 'Per Meter']
  },
  {
    id: 'LC145-12',
    colourName: 'Antique Sand',
    hex: '#af9373',
    name: 'Antique Sand Corded Braid',
    description: 'Soft antique sand shade with dense corded weave and fine chain edging. Sold per meter at ₹150/m for border finishing and sleeve hems.',
    tags: ['Lace', 'Antique Sand', 'Corded', 'Braid', 'Per Meter']
  },
  {
    id: 'LC145-13',
    colourName: 'Blush Nude',
    hex: '#c39881',
    name: 'Blush Nude Floral Scallop Trim',
    description: 'Soft blush nude net with romantic floral threadwork and scalloped border edge. Sold per meter at ₹150/m.',
    tags: ['Lace', 'Blush Nude', 'Scallop', 'Pastel', 'Per Meter']
  },
  {
    id: 'LC145-14',
    colourName: 'Muted Pebble',
    hex: '#af9888',
    name: 'Muted Pebble Silver-Gold Braid',
    description: 'Neutral pebble grey-brown shade infused with silver and soft gold highlights. Sold per meter at ₹150/m.',
    tags: ['Lace', 'Muted Pebble', 'Silver Gold', 'Per Meter']
  },
  {
    id: 'LC145-15',
    colourName: 'Golden Almond',
    hex: '#bba387',
    name: 'Golden Almond Decorative Lace Band',
    description: 'Warm golden almond satin-feel embroidery with a run of detailed geometric motifs. Sold per meter at ₹150/m.',
    tags: ['Lace', 'Golden Almond', 'Geometric', 'Per Meter']
  },
  {
    id: 'LC145-16',
    colourName: 'Classic Khaki',
    hex: '#bba37f',
    name: 'Classic Khaki Gold Threadwork Border',
    description: 'Sophisticated classic khaki background woven with bright gold thread. Sold per meter at ₹150/m for suits and saree borders.',
    tags: ['Lace', 'Classic Khaki', 'Gold Thread', 'Per Meter']
  },
  {
    id: 'LC145-17',
    colourName: 'Sand Gold Scallop',
    hex: '#c5a57a',
    name: 'Sand Gold Scalloped Flower Lace',
    description: 'Luminous sand gold floral loops with scalloped edges. Sold per meter at ₹150/m for dupatta borders and lehenga flares.',
    tags: ['Lace', 'Sand Gold', 'Scallop', 'Floral', 'Per Meter']
  },
  {
    id: 'LC145-18',
    colourName: 'Soft Cream',
    hex: '#ab977e',
    name: 'Soft Cream Embroidered Lattice Trim',
    description: 'Gentle cream base with intricate lattice embroidery and fine picot selvedge. Sold per meter at ₹150/m.',
    tags: ['Lace', 'Soft Cream', 'Lattice', 'Picot', 'Per Meter']
  },
  {
    id: 'LC145-19',
    colourName: 'Mocha Ash',
    hex: '#be986d',
    name: 'Mocha Ash Metallic Border Trim',
    description: 'Deep mocha ash tone featuring warm copper-gold embroidery and crisp linear framing. Sold per meter at ₹150/m.',
    tags: ['Lace', 'Mocha Ash', 'Copper Gold', 'Per Meter']
  },
  {
    id: 'LC145-20',
    colourName: 'Olive Bronze',
    hex: '#93805f',
    name: 'Olive Bronze Antique Jaal Lace',
    description: 'Muted olive bronze corded jaal lace with antique metallic threadwork. Sold per meter at ₹150/m.',
    tags: ['Lace', 'Olive Bronze', 'Jaal', 'Antique', 'Per Meter']
  },
  {
    id: 'LC145-21',
    colourName: 'Muted Rose',
    hex: '#b07964',
    name: 'Muted Rose Garden Embroidered Lace',
    description: 'Charming muted rose pink embroidery with floral vine repeats and gold bugle bead accents. Sold per meter at ₹150/m.',
    tags: ['Lace', 'Muted Rose', 'Floral Vine', 'Per Meter']
  },
  {
    id: 'LC145-22',
    colourName: 'Dark Moss',
    hex: '#8b7e66',
    name: 'Dark Moss Gold-Dusted Corded Lace',
    description: 'Deep dark moss green ground with subtle gold dust highlights and corded scalloped border. Sold per meter at ₹150/m.',
    tags: ['Lace', 'Dark Moss', 'Corded', 'Gold Dust', 'Per Meter']
  },
  {
    id: 'LC145-23',
    colourName: 'Caramel Tan',
    hex: '#a68060',
    name: 'Caramel Tan Zari & Sequin Braid',
    description: 'Rich caramel tan lace featuring packed zari scrolls and sparkling sequin highlights. Sold per meter at ₹150/m.',
    tags: ['Lace', 'Caramel Tan', 'Zari', 'Sequin', 'Per Meter']
  },
  {
    id: 'LC145-24',
    colourName: 'Espresso Bronze',
    hex: '#93735d',
    name: 'Espresso Bronze Filigree Border',
    description: 'Deep espresso bronze tone with dense antique filigree embroidery. Sold per meter at ₹150/m.',
    tags: ['Lace', 'Espresso Bronze', 'Filigree', 'Heavy Border', 'Per Meter']
  }
];

async function main() {
  console.log(`▸ Updating ${VARIANTS.length} lace variants to ₹150/m (unitType: per meter) under style code "${STYLE_CODE}" (Target: ${prod ? 'PRODUCTION' : 'EMULATOR'} "${projectId}")...\n`);

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
      price: PRICE_PER_METER,
      mrp: PRICE_PER_METER,
      sub: 'Trim & Edging',
      unit: 'per meter',
      perM: PRICE_PER_METER,
      styleCode: STYLE_CODE,
      colourName: v.colourName,
    };
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1), 'utf-8');
  console.log(`✓ Updated public/products/lace/manifest.json with 24 entries (unitType: per meter, ₹150/m).`);

  // 2. Write to Firestore database
  const batch = db.batch();
  for (const v of VARIANTS) {
    const ref = db.collection('products').doc(v.id);
    const photoUrl = `/products/lace/${v.id}.jpg`;

    batch.set(ref, {
      id: v.id,
      brand: 'TRESOR',
      name: v.name,
      productCode: v.id,
      styleCode: STYLE_CODE,
      colourName: v.colourName,
      description: v.description,
      price: PRICE_PER_METER,
      mrp: PRICE_PER_METER,
      sellingPricePerMeter: PRICE_PER_METER,
      photo: photoUrl,
      photoGallery: [photoUrl],
      image: photoUrl,
      gallery: [photoUrl],
      category: 'Laces',
      masterCategory: 'Laces',
      subCategory: 'Trim & Edging',
      materialType: 'Embroidered Zari & Sequins',
      colors: [{ name: v.colourName, hex: v.hex }],
      tags: v.tags,
      stock: DEFAULT_STOCK_METERS,
      unitType: 'per meter',
      listingStatus: 'Active',
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`  + ${v.id.padEnd(10)} [${v.colourName.padEnd(18)}] ₹${PRICE_PER_METER}/m (per meter)`);
  }

  await batch.commit();
  console.log(`\n✓ Successfully committed ₹150/m (unitType: per meter) update to Firestore database "${projectId}"!`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
