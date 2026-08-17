/**
 * Code 128 subset B encoder.
 *
 * Written here rather than pulled from a package for the same reason
 * `src/admin/exportKitPdf.ts` renders PDFs through the browser's own print
 * engine: this is ~100 lines of fully-specified, deterministic logic, and the
 * project has twice had to fight transitive-dependency advisories.
 *
 * Subset B covers ASCII 32–126 (digits, upper and lower case, punctuation),
 * which is everything our `TC00001`-style codes need. EAN-13 is deliberately
 * NOT used: it is numeric-only and requires a paid GS1 prefix, which buys
 * nothing for codes that never leave our own counter.
 *
 * The output is pure geometry — a list of bar/space widths in modules — so the
 * caller decides the physical size. Nothing here touches the DOM.
 *
 * ── Correctness ──────────────────────────────────────────────────────────
 * A wrong table or checksum yields labels that look perfect and do not scan,
 * which is only discovered after printing. Two guards: the unit tests in
 * tests/emulator/barcode.spec.ts check published check-digit vectors and the
 * structural invariants below, and the rollout prints ONE label to scan before
 * the rest.
 */

/**
 * The 107 Code 128 symbol patterns (values 0–106), each six digits giving the
 * widths of bar,space,bar,space,bar,space in modules. Every symbol is 11
 * modules wide except the stop pattern, which carries a 2-module final bar
 * (13 total). This table is the specification; it is verified structurally by
 * the tests rather than trusted by eye.
 */
const PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
];

/** Subset-B start symbol. */
const START_B = 104;
/** Stop symbol (the one 13-module pattern). */
const STOP = 106;

/** Values 0–102 in subset B map to ASCII 32–126. */
const MIN_CHAR = 32;
const MAX_CHAR = 126;

export interface Code128 {
  /** Alternating bar/space widths in modules, starting with a bar. */
  readonly bars: readonly number[];
  /** Total width in modules — the sum of `bars`. */
  readonly modules: number;
  /** Mod-103 check symbol value, exposed for testing. */
  readonly checksum: number;
  /** The encoded text, unchanged. */
  readonly value: string;
}

export class BarcodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BarcodeError';
  }
}

/** True when every character can be represented in subset B. */
export function encodableInCode128B(value: string): boolean {
  if (!value) return false;
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < MIN_CHAR || code > MAX_CHAR) return false;
  }
  return true;
}

/**
 * Encode `value` as Code 128-B geometry.
 *
 * The check symbol is the classic weighted sum: the start value plus each data
 * value multiplied by its 1-based position, modulo 103.
 */
export function code128(value: string): Code128 {
  if (!encodableInCode128B(value)) {
    throw new BarcodeError(
      `"${value}" cannot be encoded in Code 128-B (needs printable ASCII 32-126, non-empty)`,
    );
  }

  const symbols: number[] = [START_B];
  let weightedSum = START_B;

  let position = 0;
  for (const ch of value) {
    position += 1;
    const symbol = (ch.codePointAt(0) as number) - MIN_CHAR;
    symbols.push(symbol);
    weightedSum += symbol * position;
  }

  const checksum = weightedSum % 103;
  symbols.push(checksum, STOP);

  const bars: number[] = [];
  for (const symbol of symbols) {
    for (const width of PATTERNS[symbol]) {
      bars.push(Number(width));
    }
  }

  return {
    bars,
    modules: bars.reduce((sum, w) => sum + w, 0),
    checksum,
    value,
  };
}

/**
 * Render a barcode as an SVG string.
 *
 * Returned as a string rather than JSX so the same function serves both the
 * React admin UI and the print-document builder, which assembles raw HTML.
 * `moduleWidth` is the width of one module in millimetres — at 0.25mm a
 * 7-character code such as TC00001 occupies 33mm including quiet zones, half
 * of a standard 63.5 x 38.1mm label, leaving the rest for name and price.
 */
export function code128Svg(
  value: string,
  opts: { moduleWidth?: number; height?: number; quietZone?: number } = {},
): string {
  const moduleWidth = opts.moduleWidth ?? 0.25;
  const height = opts.height ?? 12;
  // The spec requires a quiet zone of at least 10 modules on each side; without
  // it a scanner cannot find the symbol's edges.
  const quietModules = opts.quietZone ?? 10;

  const { bars, modules } = code128(value);
  const totalModules = modules + quietModules * 2;
  const width = totalModules * moduleWidth;

  let x = quietModules;
  let isBar = true;
  const rects: string[] = [];
  for (const w of bars) {
    if (isBar) {
      rects.push(
        `<rect x="${(x * moduleWidth).toFixed(3)}" y="0" width="${(w * moduleWidth).toFixed(3)}" height="${height}" fill="#000"/>`,
      );
    }
    x += w;
    isBar = !isBar;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(2)}mm" height="${height}mm" ` +
    `viewBox="0 0 ${width.toFixed(3)} ${height}" shape-rendering="crispEdges" role="img" ` +
    `aria-label="Barcode ${value}">` +
    `<rect x="0" y="0" width="${width.toFixed(3)}" height="${height}" fill="#fff"/>` +
    rects.join('') +
    `</svg>`
  );
}

/** Width in millimetres a rendered barcode will occupy, quiet zones included. */
export function code128WidthMm(value: string, moduleWidth = 0.25, quietZone = 10): number {
  return (code128(value).modules + quietZone * 2) * moduleWidth;
}
