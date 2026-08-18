/**
 * Barcode price labels.
 *
 * Several designs, because a lace reel and a bridal lehenga do not want the same
 * tag, and because the right one is a judgement call the studio makes with a
 * printed sheet in hand rather than one anybody makes from a description.
 * `LABEL_DESIGNS` is the list; adding a thermal roll is another entry, not a
 * change to the builder.
 *
 * Every sheet keeps SAFE_MARGIN clear of the page edge unless it is printed on
 * die-cut stock, because a grid laid out to the edge comes back with its outer
 * column half printed.
 *
 * Every design carries the four things a tag has to say — brand, what the piece
 * is, what it costs, and a code the till can scan — and differs in what it does
 * with the room left over.
 *
 * The document is built as HTML and handed to the shared print helper, which
 * gives it its own `@page` size. That is the whole reason it is a separate
 * document rather than a `@media print` block on the admin page: label stock is
 * not A4, and a page can only declare one size. "Save as PDF" in the print
 * dialog is the download.
 *
 * Prices are printed inclusive of taxes, which is what an Indian garment tag is
 * expected to carry.
 */
import type { Fabric } from '../types';
import { code128Svg } from '../lib/barcode';
import { printHtmlDocument } from './printDocument';

export interface LabelDesign {
  id: string;
  /** Shown in the picker. */
  name: string;
  /** What this one is for. */
  blurb: string;
  /** Label dimensions in millimetres. */
  width: number;
  height: number;
  /**
   * What it is printed on, which decides who owns the sheet geometry.
   *
   * `plain` — ordinary paper, cut by hand. The grid is ours, so it must keep
   * SAFE_MARGIN clear of the page edge or the outer labels come back half
   * printed.
   *
   * `die-cut` — pre-cut label stock. The die owns the geometry and the
   * manufacturer already placed it inside the printable area; adding "safer"
   * margins here would print into the gaps between labels, which is worse.
   */
  stock: 'plain' | 'die-cut';
  /** Sheet dimensions and margins in millimetres. */
  page: { width: number; height: number; marginX: number; marginY: number };
  columns: number;
  rows: number;
  gapX: number;
  gapY: number;
  /** What this design prints beyond the four essentials (piece, price, code).
   *  Declared rather than inferred, so a test can hold each design to its own
   *  contract — and so dropping a line is a visible decision, not a silent one. */
  carries: readonly ('brand' | 'category')[];
  /** Fraction of the label width the barcode should span. */
  codeSpan: number;
  /** Barcode height in millimetres. */
  codeHeight: number;
  /** The label's inner markup. */
  cell: (p: Fabric, svg: string, code: string) => string;
  /** Design-specific CSS, appended after the shared rules. */
  css: string;
}

const esc = (s: string): string =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const rupee = (n: number): string => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const categoryOf = (p: Fabric): string => {
  const master = p.masterCategory ?? p.category ?? '';
  const sub = p.subCategory?.trim();
  return sub && sub !== master ? `${master} · ${sub}` : String(master);
};

/**
 * The price block.
 *
 * When the piece is discounted the tag shows both figures — the MRP struck
 * through and what is actually charged. Printing only the lower number would
 * make the tag disagree with the invoice; printing only the MRP would have the
 * customer expecting to pay more than the till asks.
 */
const priceBlock = (p: Fabric): string => {
  const mrp = Number(p.mrp ?? p.price ?? 0);
  const price = Number(p.price ?? mrp);
  return price > 0 && price < mrp
    ? `<span class="was">${rupee(mrp)}</span><span class="price">${rupee(price)}</span>`
    : `<span class="price">${rupee(mrp || price)}</span>`;
};

/* ── The designs ───────────────────────────────────────────────────────── */

/**
 * The border every plain-paper sheet keeps clear of the page edge.
 *
 * A desktop printer cannot reach its own paper edge: a Canon PIXMA leaves about
 * 3.4mm at the sides and 5mm at the bottom unprintable, and other machines are
 * worse — some HPs give up 12.7mm at the bottom. On top of that the sheet is
 * dragged through by rollers and arrives a millimetre or two askew.
 *
 * So a grid laid out to within 5mm of the edge does not come back short by
 * 5mm — it comes back with the outer column half printed on one side and fine
 * on the other, which is the failure that wastes a whole sheet rather than one
 * label. 8mm across and 12mm down clears the worst common machine with room for
 * the skew.
 *
 * Where honouring this would cost a whole column or row, the TAG gives up the
 * millimetre or two instead — 38.5mm of sticker still holds the symbol, and 70
 * per sheet with a safe border beats 52 without one.
 */
export const SAFE_MARGIN = { x: 8, y: 12 } as const;

/**
 * 63.5 × 38.1 mm labels, 3 across and 7 down — 21 per A4.
 *
 * NOT 3 × 8. Eight rows of 38.1mm is 304.8mm of label on a 297mm page, so the
 * bottom row prints off the sheet. That pairing belongs to the 63.5 × 33.9 mm
 * stock; at 38.1mm tall the sheet holds 21. Margins below are the exact
 * remainder, so the grid is centred on the page:
 *   X: 3 × 63.5 + 2 × 2.5 gap + 2 × 7.25 margin = 210
 *   Y: 7 × 38.1 + 2 × 15.15 margin             = 297
 *
 * These numbers are the Avery L7160 die, not a choice. They are BELOW
 * SAFE_MARGIN across, and deliberately so: the labels are already cut and the
 * manufacturer placed them inside the printer's reach. Widening the margin here
 * would slide the print off the labels and onto the backing paper.
 */
const A4_21 = { width: 210, height: 297, marginX: 7.25, marginY: 15.15 };

export const LABEL_DESIGNS: readonly LabelDesign[] = [
  {
    id: 'sticker-38x20',
    name: 'Sticker · 38.5 × 19.5 mm',
    blurb: 'The small tag — 70 per A4, with a safe border all round. Goes on the round brand tag, which already carries the name.',
    // 1.5mm narrower and 0.5mm shorter than the 40 x 20 it replaces, and that
    // trim is what buys the border: at 40mm five columns leave only 5mm at the
    // sides, and the outer column came back half printed.
    //   X: 5 x 38.5 + 2 x 8.75 margin = 210
    //   Y: 14 x 19.5 + 2 x 12 margin  = 297
    // Still 70 to a sheet, and still 11mm clear either side of the 60mm round tag.
    width: 38.5, height: 19.5, stock: 'plain',
    page: { width: 210, height: 297, marginX: 8.75, marginY: 12 },
    columns: 5, rows: 14, gapX: 0, gapY: 0,
    // No brand line. This sticker goes onto the round tag, which already says
    // Tresor Couture — printing it twice spends 2mm of a 20mm tag saying
    // nothing new, and that 2mm is the barcode's.
    carries: [],
    codeSpan: 0.85, codeHeight: 8,
    cell: (p, svg, code) => `
      <div class="name">${esc(p.name ?? '')}</div>
      <div class="bc">${svg}</div>
      <div class="foot">
        <span class="code">${esc(code)}</span>
        ${priceBlock(p)}
      </div>
      <div class="incl">Incl. of all taxes</div>`,
    css: `
      .label { justify-content: center; align-items: center; text-align: center;
               padding: 0.9mm 1.5mm; gap: 0.3mm;
               border-right: 0.2mm dashed #999; border-bottom: 0.2mm dashed #999; }
      .label:nth-child(5n+1) { border-left: 0.2mm dashed #999; }
      .label:nth-child(-n+5) { border-top: 0.2mm dashed #999; }
      /* One line, ellipsised. A second line would push into the barcode's quiet
         zone, and a symbol without its quiet zone does not scan. */
      .name { font-size: 5.5pt; font-weight: 700; line-height: 1.1; width: 100%;
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .foot { display: flex; align-items: baseline; justify-content: center; gap: 1.6mm; width: 100%; }
      .code { font-family: "Courier New", monospace; font-size: 5pt; letter-spacing: 0.2pt; }
      .price { font-size: 8pt; font-weight: 800; }
      .was { font-size: 5pt; text-decoration: line-through; color: #777; }
      .incl { font-size: 3.8pt; color: #555; }`,
  },
  {
    id: 'sticker-50x25',
    name: 'Sticker · 50 × 25 mm',
    blurb: 'Matches the blank sticker stock on the shelf — 30 per A4. The size is fixed, so the border costs a column.',
    // The one design whose SIZE is not ours to trim: it exists to land on a
    // 50 x 25 sticker the studio already has, and a 48mm print on a 50mm
    // sticker is visibly off-centre. So the border costs a column and a row
    // rather than a millimetre.
    //   X: 3 x 50 + 2 x 30 margin   = 210
    //   Y: 10 x 25 + 2 x 23.5 margin = 297
    // Four columns would need a 5mm side margin, which is what was printing the
    // outer column half off the sheet. Use the 38.5mm sticker for volume — it
    // gets 70 to a sheet with the same border.
    width: 50, height: 25, stock: 'plain',
    page: { width: 210, height: 297, marginX: 30, marginY: 23.5 },
    // Shared cut lines: 9 straight passes across and 2 down for 30 tags.
    columns: 3, rows: 10, gapX: 0, gapY: 0,
    carries: [],
    codeSpan: 0.8, codeHeight: 8,
    // Neither brand nor category. On 25mm of height every millimetre belongs to
    // the barcode; the brand is on the tag this sticks to and the category is
    // the shelf the piece is sitting on.
    cell: (p, svg, code) => `
      <div class="name">${esc(p.name ?? '')}</div>
      <div class="bc">${svg}</div>
      <div class="foot">
        <span class="code">${esc(code)}</span>
        ${priceBlock(p)}
      </div>
      <div class="incl">Incl. of all taxes</div>`,
    css: `
      .label { justify-content: center; align-items: center; text-align: center;
               padding: 1.4mm 2mm; gap: 0.3mm;
               border-right: 0.2mm dashed #999; border-bottom: 0.2mm dashed #999; }
      .label:nth-child(3n+1) { border-left: 0.2mm dashed #999; }
      .label:nth-child(-n+3) { border-top: 0.2mm dashed #999; }
      /* One line: a trim's name is long and the tag is 25mm tall. Truncating
         beats spilling into the barcode's quiet zone. */
      .name { font-size: 6pt; font-weight: 700; line-height: 1.1; width: 100%;
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .foot { display: flex; align-items: baseline; justify-content: center; gap: 2mm; width: 100%; }
      .code { font-family: "Courier New", monospace; font-size: 5.5pt; letter-spacing: 0.3pt; }
      .price { font-size: 9pt; font-weight: 800; }
      .was { font-size: 5.5pt; text-decoration: line-through; color: #777; }
      .incl { font-size: 4pt; color: #555; }`,
  },
  {
    id: 'classic',
    name: 'Classic price tag',
    blurb: 'Brand, piece, price and code. The everyday label, on Avery L7160 die-cut stock.',
    width: 63.5, height: 38.1, stock: 'die-cut',
    page: A4_21, columns: 3, rows: 7, gapX: 2.5, gapY: 0,
    carries: ['brand'],
    codeSpan: 0.62, codeHeight: 9,
    cell: (p, svg, code) => `
      <div class="brand">${esc(p.brand ?? '')}</div>
      <div class="name">${esc(p.name ?? '')}</div>
      <div class="bc">${svg}</div>
      <div class="foot">
        <span class="code">${esc(code)}</span>
        ${priceBlock(p)}
      </div>
      <div class="incl">Incl. of all taxes</div>`,
    css: `
      .label { justify-content: space-between; text-align: center; padding: 1.6mm 2mm; }
      .brand { font-size: 5.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #444; }
      .name { font-size: 6.5pt; line-height: 1.15; font-weight: 700; max-height: 6.5mm; overflow: hidden;
              display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      .foot { display: flex; align-items: baseline; justify-content: center; gap: 2.5mm; width: 100%; }
      .code { font-family: "Courier New", monospace; font-size: 6.5pt; letter-spacing: 0.4pt; }
      .price { font-size: 9pt; font-weight: 800; }
      .was { font-size: 6pt; text-decoration: line-through; color: #777; margin-right: 1mm; }
      .incl { font-size: 4.5pt; color: #555; }`,
  },
  {
    id: 'detailed',
    name: 'Detailed tag',
    blurb: 'Adds the category line. Same die-cut sheet as Classic — for when one shelf holds several families.',
    width: 63.5, height: 38.1, stock: 'die-cut',
    page: A4_21, columns: 3, rows: 7, gapX: 2.5, gapY: 0,
    carries: ['brand', 'category'],
    codeSpan: 0.58, codeHeight: 8,
    cell: (p, svg, code) => `
      <div class="head">
        <span class="brand">${esc(p.brand ?? '')}</span>
        <span class="price">${rupee(Number(p.price ?? p.mrp ?? 0))}</span>
      </div>
      <div class="name">${esc(p.name ?? '')}</div>
      <div class="cat">${esc(categoryOf(p))}</div>
      <div class="bc">${svg}</div>
      <div class="code">${esc(code)}</div>`,
    css: `
      .label { justify-content: space-between; text-align: left; padding: 1.6mm 2mm; }
      .head { display: flex; align-items: baseline; justify-content: space-between; width: 100%;
              border-bottom: 0.3mm solid #000; padding-bottom: 0.6mm; }
      .brand { font-size: 5.5pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
      .price { font-size: 9pt; font-weight: 800; }
      .name { font-size: 6.5pt; font-weight: 700; line-height: 1.1; max-height: 5.5mm; overflow: hidden;
              display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      .cat { font-size: 5pt; color: #555; letter-spacing: 0.06em; text-transform: uppercase; }
      .bc { align-self: center; }
      .code { font-family: "Courier New", monospace; font-size: 6pt; letter-spacing: 0.4pt; align-self: center; }`,
  },
  {
    id: 'hangtag',
    name: 'Garment hang tag',
    blurb: 'Tall tag with a big price, for lehengas and sarees on a rail. Punch the hole above the brand.',
    // 4mm shorter than the 70mm it was, because four 70mm rows plus their gaps
    // came to 286mm and left 5.5mm at the top and bottom — the bottom row sat
    // exactly on a Canon's unprintable edge. 66mm keeps all four rows:
    //   X: 3 x 50 + 2 x 5 gap + 2 x 25 margin   = 210
    //   Y: 4 x 66 + 3 x 2 gap + 2 x 13.5 margin = 297
    width: 50, height: 66, stock: 'plain',
    page: { width: 210, height: 297, marginX: 25, marginY: 13.5 },
    columns: 3, rows: 4, gapX: 5, gapY: 2,
    carries: ['brand', 'category'],
    codeSpan: 0.78, codeHeight: 12,
    cell: (p, svg, code) => `
      <div class="brand">${esc(p.brand ?? '')}</div>
      <div class="rule"></div>
      <div class="name">${esc(p.name ?? '')}</div>
      <div class="cat">${esc(categoryOf(p))}</div>
      <div class="prices">${priceBlock(p)}</div>
      <div class="incl">Incl. of all taxes</div>
      <div class="bc">${svg}</div>
      <div class="code">${esc(code)}</div>`,
    css: `
      .label { justify-content: flex-start; text-align: center; padding: 4mm 3mm 3mm; gap: 1.2mm; }
      .brand { font-size: 8pt; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; }
      .rule { width: 60%; height: 0.3mm; background: #000; margin: 0.5mm auto 1mm; }
      .name { font-size: 8pt; font-weight: 700; line-height: 1.2; max-height: 12mm; overflow: hidden;
              display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
      .cat { font-size: 5.5pt; color: #555; letter-spacing: 0.1em; text-transform: uppercase; }
      .prices { margin-top: 2mm; display: flex; flex-direction: column; align-items: center; }
      .price { font-size: 15pt; font-weight: 800; line-height: 1; }
      .was { font-size: 7pt; text-decoration: line-through; color: #777; }
      .incl { font-size: 5pt; color: #555; margin-bottom: 2mm; }
      .bc { margin-top: auto; }
      .code { font-family: "Courier New", monospace; font-size: 7pt; letter-spacing: 0.5pt; }`,
  },
  {
    id: 'a4-cut',
    name: 'A4 cut-out sheet (scissors)',
    blurb: 'Plain A4 on any inkjet — 18 tags with dashed lines to cut along. No special label stock.',
    // 1mm narrower than the 65mm it was, which lifts the side margin from 7.5mm
    // to 9mm without costing a column.
    //   X: 3 x 64 + 2 x 9 margin    = 210
    //   Y: 6 x 45 + 2 x 13.5 margin = 297
    width: 64, height: 45, stock: 'plain',
    page: { width: 210, height: 297, marginX: 9, marginY: 13.5 },
    // NO gutters, on purpose. Neighbouring tags share one dashed line, so the
    // sheet is cut with six straight passes across and two down rather than
    // thirty-six fiddly ones — and nothing is wasted between them.
    columns: 3, rows: 6, gapX: 0, gapY: 0,
    carries: [],
    codeSpan: 0.66, codeHeight: 11,
    cell: (p, svg, code) => `
      <div class="name">${esc(p.name ?? '')}</div>
      <div class="bc">${svg}</div>
      <div class="code">${esc(code)}</div>
      <div class="prices">${priceBlock(p)}</div>
      <div class="incl">Incl. of all taxes</div>`,
    css: `
      /* A generous inner margin is what makes a hand-cut tag forgiving: scissors
         can wander a couple of millimetres and still not touch the barcode. */
      .label { justify-content: center; align-items: center; text-align: center;
               padding: 4mm 5mm; gap: 0.8mm;
               border-right: 0.2mm dashed #999; border-bottom: 0.2mm dashed #999; }
      /* Single shared lines: only the outermost tags draw their left/top edge. */
      .label:nth-child(3n+1) { border-left: 0.2mm dashed #999; }
      .label:nth-child(-n+3) { border-top: 0.2mm dashed #999; }
      .name { font-size: 8pt; font-weight: 700; line-height: 1.15; max-height: 9mm; overflow: hidden;
              display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      .bc { margin-top: 1mm; }
      .code { font-family: "Courier New", monospace; font-size: 7pt; letter-spacing: 0.5pt; }
      .prices { display: flex; align-items: baseline; gap: 2mm; margin-top: 0.5mm; }
      .price { font-size: 12pt; font-weight: 800; }
      .was { font-size: 7pt; text-decoration: line-through; color: #777; }
      .incl { font-size: 5pt; color: #555; }`,
  },
  {
    id: 'compact',
    name: 'Small reel sticker',
    blurb: 'The same four facts squeezed onto 38 × 21 mm, for lace reels and trims where a full tag will not fit. 65 per A4.',
    // 0.2mm shorter and the column gap down from 1.5mm to 0.5mm — together
    // those lift the margins from 6.75/10 to 8.75/12 without losing a tag.
    //   X: 5 x 38.1 + 4 x 0.5 gap + 2 x 8.75 margin = 210
    //   Y: 13 x 21 + 2 x 12 margin                  = 297
    width: 38.1, height: 21, stock: 'plain',
    page: { width: 210, height: 297, marginX: 8.75, marginY: 12 },
    columns: 5, rows: 13, gapX: 0.5, gapY: 0,
    carries: ['brand'],
    codeSpan: 0.86, codeHeight: 7,
    cell: (p, svg, code) => `
      <div class="brand">${esc(p.brand ?? '')}</div>
      <div class="name">${esc(p.name ?? '')}</div>
      <div class="bc">${svg}</div>
      <div class="foot">
        <span class="code">${esc(code)}</span>
        <span class="price">${rupee(Number(p.price ?? p.mrp ?? 0))}</span>
      </div>`,
    css: `
      .label { justify-content: center; align-items: center; text-align: center; padding: 1mm 1.5mm; gap: 0.4mm; }
      .brand { font-size: 4.5pt; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #444; }
      /* One line only. A trim's name is long and the sticker is 21mm tall —
         truncating beats spilling over the barcode. */
      .name { font-size: 5pt; font-weight: 700; line-height: 1.05; width: 100%;
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .foot { display: flex; align-items: baseline; justify-content: space-between; width: 100%; }
      .code { font-family: "Courier New", monospace; font-size: 5.5pt; letter-spacing: 0.3pt; }
      .price { font-size: 7pt; font-weight: 800; }`,
  },
];

/** The small sticker for the round brand tag — what gets printed by the hundred. */
export const defaultDesign = (): LabelDesign => LABEL_DESIGNS[0];

export const designById = (id: string | undefined): LabelDesign =>
  LABEL_DESIGNS.find(d => d.id === id) ?? defaultDesign();

/** Backwards-compatible alias — the presets were only ever geometry. */
export const LABEL_PRESETS = LABEL_DESIGNS;
export type LabelPreset = LabelDesign;

/** A product without a barcode cannot be labelled — surfaced, never silently skipped. */
export function labelableProducts(products: Fabric[]): { ready: Fabric[]; missing: Fabric[] } {
  const ready: Fabric[] = [];
  const missing: Fabric[] = [];
  for (const p of products) {
    if (typeof p.barcode === 'string' && p.barcode.trim()) ready.push(p);
    else missing.push(p);
  }
  return { ready, missing };
}

/** TC + 5 digits: 112 bar modules, plus a 10-module quiet zone each side. */
const CODE_MODULES = 112 + 20;

function labelCell(p: Fabric, d: LabelDesign): string {
  const code = String(p.barcode ?? '').trim();
  // Scale the module width so the symbol spans the design's intended share of
  // the label: a fixed width overflows the 38mm sticker and looks lost on the
  // 50mm hang tag. The floor is what a 203dpi thermal printer can resolve —
  // below about 0.19mm the bars merge and the scan fails.
  const moduleWidth = Math.min(0.4, Math.max(0.19, (d.width * d.codeSpan) / CODE_MODULES));
  // code128Svg emits millimetres, so codeHeight passes straight through.
  const svg = code128Svg(code, { moduleWidth, height: d.codeHeight });
  return `<div class="label">${d.cell(p, svg, code)}</div>`;
}

function sheetCss(d: LabelDesign): string {
  return `
  @page { size: ${d.page.width}mm ${d.page.height}mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet {
    width: ${d.page.width}mm; height: ${d.page.height}mm;
    padding: ${d.page.marginY}mm ${d.page.marginX}mm;
    display: grid;
    grid-template-columns: repeat(${d.columns}, ${d.width}mm);
    grid-auto-rows: ${d.height}mm;
    column-gap: ${d.gapX}mm; row-gap: ${d.gapY}mm;
    page-break-after: always; align-content: start; justify-content: center;
  }
  .sheet:last-child { page-break-after: auto; }
  .label {
    width: ${d.width}mm; height: ${d.height}mm;
    display: flex; flex-direction: column; overflow: hidden;
  }
  .bc { line-height: 0; }
  .bc svg { display: block; margin: 0 auto; }
  ${d.css}`;
}

export function buildLabelSheet(products: Fabric[], design: LabelDesign): string {
  const { ready } = labelableProducts(products);
  const perSheet = design.columns * design.rows;

  const pages: string[] = [];
  for (let i = 0; i < ready.length; i += perSheet) {
    const cells = ready.slice(i, i + perSheet).map(p => labelCell(p, design)).join('');
    pages.push(`<section class="sheet">${cells}</section>`);
  }

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Tresor-Couture-Labels</title>
<style>${sheetCss(design)}</style></head>
<body>${pages.join('')}</body></html>`;
}

/**
 * One label, alone on an A4 page.
 *
 * For the product editor: the operator wants THIS piece's tag, now, not a sheet
 * of twenty-one mostly-blank cells. Choosing "Save as PDF" in the print dialog
 * downloads it.
 *
 * The page is A4 rather than the label's own size, which is what it used to be.
 * A 46 × 26 mm page is not paper anybody owns, so the print dialog fell back to
 * the tray's real size and the browser placed the tag hard against the corner —
 * the one part of the sheet the printer cannot reach. On A4 with a 15mm border
 * it lands where the print head can always get to it, and there is paper left to
 * hold while cutting.
 */
export function buildSingleLabel(product: Fabric, design: LabelDesign): string {
  const marginY = 15;
  const solo: LabelDesign = {
    ...design,
    page: { width: 210, height: 297, marginX: (210 - design.width) / 2, marginY },
    columns: 1,
    rows: 1,
  };
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(String(product.barcode ?? 'label'))}</title>
<style>${sheetCss(solo)}</style></head>
<body><section class="sheet">${labelCell(product, solo)}</section></body></html>`;
}

/** Build the sheet and open the print dialog. */
export async function printLabels(
  products: Fabric[],
  design: LabelDesign = defaultDesign(),
): Promise<void> {
  const { ready } = labelableProducts(products);
  if (!ready.length) throw new Error('None of the selected products have a barcode yet.');
  await printHtmlDocument(buildLabelSheet(ready, design));
}

/** Build one label and open the print dialog ("Save as PDF" downloads it). */
export async function printSingleLabel(
  product: Fabric,
  design: LabelDesign = defaultDesign(),
): Promise<void> {
  if (!String(product.barcode ?? '').trim()) {
    throw new Error('This product has no barcode yet — generate one first.');
  }
  await printHtmlDocument(buildSingleLabel(product, design));
}
