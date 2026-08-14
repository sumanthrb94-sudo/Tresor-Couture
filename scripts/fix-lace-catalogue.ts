/**
 * Catalogue rescue for the 34 legacy lace/trim products.
 *
 * What this fixes, per product:
 *  - name: was the bare stock code ("HA3858"); now what the piece actually is,
 *    written from the photograph. The code moves to productCode.
 *  - description: was one shared boilerplate paragraph (with one leaked
 *    importer note); now distinct copy grounded in the visible material.
 *  - photo: was a base64 data URI inside the Firestore document (uncacheable,
 *    invisible to image search, bloating every read); now a real file under
 *    /products/lace/, mozjpeg-compressed.
 *  - mrp: was price ÷ 0.7 to the paisa — a computed discount that never
 *    existed; now equal to price.
 *
 * Idempotent: fixed ids, merge writes. Emulator by default, --prod for real.
 *   GOOGLE_APPLICATION_CREDENTIALS=… npx tsx scripts/fix-lace-catalogue.ts --prod
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
    initializeApp({ projectId: PROJECT_ID });
  }
}
const db = getFirestore();

interface Fix {
  id: string;
  name: string;
  description: string;
  tags: string[];
  /** Photo needs a proper reshoot (warehouse snapshot, hand/label in frame). */
  reshoot?: boolean;
}

/** Copy written from the actual photographs — see the session's image review. */
const FIXES: Fix[] = [
  { id: '6343', name: 'Ivory Pearl Bouquet Bridal Border',
    description: 'A wide ivory net border worked with velvet floral bouquets, seed pearls, silver zari leaves and sequin sprays, finishing in a softly scalloped edge with a sequin-run header. A full 9-metre reel — enough for a lehenga hem or a dupatta on all sides.',
    tags: ['Bridal', 'Pearl', 'Border', 'Ivory'] },
  { id: '6988', name: 'Magenta Gota Braid with Pearl Rows',
    description: 'A narrow magenta satin band carrying antique-gold wire scrollwork, a run of half-pearls and a fine gold chain along the footing. A classic gota-style braid for sleeve cuffs, necklines and dupatta edges. 9-metre reel.',
    tags: ['Gota', 'Magenta', 'Braid'] },
  { id: 'HA3858', name: 'Champagne Sequin Encrusted Band',
    description: 'Densely packed champagne-gold sequins on a nude net base — the whole band reads as one strip of shimmer. Cut it for blouse borders, waistbands or a lehenga hem that catches every light. 9-metre reel.',
    tags: ['Sequin', 'Champagne', 'Band'] },
  { id: 'HA4536', name: 'Pastel Deco Beadwork Border',
    description: 'A wide statement border of overlapping deco arches: turquoise, lilac, peach and taupe bugle beads laid in fans, edged with pearl strings, rhinestone chain and butter-yellow threadwork on beige net. Sold as a 3-metre length — one showpiece border.',
    tags: ['Beaded', 'Pastel', 'Statement', 'Border'] },
  { id: 'HA6293', name: 'Ivory Guipure Daisy Lace with Pearls',
    description: 'Free-standing guipure star-flowers in ivory, each centred with a pearl cluster and dressed with crystal beads and sequins, linked petal-to-petal with bead drops along both edges. 8-metre reel of true cutwork lace — no net backing to trim away.',
    tags: ['Guipure', 'Ivory', 'Pearl', 'Bridal'] },
  { id: 'HA6320', name: 'Berry Garden Dimensional Floral Trim',
    description: 'A joyful, dimensional trim: white organza blossoms rise off grey net between beaded berries in orange, cobalt, raspberry and lime, with fern leaves in green thread and a trailing pearl vine. Sold as a 3-metre length for necklines and hem features.',
    tags: ['3D Floral', 'Multicolour', 'Organza'] },
  { id: 'HA6378', name: 'Soft Chantilly Scallop Lace · White', reshoot: true,
    description: 'Soft white corded lace with rounded scallop repeats and a fine floral fill, supplied as generous scalloped panels. A 10-metre reel for overlays, veils and sleeve work.',
    tags: ['Chantilly', 'White', 'Bridal'] },
  { id: 'HA6387', name: 'Blush Iridescent Floral Net Border',
    description: 'Tone-on-tone blush flowers outlined in dusty-rose thread, their petals filled with iridescent sequins and pastel bugle-bead rays that shift pink, mint and lilac as the light moves. On blush net, 10-metre reel.',
    tags: ['Blush', 'Iridescent', 'Floral', 'Border'] },
  { id: 'HA6674', name: 'Mint Fan Scallop Beaded Trim',
    description: 'Arched fans of silver bugle beads and sequins on mint net, each scallop dressed with mint pearls and finished with crystal and pearl drops along the edge. Cool, icy and light. 9.5-metre reel.',
    tags: ['Mint', 'Beaded', 'Scallop'] },
  { id: 'HA6758', name: 'Royal Purple Zari Sari Border',
    description: 'A wide royal-purple satin border carrying dense antique-gold zari: a scalloped fan edge, beadwork medallions, sequin runs and a corded centre line. Made for sari falls and lehenga hems that want traditional weight. 9-metre reel.',
    tags: ['Zari', 'Purple', 'Sari Border', 'Traditional'] },
  { id: 'HA6767', name: 'Navy & Gold Picot Ribbon',
    description: 'Navy satin-twill ribbon with a looped antique-gold picot cord worked along one edge over a run of scalloped gold discs. A quiet, tailored trim for pipings, plackets and dupatta edges. 9-metre reel.',
    tags: ['Navy', 'Gold', 'Ribbon'] },
  { id: 'HA6790', name: 'Coral Vine Embroidered Organza Ribbon',
    description: 'A sheer champagne organza ribbon embroidered with a trailing coral-and-peach floral vine, dotted with seed pearls, gold bugle beads and crystal accents. Delicate enough for necklines and baby hems. 9-metre reel.',
    tags: ['Coral', 'Organza', 'Embroidered'] },
  { id: 'HA6979', name: 'Black & Gold Jewelled Gimp Trim',
    description: 'A black woven band where antique-gold cord loops frame amber and smoke crystals, alternating with small pearls — jewellery rendered as trim. Striking on velvet and festive black. 9-metre reel.',
    tags: ['Black', 'Gold', 'Jewelled'] },
  { id: 'HA6988', name: 'Maroon Pearl Medallion Braid',
    description: 'A maroon ground carrying gold crochet rings set with pearls down the centre, edged with a scalloped run of gold fans, each with its own pearl heart. Rich, temple-border colouring. 9-metre reel.',
    tags: ['Maroon', 'Pearl', 'Braid', 'Traditional'] },
  { id: 'HA7018', name: 'Peach Daisy Chain Beaded Ribbon',
    description: 'Sheer peach organza carrying a gold beaded vine: daisy medallions with olive thread centres, crystal teardrops, pearl sprays and bugle-bead leaves. Sweet without being sugary. 9-metre reel.',
    tags: ['Peach', 'Beaded', 'Floral'] },
  { id: 'MI263', name: 'Champagne Mirror-Work Trim', reshoot: true,
    description: 'Rows of small round mirrors set on champagne-gold braid — classic shisha sparkle by the metre for ghagras, jackets and festive borders. Generous 18-metre reel.',
    tags: ['Mirror Work', 'Champagne', 'Festive'] },
  { id: 'MO2029', name: 'Cream Crystal Drop Fringe',
    description: 'A pale cream tulle header strung with pearls, dropping short tassels of faceted crystal and seed beads that swing as the wearer moves. For dupatta ends, blouse sleeves and hemlines that should move. 9-metre reel.',
    tags: ['Fringe', 'Crystal', 'Cream'] },
  { id: 'MO3188', name: 'Antique Gold Filigree Lattice Braid',
    description: 'A crocheted antique-gold braid worked in a crossing lattice, with pearls seated along the weave and a beaded selvedge. Reads as heirloom metalwork. 18-metre reel.',
    tags: ['Gold', 'Filigree', 'Braid'] },
  { id: 'MO3392', name: 'Pearl Lattice Organza Trim · Silver',
    description: 'A sheer organza ribbon carrying a crisscross lattice of silver bugle beads with a full pearl string along one edge — bridal-white sparkle with real structure. 7-metre reel.',
    tags: ['Pearl', 'Silver', 'Bridal'] },
  { id: 'MO3650', name: 'Champagne Teardrop Crystal Fringe',
    description: 'Faceted champagne teardrop crystals hang from beaded stems along a sheer organza header — a fine chandelier fringe for dupatta ends and saree pallus. 9-metre reel.',
    tags: ['Fringe', 'Crystal', 'Champagne'] },
  { id: 'MO3857', name: 'Sage Petal Drop Edging',
    description: 'A sage-green net edging with a short beaded fringe: clear crystal drops finished with tiny sequin petals in sage, mint and lilac. Subtle movement for pastel palettes. 9-metre reel.',
    tags: ['Sage', 'Fringe', 'Pastel'] },
  { id: 'NE1386', name: 'Midnight Beaded Neckline Appliqué',
    description: 'A curved neckline appliqué worked entirely in black — beaded florals, sequin petals and corded scrolls on fine net, edged with picot beading. Stitch it to a blouse or gown neckline for instant couture depth. Sold per piece.',
    tags: ['Neckline', 'Appliqué', 'Black', 'Evening'] },
  { id: 'NE1386-S31', name: 'Orchid & Sage Beaded Neckline Appliqué',
    description: 'A V-neckline appliqué in orchid pink and sage: velvet petals, pearl flower hearts, silver bead scrolls and sequin blossoms on grey net, with pearl drops along the outline. Sold per piece.',
    tags: ['Neckline', 'Appliqué', 'Orchid', 'Pastel'] },
  { id: 'NE1386-S32', name: 'Plum Vine Beaded Neckline Appliqué',
    description: 'Plum and mauve ribbon-work blossoms wind through silver-beaded scrolls and sage leaves on black net, edged in pearl picots — a deeper, moodier take on the beaded neckline. Sold per piece.',
    tags: ['Neckline', 'Appliqué', 'Plum'] },
  { id: 'NE1386-S33', name: 'Pastel Confetti Beaded Neckline Appliqué',
    description: 'The neckline appliqué in sugared pastels — baby pink, powder blue, butter yellow and mint petals with pearl centres and silver bead scrolls, scalloped in white. Made for daytime mehendi and haldi palettes. Sold per piece.',
    tags: ['Neckline', 'Appliqué', 'Pastel'] },
  { id: 'NE1386-S34', name: 'Ivory Bridal Beaded Neckline Appliqué',
    description: 'All-ivory florals, pearl sprays and crystal scrolls on sheer net — the bridal colourway of the beaded neckline, ready for a white or champagne gown. Sold per piece.',
    tags: ['Neckline', 'Appliqué', 'Ivory', 'Bridal'] },
  { id: 'NE1386-S35', name: 'Gilded Mirror V-Neckline Appliqué',
    description: 'A deep-V neckline panel in solid gold work: pearl-edged zari braid arms meeting a mirror-and-bead lattice bib, finished with picot pearls all round. Heavy, regal, festive. Sold per piece.',
    tags: ['Neckline', 'Appliqué', 'Gold', 'Mirror Work'] },
  { id: 'NO-CODE-S23', name: 'Antique Gold Jaal Scallop Border',
    description: 'Scalloped fans of antique-gold zari and bugle beads, each medallion set with pearls, linked by woven leaf motifs — a temple-jaal border by the piece for blouse hems and sleeve edges.',
    tags: ['Gold', 'Scallop', 'Traditional'] },
  { id: 'RI280', name: 'Taupe Picot Lattice Ribbon',
    description: 'A slim woven ribbon in taupe and old-gold with a pin-dot lattice centre and scalloped picot edges — an understated finishing trim for pipings and inner facings. 9-metre reel.',
    tags: ['Taupe', 'Ribbon', 'Finishing'] },
  { id: 'RI4680', name: 'Silver Braided Cord Trim',
    description: 'A plaited silver cord braid with a fine chain edge — clean metallic structure for necklines, cuffs and sharp modern borders. 9-metre reel.',
    tags: ['Silver', 'Braid', 'Modern'] },
  { id: 'RI5687', name: 'Champagne Pearl Chain Trim', reshoot: true,
    description: 'A fine champagne-gold chain trim strung with seed pearls — a delicate running accent for edges and layering over wider borders. Supplied on a generous 30-metre roll.',
    tags: ['Champagne', 'Pearl', 'Chain'] },
  { id: 'RI5839', name: 'Gold Pyramid Stud & Wave Braid',
    description: 'Two gold trims in one band: a row of faceted pyramid studs beside a scalloped wave braid worked in metallic thread. Architectural shine for waistbands and borders. 18-metre reel.',
    tags: ['Gold', 'Stud', 'Braid'] },
  { id: 'ST3382', name: 'Citrine Crystal Encrusted Band',
    description: 'Five dense rows of citrine-gold rhinestones claw-set in metallic thread on silver net — a solid runway of stones for belts, borders and blouse straps. 9-metre reel.',
    tags: ['Crystal', 'Citrine', 'Statement'] },
  { id: 'ST987', name: 'Gold Infinity Loop Pearl Braid',
    description: 'Antique-gold cord worked in interlocking infinity loops, alternating seed pearls and tiny rhinestones down the line — fine jewellery scaled to a border. 18-metre reel.',
    tags: ['Gold', 'Pearl', 'Braid'] },
];

async function main(): Promise<void> {
  console.log(`Fixing ${FIXES.length} lace products in ${PROD ? 'PRODUCTION' : 'EMULATOR'} "${PROJECT_ID}"\n`);
  const batch = db.batch();
  const reshoot: string[] = [];
  for (const f of FIXES) {
    const ref = db.collection('products').doc(f.id);
    const snap = await ref.get();
    if (!snap.exists) { console.log(`  ! missing ${f.id} — skipped`); continue; }
    const price = Number(snap.data()?.price ?? 0);
    batch.set(ref, {
      name: f.name,
      description: f.description,
      productCode: f.id,
      photo: `/products/lace/${f.id}.jpg`,
      photoGallery: [`/products/lace/${f.id}.jpg`],
      image: `/products/lace/${f.id}.jpg`,
      gallery: [`/products/lace/${f.id}.jpg`],
      // A strike-through computed as price ÷ 0.7 is a discount that never
      // existed. mrp == price until a real list price exists.
      mrp: price,
      tags: f.tags,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    if (f.reshoot) reshoot.push(f.id);
    console.log(`  ✓ ${f.id.padEnd(14)} ${f.name}`);
  }
  await batch.commit();
  console.log(`\nDone. mrp=price on all ${FIXES.length}; photos now real files.`);
  if (reshoot.length) console.log(`Needs a proper product photo (warehouse snapshot today): ${reshoot.join(', ')}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
