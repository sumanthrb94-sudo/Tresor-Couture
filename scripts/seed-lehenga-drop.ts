/**
 * Seed the bridal lehenga-choli drop (and two sarees) into Firestore.
 *
 * Products are segregated by DESIGN via `subCategory`, so the storefront can
 * filter #/shop?category=Lehenga%20Cholis&subcategory=<design>. Each design is
 * one silhouette offered in several colourways; every colourway is its own
 * product because it is separately purchasable stock.
 *
 * Run against the EMULATOR first:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-tresor \
 *     npx tsx scripts/seed-lehenga-drop.ts
 *
 * Run against PRODUCTION (needs real Admin credentials):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json \
 *     npx tsx scripts/seed-lehenga-drop.ts --prod
 *
 * Idempotent: fixed document ids, written with merge.
 */
import { initializeApp, getApps, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROD = process.argv.includes('--prod');
const PROJECT_ID = PROD
  ? (process.env.FIREBASE_PROJECT_ID || 'tresor-couture')
  : (process.env.GCLOUD_PROJECT || 'demo-tresor');

if (!getApps().length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (PROD && raw?.trim()) {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.private_key === 'string') parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    initializeApp({ credential: cert(parsed as never), projectId: PROJECT_ID });
  } else if (PROD) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  } else {
    initializeApp({ projectId: PROJECT_ID }); // emulator needs no credentials
  }
}
const db = getFirestore();

/** One price for the whole drop. MRP is deliberately equal to the selling
 *  price: inventing a higher "was" price to manufacture a discount badge is a
 *  misleading-MRP practice, not a feature. */
const PRICE = 35999;

interface Item {
  id: string;
  name: string;
  colour: string;
  hex: string;
  photo: string;
}

interface Design {
  /** Becomes subCategory — the axis the storefront segregates on. */
  design: string;
  master: 'Lehenga Cholis' | 'Sarees';
  description: string;
  materialType: string;
  tags: string[];
  items: Item[];
}

const L = (f: string) => `/products/lehenga/${f}`;
const S = (f: string) => `/products/saree/${f}`;

const DESIGNS: Design[] = [
  {
    design: 'Zardozi Floral',
    master: 'Lehenga Cholis',
    materialType: 'Silk blend',
    tags: ['Bridal', 'Zardozi', 'Hand-embroidered'],
    description:
      'A bridal lehenga in the atelier\'s signature zardozi vocabulary: raised floral bouquets scattered across the panels, resolving into a deep border of mihrab arches worked in sequin, bead and dori. Paired with a structured boat-neck choli and a soft net dupatta finished with a scalloped, hand-worked edge. Finished with beaded latkans at the waist.',
    items: [
      { id: 'lc-zf-sage', name: 'Zardozi Floral Lehenga · Sage', colour: 'Sage Green', hex: '#8C9A7B', photo: L('zardozi-sage.jpg') },
      { id: 'lc-zf-powder-blue', name: 'Zardozi Floral Lehenga · Powder Blue', colour: 'Powder Blue', hex: '#7FB2C4', photo: L('zardozi-powder-blue.jpg') },
      { id: 'lc-zf-mauve', name: 'Zardozi Floral Lehenga · Mauve', colour: 'Mauve', hex: '#B08B9E', photo: L('zardozi-mauve.jpg') },
      { id: 'lc-zf-champagne', name: 'Zardozi Floral Lehenga · Champagne', colour: 'Champagne', hex: '#C4A882', photo: L('zardozi-champagne.jpg') },
      { id: 'lc-zf-rose', name: 'Zardozi Floral Lehenga · Rose', colour: 'Rose', hex: '#C97B76', photo: L('zardozi-rose.jpg') },
      { id: 'lc-zf-olive', name: 'Zardozi Floral Lehenga · Olive', colour: 'Olive', hex: '#8F9478', photo: L('zardozi-olive.jpg') },
      { id: 'lc-zf-rust', name: 'Zardozi Floral Lehenga · Rust', colour: 'Rust', hex: '#C0703C', photo: L('zardozi-rust.jpg') },
    ],
  },
  {
    design: 'Threadwork',
    master: 'Lehenga Cholis',
    materialType: 'Net',
    tags: ['Bridal', 'Threadwork', 'Tonal'],
    description:
      'Tone-on-tone thread embroidery worked densely across the full flare, so the pattern reads as texture rather than contrast. A sweetheart choli on wide straps, a sheer dupatta scattered with small butis, and a scalloped hem edged in the same thread. Understated at a distance, intricate up close.',
    items: [
      { id: 'lc-tw-navy', name: 'Threadwork Lehenga · Navy', colour: 'Navy', hex: '#27355E', photo: L('thread-navy.jpg') },
      { id: 'lc-tw-ivory', name: 'Threadwork Lehenga · Ivory', colour: 'Ivory', hex: '#F4F1EA', photo: L('thread-ivory.jpg') },
      { id: 'lc-tw-blush', name: 'Threadwork Lehenga · Blush', colour: 'Blush', hex: '#D9A7B0', photo: L('thread-blush.jpg') },
      { id: 'lc-tw-crimson', name: 'Threadwork Lehenga · Crimson', colour: 'Crimson', hex: '#9C1B2E', photo: L('thread-crimson.jpg') },
      { id: 'lc-tw-taupe', name: 'Threadwork Lehenga · Taupe', colour: 'Taupe', hex: '#B2A491', photo: L('thread-taupe.jpg') },
    ],
  },
  {
    design: 'Pearl Strand',
    master: 'Lehenga Cholis',
    materialType: 'Net',
    tags: ['Bridal', 'Pearl', 'Hand-embroidered'],
    description:
      'Vertical strands of pearl and bead fall the length of the skirt, opening into a hand-worked floral field at the hem. A scoop-neck choli edged in pearl drops, with a matching net dupatta bordered in the same strand work.',
    items: [
      { id: 'lc-ps-antique-gold', name: 'Pearl Strand Lehenga · Antique Gold', colour: 'Antique Gold', hex: '#B5883F', photo: L('pearl-antique-gold.jpg') },
    ],
  },
  {
    design: 'Ivory Heritage',
    master: 'Lehenga Cholis',
    materialType: 'Net',
    tags: ['Bridal', 'White-on-white', 'Hand-embroidered'],
    description:
      'White-on-white throughout: geometric jaal across the skirt panels resolving into a dense floral border, all worked in matte thread and pearl on ivory. A sleeveless boat-neck choli and a sheer dupatta scattered with pearl motifs. Made for a daytime or Christian ceremony.',
    items: [
      { id: 'lc-ih-ivory', name: 'Ivory Heritage Lehenga · Ivory', colour: 'Ivory', hex: '#F2EFE7', photo: L('pearl-ivory.jpg') },
    ],
  },
  {
    // NOT lehenga cholis — these two are pre-draped sarees and are listed as such.
    design: 'Pre-draped Saree',
    master: 'Sarees',
    materialType: 'Georgette',
    tags: ['Pre-draped', 'Ready to wear', 'Occasion'],
    description:
      'A ready-to-wear pre-draped saree with a stitched pleat fall, worn with a matching blouse. No pinning, no petticoat — step in and fasten.',
    items: [
      { id: 'sr-pd-crimson', name: 'Pre-draped Sequin Saree · Crimson', colour: 'Crimson', hex: '#B01029', photo: S('sequin-crimson.jpg') },
      { id: 'sr-pd-lilac', name: 'Pre-draped Floral Saree · Lilac', colour: 'Lilac', hex: '#A992BE', photo: S('floral-lilac.jpg') },
    ],
  },
];

async function main(): Promise<void> {
  console.log(`Seeding drop into ${PROD ? 'PRODUCTION' : 'EMULATOR'} project "${PROJECT_ID}" at ₹${PRICE.toLocaleString('en-IN')}\n`);

  let n = 0;
  const batch = db.batch();
  for (const d of DESIGNS) {
    console.log(`  ${d.design} (${d.master}) — ${d.items.length} colourway${d.items.length > 1 ? 's' : ''}`);
    for (const it of d.items) {
      batch.set(db.collection('products').doc(it.id), {
        id: it.id,
        brand: 'TRESOR COUTURE',
        name: it.name,
        description: d.description,
        price: PRICE,
        mrp: PRICE,
        photo: it.photo,
        photoGallery: [it.photo],
        image: it.photo,
        gallery: [it.photo],
        category: d.master,
        masterCategory: d.master,
        subCategory: d.design,
        materialType: d.materialType,
        tags: [...d.tags, it.colour],
        colors: [{ name: it.colour, hex: it.hex }],
        stock: 5,
        unitType: 'unit',
        sticker: 'New In',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      console.log(`      ${it.id.padEnd(22)} ${it.colour}`);
      n += 1;
    }
  }
  await batch.commit();

  const lehengas = DESIGNS.filter(d => d.master === 'Lehenga Cholis').reduce((s, d) => s + d.items.length, 0);
  const sarees = n - lehengas;
  console.log(`\nDone. ${n} products written — ${lehengas} lehenga cholis, ${sarees} sarees.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
