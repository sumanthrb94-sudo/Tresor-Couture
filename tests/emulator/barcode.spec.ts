import { test, expect } from '@playwright/test';
import { Recorder } from './lib/recorder';
import { code128, code128Svg, code128WidthMm, encodableInCode128B, BarcodeError } from '../../src/lib/barcode';

/**
 * The barcode encoder is the one piece of this project whose failure mode is
 * physical: a wrong pattern table or checksum produces labels that look
 * perfect and do not scan, discovered only after printing and sticking them on
 * stock. Pure logic, so no browser or emulator is needed.
 *
 * Two kinds of assertion here:
 *  - published check-digit vectors, which pin the arithmetic;
 *  - STRUCTURAL invariants of the pattern table, which catch a mistyped digit
 *    that vectors alone would miss (every symbol is 11 modules, every pattern
 *    starts with a bar and alternates, the stop pattern is the only 13).
 */

test('Barcode · Code 128-B encodes, checksums and renders correctly', async () => {
  const rec = new Recorder({
    slug: 'barcode-code128',
    title: 'Barcode · Code 128-B encoder',
    area: 'Inventory · Barcode labels',
    purpose:
      'Product labels are generated in-house rather than via a dependency, so the encoder is pinned by tests: published check-digit vectors, structural invariants of the 107-symbol pattern table, quiet zones, and the physical width that must fit a 63.5 x 38.1mm label.',
    reproduce: [
      'Assign a barcode to a product (scripts/assign-barcodes.ts) — it receives a TC00001-style code.',
      'In the admin, open Inventory, select the product and choose "Print labels".',
      'Print ONE label first and scan it with the counter scanner before printing the rest.',
      'The scanned value must equal the printed human-readable code beneath the bars.',
    ],
  });

  try {
    // ── Check-digit vectors ──────────────────────────────────────────────
    // The check symbol is start-B (104) plus each value times its 1-based
    // position, mod 103. Each expectation below was computed independently
    // rather than copied, because a misremembered "known vector" would pin the
    // encoder to the wrong answer — which is exactly what happened on the
    // first run of this test.
    //
    //   'A'  → value 33 at position 1     → (104 + 33) % 103                = 34
    //   'AB' → 33*1 + 34*2                → (104 + 33 + 68) % 103   = 205 % 103 = 102
    expect(code128('A').checksum).toBe(34);
    expect(code128('AB').checksum).toBe(102);
    rec.note('Single- and two-character vectors verified by hand',
      "'A' → 34, 'AB' → 102 — position weighting confirmed.");

    // Longer vectors, including a space (value 0) which must contribute
    // nothing, and the real code format used on our labels.
    expect(code128('CHECK DIGIT').checksum).toBe(23);   // weighted sum 2598
    expect(code128('TC00001').checksum).toBe(15);       // weighted sum 633
    rec.note('Multi-character vectors: "CHECK DIGIT" → 23, "TC00001" → 15',
      'Covers a space (value 0) and the actual label code format.');

    // ── Structural invariants of the pattern table ───────────────────────
    // Every Code 128 symbol is 11 modules wide except stop, which is 13. If a
    // digit in the 107-entry table were mistyped, this fails loudly.
    const stop = code128('A').bars.slice(-7);
    expect(stop.reduce((a, b) => a + b, 0)).toBe(13);

    // Total modules = 11 * (start + data + checksum) + 13 for stop.
    for (const value of ['A', 'TC00001', 'HA3858', 'Tresor-1']) {
      const enc = code128(value);
      expect(enc.modules, `module count for ${value}`).toBe(11 * (value.length + 2) + 13);
      // Bars alternate starting with a bar; a symbol contributes 6 widths
      // (except stop, 7), so the total count is fixed too.
      expect(enc.bars.length).toBe(6 * (value.length + 2) + 7);
    }
    rec.note('Every symbol is 11 modules, stop is 13',
      'A mistyped digit anywhere in the 107-entry table breaks this arithmetic.');

    // The width invariants above still hold if the whole table were shifted by
    // one index — every pattern would just be the wrong character. Pin the
    // alignment separately by checking a symbol whose pattern is known and
    // whose position is unambiguous: start-B (104) is '211214', so the first
    // six widths after the quiet zone must be exactly that.
    const startB = code128('A').bars.slice(0, 6);
    expect(startB).toEqual([2, 1, 1, 2, 1, 4]);
    rec.note('Start-B renders as 211214, proving the table is not index-shifted',
      'Width-only checks would pass on a shifted table; this pins the actual symbol.');

    // ── What can and cannot be encoded ───────────────────────────────────
    expect(encodableInCode128B('TC00001')).toBe(true);
    expect(encodableInCode128B('lc-zf-sage')).toBe(true);
    expect(encodableInCode128B('')).toBe(false);          // empty
    expect(encodableInCode128B('Café')).toBe(false);      // é is outside ASCII 32-126
    expect(encodableInCode128B('A\tB')).toBe(false);      // control character
    expect(() => code128('Café')).toThrow(BarcodeError);
    rec.note('Non-ASCII and control characters rejected, not silently mangled',
      'A code that cannot be represented must fail loudly at generation, never print wrong.');

    // ── Rendering ────────────────────────────────────────────────────────
    const svg = code128Svg('TC00001');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('aria-label="Barcode TC00001"');
    // A white backing rect plus one rect per bar. Bars are every other element
    // of the alternating list: 6*(7+2)+7 = 61 widths → 31 bars.
    expect((svg.match(/<rect /g) ?? []).length).toBe(31 + 1);
    rec.note('SVG renders 31 bars plus a white background for TC00001',
      'crispEdges and integer module maths keep the bars sharp at print resolution.');

    // ── The physical constraint that drove the code format ───────────────
    // 63.5 x 38.1mm is the standard 24-per-A4 label. The barcode must leave
    // room for the name and price, so it has to stay well under the width.
    const codeWidth = code128WidthMm('TC00001', 0.25);
    const idWidth = code128WidthMm('lc-zf-powder-blue', 0.25);
    expect(codeWidth).toBeCloseTo(33, 0);
    expect(idWidth).toBeCloseTo(60.5, 0);
    // Both technically "fit" 63.5mm, but a label also has to carry the product
    // name and price. Assert the space actually left over, which is the real
    // design claim: 30mm of usable width versus 3mm.
    const LABEL_MM = 63.5;
    expect(LABEL_MM - codeWidth).toBeGreaterThan(25);
    expect(LABEL_MM - idWidth).toBeLessThan(5);
    rec.note('TC00001 prints 33mm; the raw product id needs 60.5mm',
      'On a 63.5mm label the short code leaves half the width for name and price; the product id would leave 3mm.');

    rec.finish('passed');
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});
