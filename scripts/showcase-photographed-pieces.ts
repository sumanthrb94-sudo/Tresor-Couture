/**
 * One-off (Oct 2026): give the 13 studio-photographed pieces names and copy that
 * match their photographs, and feature them on the home page.
 *
 *   npx tsx scripts/showcase-photographed-pieces.ts --prod            # dry run
 *   npx tsx scripts/showcase-photographed-pieces.ts --prod --apply    # LIVE write
 *
 * Several records had been named from a stock sheet that did not match the
 * piece photographed — three women's jacket-and-palazzo sets were listed as
 * "SHERWANI" with copy about the groom's side, a pink mini dress as "LEATHER
 * HALF PIECE" — and four still carried the placeholder "DESIGNER WEAR". The
 * photograph is what a shopper buys from, so the words follow it. Copy states
 * only what the photograph shows: silhouettes, colours and visible work, never
 * a fibre or a technique that cannot be seen.
 *
 * Codes, prices, stock and barcodes are not touched. Every write is guarded by
 * the product code it expects, so a re-used id can never be renamed by mistake.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { initAdmin } from './lib/admin';

interface Piece { code: string; name: string; description: string }

const PIECES: Record<string, Piece> = {
  r65fmQvIz9HhrPOCuEJs: {
    code: 'SP001',
    name: 'Emerald Floral Peplum Palazzo Set with Cape Drape',
    description: '', // keeps the photo-led copy written on 11 Oct
  },
  IUL88rw0TWRPZWiSOGZM: {
    code: 'SP002',
    name: 'Midnight Navy Embroidered Waistcoat Set with Cape Drape',
    description: '',
  },
  '8w4fZLec0X0x3mtBev7B': {
    code: 'SP3004',
    name: 'Lime Halter Maxi Dress with Embroidered Yoke',
    description: '', // existing copy already describes this piece
  },
  v0A6LTOTzbr6EW6e66qt: {
    code: 'SP003',
    name: 'Dusty Rose One-Shoulder Draped Designer Set',
    description: '',
  },
  ckQtUVj8vSwGiL6fN6I6: {
    code: 'LC4016',
    name: 'Black Sequinned Halter Mini Dress',
    description: '',
  },
  '7DxezWIwC9qBu8AEcXrC': {
    code: '3PC001',
    name: 'Peach Embroidered Jacket & Palazzo Three-Piece Set',
    description:
      'A soft three-piece set in warm peach. The longline jacket is the star: worked down the front with floral embroidery in tonal pinks, greens and gold, finished with flared, ruffle-edged sleeves that move as you do. Underneath sits a matching top, and the look is completed by wide palazzo trousers in the same peach, cut with an easy, floor-skimming fall. The colour is gentle enough for daytime functions — haldi, mehendi, a family puja — and the embroidery gives it enough presence for an evening. Wear the jacket open over the set as shown, or try the palazzos with a plain top for a lighter look. Style with pastel or gold jewellery and flat juttis or block heels. One piece available.',
  },
  nC4bfSZ5eKgfkJXjjZXF: {
    code: '3PC002',
    name: 'Mint Embroidered Jacket & Palazzo Three-Piece Set',
    description:
      'A fresh three-piece set in pale mint green. The longline jacket carries floral embroidery down both fronts in soft pink, ivory and green, with flared, ruffle-edged sleeves for movement. It layers over a matching top and wide-leg palazzo trousers in the same mint, so the whole look reads as one clean column of colour. Light and festive at once, it suits mehendi, haldi, daytime weddings and summer celebrations. Keep the jacket on for the full effect, or wear the top and palazzos on their own for an easier day. Pair with silver or pearl jewellery and flat sandals or juttis. One piece available.',
  },
  zwtpJJtp8n3atGb79NST: {
    code: '3PC003',
    name: 'Blush Pink Crop Top, Skirt & Sheer Jacket Three-Piece Set',
    description:
      'A romantic three-piece set in blush pink. A fitted crop top with delicate detailing pairs with a long, flowing skirt, and over both falls a sheer longline jacket with soft, wide sleeves that drapes like a cape when you walk. Everything is in the same tone of pink, so the look is graceful and unfussy, letting the movement of the layers do the work. Made for sangeet nights, engagement parties, cocktail evenings and festive dinners. Style with diamond-look or kundan earrings and a heeled sandal, and keep the rest minimal. One piece available.',
  },
  p0hp79PeaG43XQK4czcL: {
    code: 'TC1002',
    name: 'Rose Pink Embellished Straight Kurta & Trouser Set',
    description:
      'An elegant straight-cut kurta set in rose pink. The kurta is long and clean in line, embellished across the body with small, evenly scattered motifs that catch the light, and finished with full-length sleeves and a neat neckline. It is paired with matching straight trousers in the same pink, so the silhouette stays long and lean from shoulder to ankle. Easy to wear for festive lunches, pujas, office celebrations and family functions, and simple to dress up with a dupatta and statement earrings for an evening. Pairs well with flat juttis or a low heel. One piece available.',
  },
  '8muLczdiJdDiUhr0ktr8': {
    code: 'tc1001',
    name: 'Emerald Green Embroidered Peplum Kurta & Sharara Set with Dupatta',
    description:
      'A festive three-piece set in rich emerald green. The kurta is cut in the masakali style — fitted through the bodice and flaring into a full, gathered peplum — with a gold-embroidered yoke and keyhole neckline, and embroidered borders at the sleeves. It is paired with flared sharara trousers that ripple from the knee, and finished with a sheer green dupatta edged in embroidery. A classic, celebratory silhouette for Eid, Diwali, weddings and sangeet nights. Style with gold or polki jewellery and embroidered juttis. One piece available.',
  },
  dUARnpF8091ZVgIVLqtd: {
    code: 'TC2007',
    name: 'Chocolate Brown Halter Neck Open-Back Mini Dress',
    description: '',
  },
  '4Lcwqh9OSQKw4DBI0U5R': {
    code: 'TC2005',
    name: 'Pink Metallic Mini Slip Dress',
    description:
      'A playful mini dress in high-shine metallic pink. Cut as a slip with thin straps and a straight neckline, it skims the body and stops above the knee, and the glossy finish catches every light in the room — so it needs very little help to make an entrance. Made for birthday nights, parties and cocktail evenings. Wear it with strappy heels and minimal silver jewellery, or throw a black blazer over it to balance the shine. One piece available.',
  },
  '1esXzU1ndtviNMo1Axqw': {
    code: 'TC2017',
    name: 'Champagne Cowl Neck Satin-Look Slip Dress',
    description:
      'A fluid, floor-grazing slip dress in a soft champagne tone with a liquid sheen. The cowl neckline drapes gently at the front, thin straps keep the shoulders clean, and the skirt falls straight and long, so the dress moves like water when you walk. Understated and quietly glamorous, it suits cocktail evenings, receptions, dinners and black-tie events. Let it stand on its own with delicate gold jewellery and strappy heels, or add a cropped jacket for cooler evenings. One piece available.',
  },
};

async function main() {
  const apply = process.argv.includes('--apply');
  const { db, prod } = initAdmin();
  console.log(`${prod ? 'LIVE' : 'emulator'} — ${apply ? 'APPLYING' : 'dry run, nothing written'}\n`);
  let done = 0;
  for (const [id, p] of Object.entries(PIECES)) {
    const ref = db.doc(`products/${id}`);
    const snap = await ref.get();
    const f = snap.data();
    if (!f) { console.log(`✗ ${id} not found`); continue; }
    if (String(f.productCode).toLowerCase() !== p.code.toLowerCase()) {
      console.log(`✗ ${id} code is ${f.productCode}, expected ${p.code} — skipped`);
      continue;
    }
    const patch: Record<string, unknown> = { name: p.name, featured: true };
    if (p.description) patch.description = p.description;
    console.log(`• ${p.code.padEnd(7)} "${f.name}" → "${p.name}"${p.description ? ' + new description' : ''} + featured`);
    if (apply) await ref.update({ ...patch, updatedAt: FieldValue.serverTimestamp() });
    done += 1;
  }
  console.log(`\n${done} product${done === 1 ? '' : 's'} ${apply ? 'updated' : 'would be updated'}.`);
}

main().catch(e => { console.error(e); process.exit(1); });
