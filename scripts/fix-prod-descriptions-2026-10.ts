/**
 * One-off production clean-up (Oct 2026): real descriptions for the "DESIGNER
 * WEAR" / "WESTERN WEAR" placeholders, and retire the four `test*` products.
 *
 *   npx tsx scripts/fix-prod-descriptions-2026-10.ts            # dry run, writes nothing
 *   npx tsx scripts/fix-prod-descriptions-2026-10.ts --apply    # LIVE write
 *
 * The two live pieces (SP001, SP002) are described from their photographs; the
 * nine photo-less drafts get honest copy that claims no fabric or embroidery.
 * Only touches a doc whose description is still a placeholder / whose name still
 * starts with "test". Needs GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT.
 */
import { initAdmin } from './lib/admin';
import { isPlaceholderDescription } from '../src/lib/productCopy';
import { FieldValue } from 'firebase-admin/firestore';

const LIVE: Record<string, string> = {
  // SP001 — emerald floral peplum set, ₹7,790 (written from the product photographs)
  r65fmQvIz9HhrPOCuEJs:
    'A three-piece Studios Prêt set in deep emerald, built around a floral peplum top. The bodice is printed in a spray of cream, blush and gold blooms on a rich green ground, with a sweetheart neckline finished in delicate embellishment along the bust and slim straps that keep the line light. The top flares into a gently gathered peplum, and a row of small beaded drops swings along the hem so the piece catches the light as you move. It is paired with wide-leg palazzo trousers in matching solid emerald, cut with a generous sweep that moves beautifully and lengthens the leg. A sheer drape in the same green falls from the shoulders down the back and sides like a cape, adding the finishing movement that turns a simple co-ord into occasion dressing. Styled here for evenings, festive gatherings, sangeet and cocktail nights, it works with gold or kundan jewellery and a low heel. One piece only — once it is gone, it is gone. Part of the Tresor Couture Studios Prêt designer line.',
  // SP002 — navy embroidered waistcoat set, ₹13,800
  IUL88rw0TWRPZWiSOGZM:
    'A statement Studios Prêt set in deep midnight navy, designed around an embroidered waistcoat-style top. The cropped front is worked in multicoloured floral embroidery — pink, green and ivory blooms with gold detailing and small mirror-style accents — set against the dark navy so every motif stands out. A keyhole opening at the front and a matching embroidered choker-style collar give the neckline a sharp, tailored finish, while the back carries a richly worked panel, so the piece looks as considered from behind as it does from the front. Below it falls a long, fluid navy skirt with a full sweep that moves gracefully when you walk. A sheer navy drape floats from the shoulders in a cape effect, softening the structure of the top and adding length and drama. Made for weddings, receptions, sangeet and festive evenings, it needs little more than statement earrings and a clutch. One piece only. Part of the Tresor Couture Studios Prêt designer line, finished in the studio.',
};

const lead = (tier: string, code: string) =>
  `This is a one-of-one designer piece from the Tresor Couture Studios Prêt line (style ${code}), ${tier}.`;
const body =
  ' Studios Prêt is where the atelier brings together considered cuts, fine finishing and occasion-ready silhouettes, made in very small numbers rather than by the hundred. This piece is currently registered in the studio and awaiting its photographs, which will show the cut, colour, embroidery and fall in detail. Until then, the best way to see it is to ask us: message the studio and we will share close-up images and measurements, and talk you through sizing, fit adjustments and how it can be styled for your occasion. Because only a single piece exists, we hold it for you while we confirm details, and it is dispatched with careful packing and tracked delivery.';

const DRAFT: Record<string, string> = {
  Q3HCeAPZuODPamq2fs0K: lead('priced at ₹15,104, in our occasion-wear range', 'SP3001') + body,
  nW37TLBadBR6mLbS21ez: lead('priced at ₹14,438, in our occasion-wear range', 'SP3002') + body,
  sG6ylDCxFG2jAhTBwtbU: lead('priced at ₹13,600, in our occasion-wear range', 'SP3003') + body,
  WhU7RX3J65A1AFbwK0f9: lead('priced at ₹8,999, in our everyday-luxe range', 'SP004') + body,
  ontWxwycjvz8QnaI3rW0: lead('priced at ₹6,150, in our everyday-luxe range', 'TC1006') + body,
  r3dueAZaI7Rv3h78dQv7: lead('priced at ₹6,150, in our everyday-luxe range', 'TC1008') + body,
  g8Lx9UTWCfNVlGfe1lpn: lead('priced at ₹26,000, among the most elaborate pieces in the line', 'LC0003') + body,
  sHDFL3zzZRkRp8DkCA38:
    'This is a one-of-one western-wear piece from the Tresor Couture Studios Prêt line (style LC4015), priced at ₹7,999, for those who want a contemporary silhouette from an atelier known for Indian occasionwear.' + body.replace('occasion-ready silhouettes', 'contemporary silhouettes'),
  V6APecfadJ7ePgR6vD6X:
    'This is a one-of-one ready-to-wear saree from the Tresor Couture Studios Prêt line (style LC0004), priced at ₹24,000, from the One Minute Saree edit — a saree designed to be worn without the long business of draping it. Studios Prêt brings together considered cuts, fine finishing and occasion-ready silhouettes, made in very small numbers rather than by the hundred. This piece is currently registered in the studio and awaiting its photographs, which will show the colour, work and fall in detail. Until then, message the studio and we will share close-up images and measurements and help you with sizing and styling for your occasion. Because only a single piece exists, we hold it for you while we confirm details, and it is dispatched with careful packing and tracked delivery.',
};
const RETIRE = ['JjGb0kX82hADSSIinREq', 'eHB2YiJJ4561kF1MaaaR', 'odcGp3sbXk2kSn8mu3k1', 'yMuaMmncHIi0kQvzzll6'];

(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = initAdmin(['--prod']);
  console.log(apply ? 'LIVE — APPLYING' : 'dry run — nothing written');
  for (const [id, text] of Object.entries({ ...LIVE, ...DRAFT })) {
    const ref = db.doc(`products/${id}`);
    const f = (await ref.get()).data()!;
    if (!isPlaceholderDescription(f.description)) { console.log('SKIP (already has real copy)', id); continue; }
    if (apply) await ref.update({ description: text, updatedAt: FieldValue.serverTimestamp() });
    console.log('described', id, f.listingStatus, `${text.split(/\s+/).length} words`);
  }
  for (const id of RETIRE) {
    const ref = db.doc(`products/${id}`);
    const f = (await ref.get()).data()!;
    if (!/^test/i.test(String(f.name))) { console.log('SKIP (not a test product)', id, f.name); continue; }
    if (apply) await ref.update({ listingStatus: 'Retired', updatedAt: FieldValue.serverTimestamp() });
    console.log('retired', id, f.name, '(was', f.listingStatus + ')');
  }
})();
