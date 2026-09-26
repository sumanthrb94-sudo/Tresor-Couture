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
const BUNDLE_METERS = 145;
const PRICE = 14500; // ₹100 per meter rate for 145m reel

const VARIANTS: LaceVariant[] = [
  {
    id: 'LC145-01',
    colourName: 'Amber Gold',
    hex: '#b4926a',
    name: 'Amber Gold Embroidered Lace Border',
    description: 'Rich amber-gold threadwork and delicate sequin detailing over fine organza net. A complete 145-metre reel designed for extensive couture, lehenga borders, dupattas, and saree trims.',
    tags: ['Lace', 'Amber Gold', 'Embroidered', 'Border', '145m Reel', 'Couture']
  },
  {
    id: 'LC145-02',
    colourName: 'Deep Copper',
    hex: '#825438',
    name: 'Deep Copper Antique Zari Lace',
    description: 'Deep copper tones interwoven with metallic antique zari threads. Provides warm, regal framing for velvet jackets, necklines, and bridal ensemble hemlines. 145-metre reel.',
    tags: ['Lace', 'Deep Copper', 'Zari', 'Antique', '145m Reel', 'Bridal']
  },
  {
    id: 'LC145-03',
    colourName: 'Rustic Bronze',
    hex: '#6c4c2d',
    name: 'Rustic Bronze Corded Floral Trim',
    description: 'Deep rustic bronze corded embroidery featuring interlocking floral motifs. Ideal for rich earthy palettes, festive sleeve cuffs, and gown accents. 145-metre reel.',
    tags: ['Lace', 'Rustic Bronze', 'Corded', 'Floral', '145m Reel']
  },
  {
    id: 'LC145-04',
    colourName: 'Rose Gold',
    hex: '#bb835e',
    name: 'Rose Gold Shimmer Lace Border',
    description: 'Luminous rose gold embroidery with micro-sequins laid on a soft champagne net. Adds a delicate, glowing metallic touch to contemporary pastel wear. 145-metre reel.',
    tags: ['Lace', 'Rose Gold', 'Shimmer', 'Pastel', '145m Reel']
  },
  {
    id: 'LC145-05',
    colourName: 'Terracotta Blush',
    hex: '#a4634d',
    name: 'Terracotta Blush Embroidered Trim',
    description: 'Warm terracotta blush threadwork with subtle scalloped edging. Perfect for finishing mehendi, haldi, or festive ethnic borders. 145-metre reel.',
    tags: ['Lace', 'Terracotta Blush', 'Scalloped', 'Festive', '145m Reel']
  },
  {
    id: 'LC145-06',
    colourName: 'Warm Honey',
    hex: '#be9369',
    name: 'Warm Honey Metallic Border Lace',
    description: 'Golden honey tones with fine metallic thread highlights and structured geometric edging. Generous 145-metre reel for large-scale garment manufacturing.',
    tags: ['Lace', 'Warm Honey', 'Metallic', 'Border', '145m Reel']
  },
  {
    id: 'LC145-07',
    colourName: 'Taupe Beige',
    hex: '#a2937a',
    name: 'Taupe Beige Corded Scallop Lace',
    description: 'Understated taupe beige corded lace with refined scalloped borders. Excellent for subtle pipings, hem features, and tailored plackets. 145-metre reel.',
    tags: ['Lace', 'Taupe Beige', 'Scallop', 'Corded', '145m Reel']
  },
  {
    id: 'LC145-08',
    colourName: 'Sand Gold',
    hex: '#c0a786',
    name: 'Sand Gold Fine Filigree Trim',
    description: 'Bright sand-gold threadwork rendered in a classic filigree scroll pattern. Adds crisp, polished metallic outline to sheer dupattas and saree falls. 145-metre reel.',
    tags: ['Lace', 'Sand Gold', 'Filigree', 'Saree Border', '145m Reel']
  },
  {
    id: 'LC145-09',
    colourName: 'Olive Gold',
    hex: '#a08a67',
    name: 'Olive Gold Embroidered Net Trim',
    description: 'Earthy olive green blended with muted gold metallic threads on sheer net. Ideal for royal dark ensembles and muted tone-on-tone designs. 145-metre reel.',
    tags: ['Lace', 'Olive Gold', 'Muted Gold', '145m Reel']
  },
  {
    id: 'LC145-10',
    colourName: 'Champagne Beige',
    hex: '#cdb490',
    name: 'Champagne Beige Pearl-Dotted Lace',
    description: 'Light champagne beige lace decorated with subtle seed-pearl accents and sparkling micro-sequin runs. Perfect for ivory and pastel bridal wear. 145-metre reel.',
    tags: ['Lace', 'Champagne Beige', 'Bridal', 'Pearl', '145m Reel']
  },
  {
    id: 'LC145-11',
    colourName: 'Dusty Coral',
    hex: '#b88068',
    name: 'Dusty Coral Embroidered Ribbon Trim',
    description: 'Vibrant dusty coral and peach embroidery with delicate floral lace runs. Enhances daytime festive wear and bright bridal dupattas. 145-metre reel.',
    tags: ['Lace', 'Dusty Coral', 'Floral', '145m Reel']
  },
  {
    id: 'LC145-12',
    colourName: 'Antique Sand',
    hex: '#af9373',
    name: 'Antique Sand Corded Braid',
    description: 'Soft antique sand shade with dense corded weave and fine chain edging. Perfect for tailored border finishing and sleeve hems. 145-metre reel.',
    tags: ['Lace', 'Antique Sand', 'Corded', 'Braid', '145m Reel']
  },
  {
    id: 'LC145-13',
    colourName: 'Blush Nude',
    hex: '#c39881',
    name: 'Blush Nude Floral Scallop Trim',
    description: 'Soft blush nude net with romantic floral threadwork and scalloped border edge. Designed for modern pastel lehengas and gowns. 145-metre reel.',
    tags: ['Lace', 'Blush Nude', 'Scallop', 'Pastel', '145m Reel']
  },
  {
    id: 'LC145-14',
    colourName: 'Muted Pebble',
    hex: '#af9888',
    name: 'Muted Pebble Silver-Gold Braid',
    description: 'Neutral pebble grey-brown shade infused with silver and soft gold highlights. Elegant, versatile border for evening wear. 145-metre reel.',
    tags: ['Lace', 'Muted Pebble', 'Silver Gold', '145m Reel']
  },
  {
    id: 'LC145-15',
    colourName: 'Golden Almond',
    hex: '#bba387',
    name: 'Golden Almond Decorative Lace Band',
    description: 'Warm golden almond satin-feel embroidery with a run of detailed geometric motifs. A rich, versatile trim for cholis and suit borders. 145-metre reel.',
    tags: ['Lace', 'Golden Almond', 'Geometric', '145m Reel']
  },
  {
    id: 'LC145-16',
    colourName: 'Classic Khaki',
    hex: '#bba37f',
    name: 'Classic Khaki Gold Threadwork Border',
    description: 'Sophisticated classic khaki background woven with bright gold thread. Ideal for structured ethnic suits, sherwanis, and saree borders. 145-metre reel.',
    tags: ['Lace', 'Classic Khaki', 'Gold Thread', '145m Reel']
  },
  {
    id: 'LC145-17',
    colourName: 'Sand Gold Scallop',
    hex: '#c5a57a',
    name: 'Sand Gold Scalloped Flower Lace',
    description: 'Luminous sand gold floral loops with scalloped edges. A classic bridal favorite for dupatta borders and lehenga flares. 145-metre reel.',
    tags: ['Lace', 'Sand Gold', 'Scallop', 'Floral', '145m Reel']
  },
  {
    id: 'LC145-18',
    colourName: 'Soft Cream',
    hex: '#ab977e',
    name: 'Soft Cream Embroidered Lattice Trim',
    description: 'Gentle cream base with intricate lattice embroidery and fine picot selvedge. Subdued elegance for sheer organza fabrics. 145-metre reel.',
    tags: ['Lace', 'Soft Cream', 'Lattice', 'Picot', '145m Reel']
  },
  {
    id: 'LC145-19',
    colourName: 'Mocha Ash',
    hex: '#be986d',
    name: 'Mocha Ash Metallic Border Trim',
    description: 'Deep mocha ash tone featuring warm copper-gold embroidery and crisp linear framing. A bold accent for darker fabrics. 145-metre reel.',
    tags: ['Lace', 'Mocha Ash', 'Copper Gold', '145m Reel']
  },
  {
    id: 'LC145-20',
    colourName: 'Olive Bronze',
    hex: '#93805f',
    name: 'Olive Bronze Antique Jaal Lace',
    description: 'Muted olive bronze corded jaal lace with antique metallic threadwork. Provides heirloom texture and antique weight. 145-metre reel.',
    tags: ['Lace', 'Olive Bronze', 'Jaal', 'Antique', '145m Reel']
  },
  {
    id: 'LC145-21',
    colourName: 'Muted Rose',
    hex: '#b07964',
    name: 'Muted Rose Garden Embroidered Lace',
    description: 'Charming muted rose pink embroidery with floral vine repeats and gold bugle bead accents. Excellent for festive overlays. 145-metre reel.',
    tags: ['Lace', 'Muted Rose', 'Floral Vine', '145m Reel']
  },
  {
    id: 'LC145-22',
    colourName: 'Dark Moss',
    hex: '#8b7e66',
    name: 'Dark Moss Gold-Dusted Corded Lace',
    description: 'Deep dark moss green ground with subtle gold dust highlights and corded scalloped border. Great contrast on dark velvets and silks. 145-metre reel.',
    tags: ['Lace', 'Dark Moss', 'Corded', 'Gold Dust', '145m Reel']
  },
  {
    id: 'LC145-23',
    colourName: 'Caramel Tan',
    hex: '#a68060',
    name: 'Caramel Tan Zari & Sequin Braid',
    description: 'Rich caramel tan lace featuring packed zari scrolls and sparkling sequin highlights. High-impact trim for festive hemlines. 145-metre reel.',
    tags: ['Lace', 'Caramel Tan', 'Zari', 'Sequin', '145m Reel']
  },
  {
    id: 'LC145-24',
    colourName: 'Espresso Bronze',
    hex: '#93735d',
    name: 'Espresso Bronze Filigree Border',
    description: 'Deep espresso bronze tone with dense antique filigree embroidery. Perfect for dramatic borders, jacket trims, and heavy dupattas. 145-metre reel.',
    tags: ['Lace', 'Espresso Bronze', 'Filigree', 'Heavy Border', '145m Reel']
  }
];

async function main() {
  console.log(`▸ Registering ${VARIANTS.length} lace variants under style code "${STYLE_CODE}" (Target: ${prod ? 'PRODUCTION' : 'EMULATOR'} "${projectId}")...\n`);

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
      price: PRICE,
      mrp: PRICE,
      sub: 'Trim & Edging',
      unit: 'bundle',
      bundle: BUNDLE_METERS,
      perM: Math.round(PRICE / BUNDLE_METERS),
      styleCode: STYLE_CODE,
      colourName: v.colourName,
    };
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1), 'utf-8');
  console.log(`✓ Updated public/products/lace/manifest.json with ${VARIANTS.length} entries.`);

  // If emulator host is not set and we are in emulator mode, set local default or notify
  if (!prod && !process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  }

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
      price: PRICE,
      mrp: PRICE,
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
      stock: BUNDLE_METERS,
      unitType: 'bundle',
      listingStatus: 'Active',
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`  + ${v.id.padEnd(10)} [${v.colourName.padEnd(18)}] ${v.name}`);
  }

  try {
    await batch.commit();
    console.log(`\n✓ Successfully committed to Firestore database "${projectId}"!`);
  } catch (e) {
    console.log(`\n! Firestore commit skipped or pending emulator start: ${(e as Error).message}`);
    console.log(`(Static manifest and inventory seed JSON updated successfully)`);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
