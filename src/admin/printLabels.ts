/**
 * Barcode price labels.
 *
 * Four designs, because a lace reel and a bridal lehenga do not want the same
 * tag, and because the right one is a judgement call the studio makes with a
 * printed sheet in hand rather than one anybody makes from a description.
 * `LABEL_DESIGNS` is the list; adding a thermal roll is another entry, not a
 * change to the builder.
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
  /** Sheet dimensions and margins in millimetres. */
  page: { width: number; height: number; marginX: number; marginY: number };
  columns: number;
  rows: number;
  gapX: number;
  gapY: number;
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
 * 63.5 × 38.1 mm labels, 3 across and 7 down — 21 per A4.
 *
 * NOT 3 × 8. Eight rows of 38.1mm is 304.8mm of label on a 297mm page, so the
 * bottom row prints off the sheet. That pairing belongs to the 63.5 × 33.9 mm
 * stock; at 38.1mm tall the sheet holds 21. Margins below are the exact
 * remainder, so the grid is centred on the page:
 *   X: 3 × 63.5 + 2 × 2.5 gap + 2 × 7.25 margin = 210
 *   Y: 7 × 38.1 + 2 × 15.15 margin             = 297
 */
const A4_21 = { width: 210, height: 297, marginX: 7.25, marginY: 15.15 };

export const LABEL_DESIGNS: readonly LabelDesign[] = [
  {
    id: 'classic',
    name: 'Classic price tag',
    blurb: 'Brand, piece, price and code. The everyday label, on standard sheet stock.',
    width: 63.5, height: 38.1, page: A4_21, columns: 3, rows: 7, gapX: 2.5, gapY: 0,
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
    blurb: 'Adds the category line. Same sheet as Classic — for when one shelf holds several families.',
    width: 63.5, height: 38.1, page: A4_21, columns: 3, rows: 7, gapX: 2.5, gapY: 0,
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
    width: 50, height: 70, page: { width: 210, height: 297, marginX: 25, marginY: 5 },
    columns: 3, rows: 4, gapX: 5, gapY: 2,
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
    // 3 x 65 + 2 x 7.5 margin = 210. 6 x 45 + 2 x 13.5 margin = 297. The margins
    // clear a Canon PIXMA's unprintable edge (~3.4mm sides, 5mm bottom) with
    // room to spare, so nothing is clipped.
    width: 65, height: 45,
    page: { width: 210, height: 297, marginX: 7.5, marginY: 13.5 },
    // NO gutters, on purpose. Neighbouring tags share one dashed line, so the
    // sheet is cut with six straight passes across and two down rather than
    // thirty-six fiddly ones — and nothing is wasted between them.
    columns: 3, rows: 6, gapX: 0, gapY: 0,
    codeSpan: 0.66, codeHeight: 11,
    cell: (p, svg, code) => `
      <div class="brand">${esc(p.brand ?? '')}</div>
      <div class="name">${esc(p.name ?? '')}</div>
      <div class="cat">${esc(categoryOf(p))}</div>
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
      .brand { font-size: 7pt; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; }
      .name { font-size: 8pt; font-weight: 700; line-height: 1.15; max-height: 9mm; overflow: hidden;
              display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      .cat { font-size: 5.5pt; color: #555; letter-spacing: 0.08em; text-transform: uppercase; }
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
    width: 38.1, height: 21.2, page: { width: 210, height: 297, marginX: 6.75, marginY: 10 },
    columns: 5, rows: 13, gapX: 1.5, gapY: 0,
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
 * One label on a page its own size.
 *
 * For the product editor: the operator wants THIS piece's tag, now, not a sheet
 * of twenty-four mostly-blank cells. Choosing "Save as PDF" in the print dialog
 * downloads it.
 */
export function buildSingleLabel(product: Fabric, design: LabelDesign): string {
  const pad = 3;
  const solo: LabelDesign = {
    ...design,
    page: { width: design.width + pad * 2, height: design.height + pad * 2, marginX: pad, marginY: pad },
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
