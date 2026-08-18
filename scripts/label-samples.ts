/**
 * Regenerate the printable label samples in docs/ops.
 *
 *   npx tsx scripts/label-samples.ts
 *
 * preferCSSPageSize honours the @page rule the designs carry, so the PDF comes
 * out at the size the sheet declares rather than Chromium's default.
 */
import { chromium } from '@playwright/test';
import { LABEL_DESIGNS, buildLabelSheet, designById } from '../src/admin/printLabels';
import type { LabelDesign } from '../src/admin/printLabels';
import type { Fabric } from '../src/types';

const OUT = new URL('../docs/ops/', import.meta.url).pathname;

const NAMES = [
  'Zardozi Floral Lehenga · Rose', 'Chantilly Lace · Ivory', 'Banarasi Silk Saree · Gold',
  'Kundan Border Trim · 2in', 'Organza Ruffle · Blush', 'Sequin Net · Midnight',
  'Velvet Piping · Wine', 'Tissue Silk · Champagne', 'Gota Patti Lace · Antique',
  'Crepe Georgette · Sage', 'Pearl Beaded Trim · 1in', 'Raw Silk · Rust',
];
const PRICE = [899, 2450, 32999, 349, 1299];
const MRP = [999, 2450, 35999, 399, 1299];

const piece = (i: number): Fabric => ({
  id: `s${i}`, brand: 'TRESOR COUTURE', name: NAMES[i % NAMES.length],
  description: '', price: PRICE[i % 5], mrp: MRP[i % 5],
  photo: '', image: '', category: 'Laces', masterCategory: 'Laces',
  subCategory: 'Chantilly', tags: [], stock: 4,
  barcode: `TC${String(i + 1).padStart(5, '0')}`,
});

const full = (d: LabelDesign): Fabric[] =>
  Array.from({ length: d.columns * d.rows }, (_, i) => piece(i));

/** The <section> out of a built sheet, tagged with the design's id. */
const sectionOf = (d: LabelDesign): string =>
  buildLabelSheet(full(d), d)
    .split('<body>')[1].split('</body>')[0]
    .replace('<section class="sheet"', `<section id="${d.id}" class="sheet"`);

/**
 * Every design's CSS, nested under its own id.
 *
 * The designs all use the same class names, so a single document showing all of
 * them needs each one's rules scoped. Native CSS nesting does it in one wrap
 * rather than rewriting selectors.
 */
const scopedCss = (d: LabelDesign): string => `
  #${d.id} {
    width: ${d.page.width}mm; height: ${d.page.height}mm;
    padding: ${d.page.marginY}mm ${d.page.marginX}mm;
    display: grid;
    grid-template-columns: repeat(${d.columns}, ${d.width}mm);
    grid-auto-rows: ${d.height}mm;
    column-gap: ${d.gapX}mm; row-gap: ${d.gapY}mm;
    page-break-after: always; align-content: start; justify-content: center;
    position: relative;
    .caption { position: absolute; top: 3.5mm; left: 0; right: 0; text-align: center;
               font-size: 6pt; color: #888; letter-spacing: 0.04em; }
    .label { width: ${d.width}mm; height: ${d.height}mm;
             display: flex; flex-direction: column; overflow: hidden; }
    .bc { line-height: 0; }
    .bc svg { display: block; margin: 0 auto; }
    ${d.css}
  }`;

const caption = (d: LabelDesign): string =>
  `${d.name} · ${d.width} × ${d.height} mm · ${d.columns * d.rows} per A4 · ` +
  `${d.stock === 'die-cut' ? 'die-cut stock' : `${d.page.marginX}mm / ${d.page.marginY}mm border`}`;

async function main() {
  // CHROMIUM_PATH is the escape hatch for a machine whose installed browser does
  // not match the version this Playwright expects — the samples are worth
  // regenerating without a 150MB download.
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  const page = await browser.newPage();

  const write = async (html: string, file: string) => {
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({ path: `${OUT}${file}`, printBackground: true, preferCSSPageSize: true });
    console.log(`  ${file}`);
  };

  console.log('Writing:');

  // 1. Every design, one full sheet each, captioned in the top margin.
  const sheets = LABEL_DESIGNS.map(
    d => sectionOf(d).replace('>', `><div class="caption">${caption(d)}</div>`),
  ).join('');
  await write(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Tresor Couture · label designs</title>
     <style>
       @page { size: 210mm 297mm; margin: 0; }
       * { box-sizing: border-box; }
       html, body { margin: 0; padding: 0; background: #fff; }
       body { font-family: Arial, Helvetica, sans-serif; color: #000;
              -webkit-print-color-adjust: exact; print-color-adjust: exact; }
       .sheet:last-child { page-break-after: auto; }
       ${LABEL_DESIGNS.map(scopedCss).join('')}
     </style></head><body>${sheets}</body></html>`,
    'barcode-label-designs.pdf',
  );

  // 2 & 3. The two hand-cut sheets, exactly as they print — no caption.
  const sticker = designById('sticker-38x20');
  await write(buildLabelSheet(full(sticker), sticker), 'barcode-sticker-sheet-SAMPLE.pdf');

  const cut = designById('a4-cut');
  await write(buildLabelSheet(full(cut), cut), 'barcode-cut-sheet-SAMPLE.pdf');

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
