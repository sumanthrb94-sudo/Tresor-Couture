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

/**
 * Drafts have no photographs and no record beyond a code and a price, so the
 * copy says only what is true of every Studios Prêt piece and stays true after
 * the photograph is added (adding one auto-publishes a draft — "awaiting
 * photos" wording would go live). No fabric, embroidery or colour is claimed;
 * no price is written into the text, so a repricing cannot make it wrong.
 * Each opens differently so no two pages carry identical copy.
 */
const closing =
  ' Every piece in the Studios Prêt line is made in very small numbers, so what you see is what exists. ' +
  'If you would like measurements, close-up images or help choosing a size, message the studio from the chat on this page and we will walk you through the fit and how to style it.';

const DRAFT: Record<string, string> = {
  Q3HCeAPZuODPamq2fs0K:
    'Style SP3001 is a designer piece from the Tresor Couture Studios Prêt collection — curated, occasion-ready dressing from the city studio. It is cut for the kind of evening where the outfit is noticed before you speak: a defined silhouette, clean finishing and a fall that holds its shape as you move. Wear it with statement earrings and a simple heel and let the garment do the talking.' + closing,
  nW37TLBadBR6mLbS21ez:
    'From the Tresor Couture Studios Prêt collection, style SP3002 is designed for weddings, receptions and festive evenings. The studio builds these pieces around proportion and finish rather than excess, so they photograph well, sit comfortably through a long event and can be restyled with different jewellery for the next one.' + closing,
  sG6ylDCxFG2jAhTBwtbU:
    'Style SP3003 comes from the Studios Prêt line at Tresor Couture, where designer pieces are curated for celebrations and made to be worn more than once. It is a considered, finished garment meant for sangeet nights, cocktail evenings and family occasions — dressed up with traditional jewellery or kept understated with minimal accessories.' + closing,
  WhU7RX3J65A1AFbwK0f9:
    'Style SP004 is part of the Tresor Couture Studios Prêt collection: designer dressing that is easy to wear and still feels like an occasion. It suits festive lunches, family functions and evenings out, and pairs readily with pieces you already own — a dupatta, a jacket or good jewellery are all it needs.' + closing,
  ontWxwycjvz8QnaI3rW0:
    'Designer wear from the Tresor Couture Studios Prêt collection, style TC1006. A practical entry into the line: a studio-finished garment for festive days, dinners and gatherings, with enough presence to stand alone and enough versatility to be styled up or down. Choose it when you want something polished without the weight of full bridal dressing.' + closing,
  r3dueAZaI7Rv3h78dQv7:
    'Style TC1008 is a Studios Prêt designer piece from Tresor Couture, made for the occasions that fall between everyday and grand: pujas, family celebrations, engagement parties and evenings with friends. It is finished in the studio with the same attention as the rest of the line, and styles equally well with gold, oxidised or pearl jewellery.' + closing,
  g8Lx9UTWCfNVlGfe1lpn:
    'Style LC0003 sits at the statement end of the Tresor Couture Studios Prêt collection — a designer piece intended for the occasions people dress for months ahead: weddings, receptions and milestone celebrations. It is made for presence, in the way it is cut, finished and worn, and is best paired with considered, minimal accessories so that the garment remains the focus of the look.' + closing,
  sHDFL3zzZRkRp8DkCA38:
    'Style LC4015 is western wear from the Tresor Couture Studios Prêt collection, for days and evenings when you want a contemporary silhouette from an atelier known for occasion dressing. Designed to move between brunches, dinners and celebrations, it takes to a sharp heel and statement earrings as easily as flats and a clean, minimal look.' + closing,
  V6APecfadJ7ePgR6vD6X:
    'Style LC0004 is a One Minute Saree from the Tresor Couture studio: a saree designed to be worn without the long business of draping, so you get the grace of a saree in the time it takes to get dressed. It suits weddings, festive evenings and occasions where you want the elegance of a saree with the ease of a ready-to-wear outfit. Made in very small numbers. Message the studio from the chat on this page for measurements, close-up images and help with fit and styling.',
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
