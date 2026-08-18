import { test, expect } from '@playwright/test';
import { Recorder } from './lib/recorder';
import { LABEL_DESIGNS, buildSingleLabel, buildLabelSheet, labelableProducts, designById } from '../../src/admin/printLabels';
import { code128 } from '../../src/lib/barcode';
import { THERMAL_SIZES, isThermal, thermalById } from '../../src/admin/thermalLabel';
import type { Fabric } from '../../src/types';

/**
 * What a price tag has to say, on every design.
 *
 * The designs differ in shape and in what they do with spare room, but four
 * things are not optional: the brand, what the piece is, what it costs, and a
 * code the till can scan. A design that quietly drops one is a tag that gets
 * printed on three hundred pieces before anyone notices.
 *
 * The physical assertions matter as much as the content ones. A barcode that
 * overflows its label is cropped by the printer and will not scan; bars below
 * about 0.19mm merge on a 203dpi thermal head. Neither is visible on screen.
 */

const piece = (over: Partial<Fabric> = {}): Fabric => ({
  id: 'p', brand: 'TRESOR COUTURE', name: 'Zardozi Floral Lehenga · Rose',
  description: '', price: 32999, mrp: 35999, photo: '', image: '',
  category: 'Lehenga Cholis', masterCategory: 'Lehenga Cholis', subCategory: 'Zardozi Floral',
  tags: [], stock: 3, barcode: 'TC00042', ...over,
});

/** TC + 5 digits: 112 bar modules plus a 10-module quiet zone each side. */
const CODE_MODULES = 112 + 20;

test('Labels · every design carries brand, piece, price and a scannable code', async () => {
  const rec = new Recorder({
    slug: 'label-designs',
    title: 'Labels · the four designs',
    area: 'Admin console · Labels',
    purpose:
      'Four label designs, for a lace reel and a bridal lehenga and everything between. Whichever is chosen, the tag must carry the brand, the piece, the price and a scannable code — and the symbol must physically fit the stock it is printed on.',
    reproduce: [
      'Admin → Products → edit a piece → Publishing & Barcode → pick a design → Download label (PDF).',
      'Admin → Inventory → pick a design → Print labels for a whole sheet.',
      'docs/ops/barcode-label-designs.pdf shows all four at true size.',
    ],
  });

  try {
    expect(LABEL_DESIGNS.length).toBeGreaterThanOrEqual(4);
    // The default is the small sticker: it is what gets printed by the hundred.
    expect(designById(undefined).id).toBe('sticker-40x20');

    for (const d of LABEL_DESIGNS) {
      const html = buildSingleLabel(piece(), d);

      // --- What the tag says --------------------------------------------
      // Three things are not optional on any design. A tag that says only a
      // price and a code tells a customer nothing and tells staff nothing at
      // a glance.
      expect(html, `${d.id}: name`).toContain('Zardozi Floral Lehenga');
      expect(html, `${d.id}: code`).toContain('TC00042');
      expect(html, `${d.id}: price`).toContain('₹32,999');

      // Brand and category are per-design, and DECLARED — so dropping a line
      // is a visible decision rather than something that quietly happened.
      // The stickers omit the brand because they go onto the round brand tag,
      // which already carries it.
      expect(html.includes('TRESOR COUTURE'), `${d.id}: brand vs carries`)
        .toBe(d.carries.includes('brand'));
      expect(html.includes('Lehenga Cholis'), `${d.id}: category vs carries`)
        .toBe(d.carries.includes('category'));

      // --- The symbol is real, not a picture of one ----------------------
      expect(html, `${d.id}: svg`).toContain('<svg');
      expect(html, `${d.id}: aria`).toContain('aria-label="Barcode TC00042"');

      // --- It physically fits -------------------------------------------
      const moduleWidth = Math.min(0.4, Math.max(0.19, (d.width * d.codeSpan) / CODE_MODULES));
      const codeWidthMm = CODE_MODULES * moduleWidth;
      expect(codeWidthMm, `${d.id}: symbol wider than the label`).toBeLessThanOrEqual(d.width);
      // A 203dpi thermal head cannot resolve a bar narrower than this.
      expect(moduleWidth, `${d.id}: bars too fine to print`).toBeGreaterThanOrEqual(0.19);
      // Height enough for a hand scanner to find the symbol.
      expect(d.codeHeight, `${d.id}: symbol too short to scan`).toBeGreaterThanOrEqual(6);
      expect(d.codeHeight, `${d.id}: symbol taller than the label`).toBeLessThan(d.height);

      // --- The sheet geometry is physically possible ---------------------
      const usedX = d.columns * d.width + (d.columns - 1) * d.gapX + d.page.marginX * 2;
      const usedY = d.rows * d.height + (d.rows - 1) * d.gapY + d.page.marginY * 2;
      expect(usedX, `${d.id}: columns overflow the page`).toBeLessThanOrEqual(d.page.width + 0.01);
      expect(usedY, `${d.id}: rows overflow the page`).toBeLessThanOrEqual(d.page.height + 0.01);
    }
    rec.note('All four designs are complete and printable', 'Content, symbol size and sheet geometry checked per design.');

    // --- A discount prints both figures ----------------------------------
    // Printing only the lower number makes the tag disagree with the invoice;
    // printing only the MRP has the customer expecting to pay more.
    const classic = buildSingleLabel(piece(), designById('classic'));
    expect(classic).toContain('₹35,999');
    expect(classic).toContain('₹32,999');

    // At full price there is nothing to strike through.
    const full = buildSingleLabel(piece({ price: 1500, mrp: 1500 }), designById('classic'));
    expect(full).toContain('₹1,500');
    expect(full).not.toContain('line-through">₹');
    rec.note('Discounts show both prices', 'MRP struck through beside what the till will charge.');

    // --- The category line, where a design keeps it -----------------------
    const detailed = buildSingleLabel(piece(), designById('detailed'));
    expect(detailed).toContain('Lehenga Cholis · Zardozi Floral');
    // No subcategory means no dangling separator.
    const plain = buildSingleLabel(piece({ subCategory: undefined }), designById('detailed'));
    expect(plain).toContain('Lehenga Cholis');
    expect(plain).not.toContain('Lehenga Cholis ·');

    // --- Text is escaped, not injected ------------------------------------
    const hostile = buildSingleLabel(piece({ name: '<script>alert(1)</script>' }), designById('classic'));
    expect(hostile).not.toContain('<script>');
    expect(hostile).toContain('&lt;script&gt;');
    rec.note('Product text cannot break the document', 'Names are escaped before they reach the label.');

    // --- Sheets: only barcoded products, paginated ------------------------
    const many = Array.from({ length: 30 }, (_, i) => piece({ id: `p${i}`, barcode: `TC${String(i + 1).padStart(5, '0')}` }));
    const withoutCodes = [...many, piece({ id: 'nocode', barcode: undefined })];
    const { ready, missing } = labelableProducts(withoutCodes);
    expect(ready).toHaveLength(30);
    expect(missing).toHaveLength(1);

    const d0 = LABEL_DESIGNS[0];
    const sheet = buildLabelSheet(withoutCodes, d0);
    const pages = sheet.split('class="sheet"').length - 1;
    expect(pages).toBe(Math.ceil(30 / (d0.columns * d0.rows)));
    // A product with no barcode is skipped rather than printed blank — a label
    // with no symbol is a piece the till cannot ring up.
    expect(sheet).not.toContain('id="nocode"');
    rec.note('Un-barcoded products are skipped, not printed blank', 'Reported to the operator instead.');

    // --- Thermal rolls -----------------------------------------------------
    // A thermal head is one bit per dot at 203dpi. These numbers are the
    // difference between a symbol that scans and one that does not, and none
    // of them is visible on screen.
    const QUIET = 10;
    for (const t of THERMAL_SIZES) {
      // Whole dots only: a module 2.9 dots wide is anti-aliased into greys,
      // and a head that can only burn or not burn turns those into bar widths
      // the symbol never encoded.
      expect(Number.isInteger(t.moduleDots), `${t.id}: fractional module`).toBe(true);
      // One dot per module is too fine for these printers to hold apart.
      expect(t.moduleDots, `${t.id}: module too fine`).toBeGreaterThanOrEqual(2);

      const symbolDots = (code128('TC00042').modules + QUIET * 2) * t.moduleDots;
      expect(symbolDots, `${t.id}: symbol wider than the head`).toBeLessThanOrEqual(t.dots);
      // Worth having at all: a symbol under half the roll wastes the width and
      // gives a cheap scanner less to find.
      expect(symbolDots, `${t.id}: symbol too narrow to bother`).toBeGreaterThan(t.dots * 0.5);

      // 203dpi is 8 dots/mm, and the head never reaches the full roll width.
      expect(t.dots / 8, `${t.id}: head wider than the roll`).toBeLessThan(t.rollMm);
    }

    // The picker has to be able to tell the two kinds apart — a thermal id
    // routed to the A4 print dialog is exactly the bug this fixes.
    expect(isThermal('thermal-58')).toBe(true);
    expect(isThermal('classic')).toBe(false);
    expect(isThermal(undefined)).toBe(false);
    expect(thermalById('thermal-80').dots).toBe(576);
    expect(thermalById('nonsense').dots).toBe(384);   // falls back to 58mm
    rec.note('Thermal labels are sized in dots, not millimetres', 'These printers take a bitmap the width of the head; an A4 page gets scaled onto the roll and the barcode becomes unscannable.');

    // The encoder still agrees with the label — the one thing that would make
    // every design wrong at once.
    expect(code128('TC00042').modules).toBe(11 * (7 + 2) + 13);

    rec.finish('passed');
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});
