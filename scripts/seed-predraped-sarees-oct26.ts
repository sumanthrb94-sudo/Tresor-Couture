/**
 * One-off (16 Oct 2026): list the five pre-draped / sequinned sarees shot on
 * 16 Oct — two from WhatsApp videos (stills taken from the video, and the video
 * itself shown after them), three from photographs.
 *
 *   npx tsx scripts/seed-predraped-sarees-oct26.ts --prod            # dry run
 *   npx tsx scripts/seed-predraped-sarees-oct26.ts --prod --apply    # LIVE write
 *
 * The prices in the chat are SELLING prices; the buying price is half of the
 * selling price. MRP equals price — no invented "was" price.
 *
 * Idempotent: a product code that already exists is skipped. Barcodes come
 * from counters/barcodes in a transaction, the same series the admin console
 * uses.
 */
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { initAdmin } from './lib/admin';
import { formatBarcode } from './lib/barcodes';

interface Piece {
  code: string;
  name: string;
  /** Selling price, as given in the chat. */
  price: number;
  gallery: number;
  /** Short MP4 of the piece being worn, shown after the photos. */
  video?: string;
  description: string;
}

const PIECES: Piece[] = [
  {
    code: 'PDS001',
    name: 'Midnight Navy Satin Pre-Draped Saree with Embellished Sheer Bralette',
    price: 26000,
    gallery: 3,
    video: '/products/video/PDS001.mp4',
    description:
      'A ready-to-wear saree in deep midnight navy with a liquid satin sheen. The pleats and pallu come pre-draped, so it goes on in minutes and stays exactly where it should all evening; the pallu falls long from the shoulder and the pleats sweep the floor. The blouse is the statement: a sheer bralette with structured cups, strappy shoulders and a sweetheart neckline, worked all over with beads, sequins and floral embellishment, and finished at the hem with a row of beaded fringe that moves as you do. Made for cocktail nights, sangeet, receptions and evening weddings. Style with chandelier or statement gold earrings and keep the neck bare to let the blouse do the talking. One piece available.',
  },
  {
    code: 'PDS002',
    name: 'Champagne Satin Pre-Draped Saree with Sequinned Half-Sleeve Blouse',
    price: 26000,
    gallery: 3,
    video: '/products/video/PDS002.mp4',
    description:
      'A pre-draped saree in soft champagne taupe with a glossy satin finish. The pleats are stitched in place and the pallu is set over the shoulder, so the drape is perfect from the first wear with none of the pinning. It is paired with a half-sleeve blouse densely worked in silver sequins and beadwork, cut with a sweetheart neckline and a cropped hem. The muted, metallic palette reads elegant rather than loud — right for receptions, engagements, cocktail evenings and festive dinners. Pair with pearl or diamond-look drop earrings, a slim bracelet and a sleek bun. One piece available.',
  },
  {
    code: 'PDS003',
    name: 'Navy Sequinned Net Pre-Draped Saree with Fringed Blouse',
    price: 16000,
    gallery: 1,
    description:
      'A pre-draped saree in navy net, covered from pleat to pallu in tonal sequins and threadwork so the whole drape shimmers with every step. The pleats fall straight and full to the floor and the pallu trails long behind the shoulder. It comes with a matching sleeveless blouse with a V-neckline, finished at the hem with a fringe of sequinned strands that sits over the waist. Dark, rich and glamorous for evening weddings, receptions and cocktail parties. Style with statement earrings in silver or gold and a clutch. One piece available.',
  },
  {
    code: 'PDS004',
    name: 'Champagne Gold Sequinned Net Pre-Draped Saree',
    price: 16000,
    gallery: 0,
    description:
      'A pre-draped saree in pale champagne gold net, sequinned all over in a fine, scattered pattern that catches the light softly rather than blazing. The pleats are set and fall straight to the floor, and the pallu drapes from the shoulder in a long, sheer sweep. It is paired with a matching sequinned blouse in the same tone, so the look reads as one luminous column. Light and festive, it suits engagements, receptions, day-to-evening weddings and cocktail parties. Pair with gold or polki earrings and nude heels. One piece available.',
  },
  {
    code: 'PDS005',
    name: 'Plum Sequinned Net Pre-Draped Saree',
    price: 15000,
    gallery: 0,
    description:
      'A pre-draped saree in deep plum purple net, embellished all over in tonal sequins for a rich, jewel-toned shimmer. The pleats are stitched in place and fall to the floor, and the pallu drapes long from the shoulder for an easy, finished look that needs no pinning. It comes with a matching sequinned sleeveless blouse. A striking colour for sangeet nights, receptions, cocktail parties and festive evenings. Style with silver or diamond-look jewellery and a metallic clutch. One piece available.',
  },
];

async function reserveBarcode(db: Firestore): Promise<string> {
  const ref = db.doc('counters/barcodes');
  return db.runTransaction(async tx => {
    const cur = await tx.get(ref);
    const n = Number(cur.data()?.next ?? 1);
    tx.set(ref, { next: n + 1 }, { merge: true });
    return formatBarcode(n);
  });
}

async function main() {
  const apply = process.argv.includes('--apply');
  const { db, prod } = initAdmin();
  console.log(`${prod ? 'LIVE' : 'emulator'} — ${apply ? 'APPLYING' : 'dry run, nothing written'}\n`);

  for (const p of PIECES) {
    const dup = await db.collection('products').where('productCode', '==', p.code).limit(1).get();
    if (!dup.empty) { console.log(`= ${p.code} exists as ${dup.docs[0].id} — skipped`); continue; }

    const price = p.price;
    const cost = p.price / 2;
    const photo = `/products/${p.code}-main.webp`;
    const photoGallery = Array.from({ length: p.gallery }, (_, i) => `/products/${p.code}-g${i + 1}.webp`);
    console.log(`+ ${p.code} "${p.name}" ₹${price} (cost ₹${cost}), ${1 + p.gallery} photo(s)${p.video ? ' + video' : ''}`);
    if (!apply) continue;

    const ref = db.collection('products').doc();
    await ref.set({
      id: ref.id,
      brand: 'TRESOR',
      name: p.name,
      description: p.description,
      price,
      mrp: price,
      costPrice: cost,
      photo,
      photoGallery,
      image: photo,
      ...(p.video ? { video: p.video } : {}),
      masterCategory: 'Sarees',
      category: 'Sarees',
      subCategory: 'Pre-draped Saree',
      productCode: p.code,
      tags: ['Sarees', 'Pre-draped Saree', 'Sequinned'],
      stock: 1,
      barcode: await reserveBarcode(db),
      listingStatus: 'Active',
      featured: true,
      bundlePrice: null,
      bundleSizeMeters: null,
      sellingPricePerMeter: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const back = (await ref.get()).data()!;
    console.log(`  → ${ref.id}  ${back.barcode}  https://tresorcouture.in/product/${ref.id}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
