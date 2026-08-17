/**
 * Import the catalogue workbook into Firestore, then barcode everything.
 *
 * This is how a whole store gets registered without typing 300 products into
 * the admin console one at a time. Run the Python dumper first (it is the only
 * thing that can read .xlsx), then this:
 *
 *   python3 scripts/catalogue-xlsx-to-json.py my-catalogue.xlsx -o import.json
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-tresor \
 *     npx tsx scripts/import-catalogue.ts import.json --dry-run
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/key.json \
 *     npx tsx scripts/import-catalogue.ts import.json --prod
 *
 * Rules that shape the whole design:
 *
 *  - **Product ID is the key.** A new id creates a product; an existing id
 *    updates it. Nothing is ever deleted — a product missing from the sheet is
 *    left alone, because "not in this spreadsheet" is not the same statement as
 *    "no longer sold", and an import that can delete is an import nobody dares
 *    run twice.
 *
 *  - **A blank cell means "leave it as it is", not "erase it".** Only columns
 *    the sheet actually fills are written. This is what makes it safe to import
 *    a price-only sheet over products whose descriptions were written by hand.
 *
 *  - **No photograph means Draft.** A piece with no Image URL is registered for
 *    stock, barcodes and counter billing but kept off the storefront, so the
 *    whole store can be entered today and published piece by piece as the
 *    photos arrive. `--publish-without-photos` overrides this for the case
 *    where a generated swatch really is acceptable.
 *
 *  - **Validate everything before writing anything.** Hard errors abort the
 *    run with nothing written; a half-imported catalogue is worse than none.
 *
 * Flags: --prod  --dry-run  --no-barcodes  --publish-without-photos
 */
import fs from 'node:fs';
import { FieldValue } from 'firebase-admin/firestore';
import { initAdmin } from './lib/admin';
import { assignBarcodes, formatBarcode } from './lib/barcodes';
import { MASTER_CATEGORY_TREE, TAX_RATE } from '../src/constants';
import { fabricSwatch } from '../src/lib/swatch';
import type { Fabric, MasterCategory } from '../src/types';

/* ── CLI ──────────────────────────────────────────────────────────────── */
const args = process.argv.slice(2);
const FILE = args.find(a => !a.startsWith('--'));
const DRY = args.includes('--dry-run');
const NO_BARCODES = args.includes('--no-barcodes');
const PUBLISH_WITHOUT_PHOTOS = args.includes('--publish-without-photos');

if (!FILE) {
  console.error('Usage: npx tsx scripts/import-catalogue.ts <dump.json> [--prod] [--dry-run] [--no-barcodes] [--publish-without-photos]');
  process.exit(2);
}

/* ── Sheet vocabulary ─────────────────────────────────────────────────── */
type Row = Record<string, unknown> & { _row?: number };

const MASTER_CATEGORIES = Object.keys(MASTER_CATEGORY_TREE) as MasterCategory[];
const UNIT_TYPES = ['unit', 'per meter', 'bundle'] as const;
const STICKERS = ['Trending', 'Bestseller', 'New In', 'Limited'] as const;
const LISTING_STATUSES = ['Active', 'Draft', 'Retired'] as const;
const PHOTO_QUALITIES = ['Studio', 'Acceptable', 'Needs reshoot'] as const;
const GST_RATES = [0, 0.05, 0.12, 0.18];

/** Firestore rejects '.', '..', anything containing '/', and ids over 1500 bytes.
 *  We are stricter still: an id also becomes a URL path segment. */
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const num = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

/* ── Placeholder imagery ──────────────────────────────────────────────── */
/** Deterministic palette per master category, so an unphotographed piece still
 *  renders as something recognisably of its family in the admin grid. */
const PALETTE: Record<MasterCategory, { primary: string; secondary: string; accent: string; weave: Parameters<typeof fabricSwatch>[0]['weave'] }> = {
  'Fabrics':         { primary: '#E8DCC6', secondary: '#CBB894', accent: '#B8915A', weave: 'plain' },
  'Dyeable Fabrics': { primary: '#F2E4C4', secondary: '#DCCBA6', accent: '#B8915A', weave: 'twill' },
  'Laces':           { primary: '#EDE4D2', secondary: '#D6C6A8', accent: '#C9A267', weave: 'brocade' },
  'Sarees':          { primary: '#C9A267', secondary: '#A8823F', accent: '#8E6520', weave: 'kanjivaram' },
  'Lehenga Cholis':  { primary: '#D9B26B', secondary: '#B8915A', accent: '#8E6520', weave: 'brocade' },
  'Anarkalis':       { primary: '#E0BFA0', secondary: '#C4A182', accent: '#8E6520', weave: 'jamdani' },
  'Western Wear':    { primary: '#CBC0A7', secondary: '#AFA385', accent: '#7E7355', weave: 'twill' },
  'Studios Prêt':    { primary: '#B8915A', secondary: '#9C7A45', accent: '#F5ECDC', weave: 'satin' },
};

const swatchFor = (id: string, name: string, master: MasterCategory): string =>
  fabricSwatch({ id, name, ...PALETTE[master] });

/* ── Validation ───────────────────────────────────────────────────────── */
interface Problem { row: number; id: string; message: string; }

interface Parsed {
  id: string;
  row: number;
  /** Fields the sheet actually filled — the merge patch. */
  patch: Partial<Fabric> & Record<string, unknown>;
  /** True when the row carried no Image URL. */
  imageless: boolean;
}

function parseRows(rows: Row[]): { parsed: Parsed[]; errors: Problem[]; warnings: Problem[] } {
  const errors: Problem[] = [];
  const warnings: Problem[] = [];
  const parsed: Parsed[] = [];
  const seenIds = new Map<string, number>();
  const seenDescriptions = new Map<string, string[]>();

  for (const r of rows) {
    const row = typeof r._row === 'number' ? r._row : 0;
    const id = str(r['Product ID']);
    const err = (message: string) => errors.push({ row, id, message });
    const warn = (message: string) => warnings.push({ row, id, message });

    if (!ID_RE.test(id)) {
      err(`Product ID "${id}" is not usable — letters, digits, dot, dash and underscore only, up to 64 characters.`);
      continue;
    }
    const firstSeen = seenIds.get(id);
    if (firstSeen) {
      err(`Product ID "${id}" is already used on row ${firstSeen}. Each row must be a different product.`);
      continue;
    }
    seenIds.set(id, row);

    const name = str(r['Product Name']);
    if (!name) err('Product Name is empty.');

    const master = str(r['Master Category']) as MasterCategory;
    if (!master) err('Master Category is empty.');
    else if (!MASTER_CATEGORIES.includes(master)) {
      err(`Master Category "${master}" is not one of: ${MASTER_CATEGORIES.join(', ')}.`);
    }

    const sub = str(r['Sub Category / Design']);
    if (sub && MASTER_CATEGORIES.includes(master) && !MASTER_CATEGORY_TREE[master].includes(sub)) {
      // Harmless on the storefront — menus are derived from the catalogue, so
      // the new name appears on its own. Worth saying because a typo ("Zardosi"
      // for "Zardozi") splits one design across two menu entries, and the only
      // symptom is a thin category nobody notices.
      warn(`Sub Category "${sub}" is new — it will appear in the ${master} menu on its own, but check the spelling: a typo silently creates a second, near-empty subcategory. Known: ${MASTER_CATEGORY_TREE[master].join(', ')}.`);
    }

    const price = num(r['Selling Price (₹)']);
    const mrp = num(r['MRP (₹)']);
    const cost = num(r['Buying Price (₹)']);
    if (price === undefined || price <= 0) err('Selling Price must be a number greater than zero.');
    if (mrp !== undefined && price !== undefined && mrp < price) {
      err(`MRP ₹${mrp} is below the selling price ₹${price} — that prints a negative discount on the site.`);
    }
    if (cost !== undefined && price !== undefined && cost >= price) {
      warn(`Buying price ₹${cost} is not below the selling price ₹${price} — this piece makes no margin.`);
    }
    if (cost === undefined) warn('Buying Price is empty — margin cannot be reported for this piece.');

    const stock = num(r['Stock Qty']);
    if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) {
      err(`Stock Qty "${r['Stock Qty']}" must be a whole number of units, zero or more.`);
    }
    const reorder = num(r['Reorder Lvl']);

    const unit = str(r['Unit Type']);
    if (unit && !UNIT_TYPES.includes(unit as typeof UNIT_TYPES[number])) {
      err(`Unit Type "${unit}" is not one of: ${UNIT_TYPES.join(', ')}.`);
    }
    const bundle = num(r['Bundle (m)']);
    if (unit === 'bundle' && bundle === undefined) {
      // A warning, not an error: the piece still sells at its bundle price, it
      // just cannot show a per-metre figure. Several products already live in
      // production this way, and refusing to import them would make this tool
      // unable to round-trip the catalogue it was written for.
      warn('Unit Type is "bundle" but Bundle (m) is empty — the piece sells fine, it just cannot show a per-metre price.');
    }

    const gst = num(r['GST Rate']);
    if (gst !== undefined && !GST_RATES.includes(gst)) {
      err(`GST Rate "${gst}" is not one of: ${GST_RATES.map(g => `${g * 100}%`).join(', ')}.`);
    }
    if (gst !== undefined && gst !== TAX_RATE) {
      // Recorded on the product, but checkout still applies the site-wide rate.
      // Saying nothing here would let someone believe an 18% invoice is going out.
      warn(`GST Rate ${gst * 100}% is recorded but NOT yet applied — checkout and the tax invoice still charge ${TAX_RATE * 100}% until the per-product rates are wired in.`);
    }

    const sticker = str(r['Sticker']);
    if (sticker && !STICKERS.includes(sticker as typeof STICKERS[number])) {
      err(`Sticker "${sticker}" is not one of: ${STICKERS.join(', ')}.`);
    }
    const photoQuality = str(r['Photo Quality']);
    if (photoQuality && !PHOTO_QUALITIES.includes(photoQuality as typeof PHOTO_QUALITIES[number])) {
      err(`Photo Quality "${photoQuality}" is not one of: ${PHOTO_QUALITIES.join(', ')}.`);
    }
    let listing = str(r['Listing Status']);
    if (listing && !LISTING_STATUSES.includes(listing as typeof LISTING_STATUSES[number])) {
      err(`Listing Status "${listing}" is not one of: ${LISTING_STATUSES.join(', ')}.`);
      listing = '';
    }

    const description = str(r['Description']);
    if (description) {
      const key = description.toLowerCase();
      seenDescriptions.set(key, [...(seenDescriptions.get(key) ?? []), id]);
    }

    const photo = str(r['Image URL']);
    const imageless = !photo;

    /* ── Build the merge patch: only what the sheet filled ─────────────── */
    const patch: Partial<Fabric> & Record<string, unknown> = {};
    const set = <K extends string>(k: K, v: unknown) => { if (v !== undefined && v !== '') patch[k] = v; };

    set('name', name);
    set('description', description);
    set('brand', str(r['Brand']));
    set('price', price);
    set('mrp', mrp ?? price);
    set('costPrice', cost);
    set('category', master);
    set('masterCategory', master);
    set('subCategory', sub);
    set('materialType', str(r['Material']));
    set('unitType', unit);
    set('bundleSizeMeters', bundle);
    set('stock', stock);
    set('reorderLevel', reorder);
    set('productCode', str(r['Supplier Code']));
    set('supplier', str(r['Supplier']));
    set('hsnCode', str(r['HSN Code']));
    set('gstRate', gst);
    set('sticker', sticker);
    set('photoQuality', photoQuality);
    if (photo) set('photo', photo);

    // "Live on Site" is the plain-English column; Listing Status is the precise
    // one. An explicit "No" wins over a blank Listing Status.
    const live = str(r['Live on Site']);
    if (listing) patch.listingStatus = listing as Fabric['listingStatus'];
    else if (live.toLowerCase() === 'no') patch.listingStatus = 'Draft';

    if (imageless && patch.listingStatus === 'Active' && !PUBLISH_WITHOUT_PHOTOS) {
      patch.listingStatus = 'Draft';
      warn('No Image URL — imported as Draft (stock, barcode and counter billing all work; it just is not on the website). Add a photo and re-import to publish.');
    } else if (imageless) {
      warn('No Image URL — a generated swatch will stand in until a photograph is added.');
    }

    parsed.push({ id, row, patch, imageless });
  }

  for (const [, ids] of seenDescriptions) {
    if (ids.length > 1) {
      warnings.push({
        row: 0,
        id: ids.join(', '),
        message: `${ids.length} products share one description — search engines collapse near-identical pages, so they compete with each other.`,
      });
    }
  }

  return { parsed, errors, warnings };
}

/* ── Run ──────────────────────────────────────────────────────────────── */
async function main(): Promise<void> {
  const payload = JSON.parse(fs.readFileSync(FILE as string, 'utf8')) as { source?: string; rows?: Row[] };
  const rows = payload.rows ?? [];
  if (!rows.length) {
    console.error(`${FILE} has no rows. Run scripts/catalogue-xlsx-to-json.py first.`);
    process.exit(1);
  }

  const { parsed, errors, warnings } = parseRows(rows);

  console.log(`Catalogue import — ${rows.length} row(s) from ${payload.source ?? FILE}\n`);

  if (warnings.length) {
    console.log(`WARNINGS (${warnings.length}) — these import, but read them:`);
    for (const w of warnings) console.log(`  ${w.row ? `row ${String(w.row).padStart(3)}` : '        '}  ${w.id}: ${w.message}`);
    console.log('');
  }

  // Nothing is written if a single row is wrong. A catalogue half-imported and
  // half-rejected is the state that is hardest to reason about afterwards.
  if (errors.length) {
    console.error(`ERRORS (${errors.length}) — NOTHING was written. Fix these rows in the workbook and run again:`);
    for (const e of errors) console.error(`  row ${String(e.row).padStart(3)}  ${e.id || '(no id)'}: ${e.message}`);
    process.exit(1);
  }

  const { db, prod, projectId } = initAdmin();
  console.log(`${prod ? 'PRODUCTION' : 'EMULATOR'} "${projectId}"`);

  // Read the existing docs so the log can say created vs updated, and so a
  // product that already has a photograph never has it replaced by a swatch.
  const existing = new Map<string, Record<string, unknown>>();
  const snap = await db.collection('products').get();
  for (const d of snap.docs) existing.set(d.id, d.data() as Record<string, unknown>);

  let created = 0;
  let updated = 0;
  const drafts: string[] = [];
  const writes: { id: string; data: Record<string, unknown> }[] = [];

  for (const p of parsed) {
    const before = existing.get(p.id);
    const data: Record<string, unknown> = { ...p.patch, id: p.id, updatedAt: FieldValue.serverTimestamp() };

    const master = (p.patch.masterCategory ?? before?.masterCategory ?? 'Fabrics') as MasterCategory;
    const name = String(p.patch.name ?? before?.name ?? p.id);

    if (!before) {
      created += 1;
      data.createdAt = FieldValue.serverTimestamp();
      // Defaults that only apply to a brand-new product — never overwritten on
      // a re-import, so hand-curated tags and copy survive.
      if (!data.brand) data.brand = 'TRESOR COUTURE';
      if (!data.description) data.description = '';
      data.tags = [master, ...(p.patch.subCategory ? [String(p.patch.subCategory)] : []),
        ...(p.patch.materialType ? [String(p.patch.materialType)] : [])];
    } else {
      updated += 1;
    }

    // The SVG swatch is the guaranteed-loading fallback every product carries;
    // it is also the stand-in photo while a piece is unphotographed.
    const swatch = swatchFor(p.id, name, master);
    if (!before?.image) data.image = swatch;
    if (p.imageless && !before?.photo) data.photo = swatch;

    if (data.listingStatus === 'Draft') drafts.push(p.id);
    writes.push({ id: p.id, data });
  }

  console.log(`  ${created} to create, ${updated} to update, ${drafts.length} kept as Draft (not on the website)\n`);

  if (DRY) {
    for (const w of writes.slice(0, 20)) {
      console.log(`  ${existing.has(w.id) ? 'update' : 'create'}  ${w.id.padEnd(20)} ${String(w.data.name ?? '').slice(0, 44)}`);
    }
    if (writes.length > 20) console.log(`  … and ${writes.length - 20} more`);
    console.log(`\nDRY RUN — nothing written.`);
    return;
  }

  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + 400)) {
      batch.set(db.collection('products').doc(w.id), w.data, { merge: true });
    }
    await batch.commit();
  }
  console.log(`Wrote ${writes.length} product(s).`);

  if (NO_BARCODES) {
    console.log('\n--no-barcodes: skipped barcode assignment. Run scripts/assign-barcodes.ts before printing labels.');
    return;
  }

  // Every product gets a scannable code, imported or not — that is the whole
  // point of registering the store: walk to the shelf, scan, and the counter
  // knows the price.
  const res = await assignBarcodes(db);
  if (res.duplicates.size) {
    console.error('\nDUPLICATE BARCODES — a scan would be ambiguous. Fix before printing labels:');
    for (const [bc, ids] of res.duplicates) console.error(`  ${bc} -> ${ids.join(', ')}`);
    process.exit(1);
  }
  if (res.assignments.length) {
    console.log(`\nBarcodes: assigned ${res.assignments.length} (${res.assignments[0].barcode} … ${formatBarcode(res.highest)}).`);
  } else {
    console.log('\nBarcodes: every product already had one.');
  }
  console.log(`All ${res.total} products now carry a barcode. Print them from Admin → Inventory → Print labels.`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
