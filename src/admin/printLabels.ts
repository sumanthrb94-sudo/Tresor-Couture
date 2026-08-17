/**
 * Barcode shelf/price labels for the counter.
 *
 * Builds a printable sheet of labels — barcode, human-readable code, product
 * name and MRP — and hands it to the shared print helper, which gives the
 * document its own `@page` size. That is the whole reason this is a separate
 * document rather than a `@media print` block on the admin page: label stock is
 * not A4, and a page can only declare one size.
 *
 * Default geometry is the common 63.5 x 38.1mm sheet (3 across, 8 down, 24 per
 * A4), chosen because a TC-code barcode occupies 33mm of the 63.5mm width and
 * leaves room for the name and price. `LABEL_PRESETS` holds the alternatives;
 * a thermal roll can be added as another preset without touching the builder.
 *
 * MRP is printed inclusive of taxes, which is what an Indian garment price tag
 * is expected to carry.
 */
import type { Fabric } from '../types';
import { code128Svg } from '../lib/barcode';
import { printHtmlDocument } from './printDocument';

export interface LabelPreset {
  id: string;
  label: string;
  /** Label dimensions in millimetres. */
  width: number;
  height: number;
  /** Sheet dimensions and margins in millimetres. */
  page: { width: number; height: number; marginX: number; marginY: number };
  columns: number;
  rows: number;
  /** Gaps between labels in millimetres. */
  gapX: number;
  gapY: number;
}

export const LABEL_PRESETS: readonly LabelPreset[] = [
  {
    id: 'a4-24',
    label: 'A4 sheet · 63.5 × 38.1 mm · 24 per sheet',
    width: 63.5,
    height: 38.1,
    page: { width: 210, height: 297, marginX: 7, marginY: 12 },
    columns: 3,
    rows: 8,
    gapX: 2.5,
    gapY: 0,
  },
  {
    id: 'a4-21',
    label: 'A4 sheet · 70 × 42.3 mm · 21 per sheet',
    width: 70,
    height: 42.3,
    page: { width: 210, height: 297, marginX: 0, marginY: 0 },
    columns: 3,
    rows: 7,
    gapX: 0,
    gapY: 0,
  },
];

const esc = (s: string): string =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const rupee = (n: number): string => `₹${Number(n || 0).toLocaleString('en-IN')}`;

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

function labelCell(p: Fabric, preset: LabelPreset): string {
  const barcode = String(p.barcode ?? '').trim();
  // Scale the module width so the symbol always spans ~55% of the label,
  // whatever preset is in use — a fixed 0.25mm would overflow a narrow label.
  const targetMm = preset.width * 0.55;
  const modules = 112 + 20; // TC + 5 digits, quiet zones included
  const moduleWidth = Math.min(0.33, Math.max(0.19, targetMm / modules));
  const svg = code128Svg(barcode, { moduleWidth, height: preset.height * 0.3 });

  return `<div class="label">
    <div class="name">${esc(p.name ?? '')}</div>
    <div class="bc">${svg}</div>
    <div class="foot">
      <span class="code">${esc(barcode)}</span>
      <span class="price">MRP ${rupee(p.mrp ?? p.price ?? 0)}</span>
    </div>
    <div class="incl">Incl. of all taxes</div>
  </div>`;
}

export function buildLabelSheet(products: Fabric[], preset: LabelPreset): string {
  const { ready } = labelableProducts(products);
  const perSheet = preset.columns * preset.rows;

  const pages: string[] = [];
  for (let i = 0; i < ready.length; i += perSheet) {
    const cells = ready.slice(i, i + perSheet).map(p => labelCell(p, preset)).join('');
    pages.push(`<section class="sheet">${cells}</section>`);
  }

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Tresor-Couture-Labels</title>
<style>
  @page { size: ${preset.page.width}mm ${preset.page.height}mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet {
    width: ${preset.page.width}mm;
    height: ${preset.page.height}mm;
    padding: ${preset.page.marginY}mm ${preset.page.marginX}mm;
    display: grid;
    grid-template-columns: repeat(${preset.columns}, ${preset.width}mm);
    grid-auto-rows: ${preset.height}mm;
    column-gap: ${preset.gapX}mm;
    row-gap: ${preset.gapY}mm;
    page-break-after: always;
    align-content: start;
    justify-content: center;
  }
  .sheet:last-child { page-break-after: auto; }
  .label {
    width: ${preset.width}mm;
    height: ${preset.height}mm;
    padding: 1.5mm 2mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    overflow: hidden;
    text-align: center;
  }
  .name {
    font-size: 6pt; line-height: 1.15; font-weight: 700; color: #000;
    max-height: 7mm; overflow: hidden;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }
  .bc { line-height: 0; }
  .bc svg { display: block; }
  .foot { display: flex; align-items: baseline; gap: 2mm; width: 100%; justify-content: center; }
  .code { font-family: "Courier New", monospace; font-size: 6.5pt; letter-spacing: 0.4pt; }
  .price { font-size: 8pt; font-weight: 700; }
  .incl { font-size: 4.5pt; color: #444; margin-top: -0.5mm; }
</style></head>
<body>${pages.join('')}</body></html>`;
}

/** Build the sheet and open the print dialog. */
export async function printLabels(products: Fabric[], preset: LabelPreset = LABEL_PRESETS[0]): Promise<void> {
  const { ready } = labelableProducts(products);
  if (!ready.length) throw new Error('None of the selected products have a barcode yet.');
  await printHtmlDocument(buildLabelSheet(ready, preset));
}
