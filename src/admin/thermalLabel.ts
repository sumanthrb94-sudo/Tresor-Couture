import type { Fabric } from '../types';
import { code128 } from '../lib/barcode';

/**
 * Labels for a portable thermal printer.
 *
 * These printers do not take paper sizes; they take a BITMAP exactly as wide as
 * the print head and feed it out. A 58mm printer is 384 dots across, an 80mm
 * one is 576. Send it an A4 page and its app scales the whole sheet down to the
 * roll — which is why an A4 label PDF came back as a barcode a few millimetres
 * wide, unreadable by any scanner.
 *
 * So this does not produce a page at all. It draws the label straight onto a
 * canvas at the head's exact pixel width and hands over a PNG, which every one
 * of these printers' apps accepts and prints one dot per pixel.
 *
 * Two rules make the difference between a symbol that scans and one that does
 * not, and both come from the hardware:
 *
 *  - **Whole pixels only.** A module drawn 2.9px wide is anti-aliased into grey
 *    edges; a thermal head is one bit per dot, so grey becomes black or white
 *    unpredictably and the bar widths stop being the ratios the symbol encodes.
 *    Every bar here is an integer number of dots.
 *  - **The quiet zone is part of the symbol.** Ten modules of blank either side,
 *    or a scanner cannot find where the code begins.
 *
 * Drawn with the Canvas 2D API rather than by rasterising HTML: a canvas gives
 * exact control of every dot, needs no library, and cannot be thrown off by a
 * font that failed to load.
 */

export interface ThermalSize {
  id: string;
  name: string;
  /** Roll width in millimetres, as sold. */
  rollMm: number;
  /** Print head width in dots — what the image must be. */
  dots: number;
  /** Module width in DOTS. Must be a whole number. */
  moduleDots: number;
}

/** 203dpi is universal on these printers: 8 dots per millimetre. */
const DOTS_PER_MM = 8;

export const THERMAL_SIZES: readonly ThermalSize[] = [
  // 384 dots = 48mm of printable width on a 58mm roll (the rest is margin the
  // head cannot reach). 2 dots per module puts the symbol at 264 dots ≈ 33mm,
  // comfortably inside it with quiet zones.
  { id: 'thermal-58', name: 'Thermal roll · 58 mm', rollMm: 58, dots: 384, moduleDots: 2 },
  // 576 dots = 72mm printable. 3 dots per module ≈ 49mm — a wider, more
  // forgiving symbol for a cheap scanner.
  { id: 'thermal-80', name: 'Thermal roll · 80 mm', rollMm: 80, dots: 576, moduleDots: 3 },
];

export const thermalById = (id: string | undefined): ThermalSize =>
  THERMAL_SIZES.find(s => s.id === id) ?? THERMAL_SIZES[0];

export const isThermal = (id: string | undefined): boolean =>
  THERMAL_SIZES.some(s => s.id === id);

const rupee = (n: number): string => `Rs.${Number(n || 0).toLocaleString('en-IN')}`;

const categoryOf = (p: Fabric): string => {
  const master = p.masterCategory ?? p.category ?? '';
  const sub = p.subCategory?.trim();
  return (sub && sub !== master ? `${master} · ${sub}` : String(master)).toUpperCase();
};

/** Break `text` into at most `maxLines` lines that fit `maxWidth`, ellipsising. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);

  // Anything that did not fit gets an ellipsis on the last line, rather than
  // silently disappearing.
  if (lines.length === maxLines) {
    const joined = lines.join(' ');
    if (joined.length < text.trim().length) {
      let last = lines[maxLines - 1];
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

export interface ThermalOptions {
  size?: ThermalSize;
  /** Print the category line. Off for the narrowest labels. */
  showCategory?: boolean;
}

/**
 * Draw one label and return the canvas.
 *
 * The height is whatever the content needs — a thermal roll is continuous, so
 * there is no page to fill or overflow. Everything is centred, because these
 * printers are hand-held and a centred label survives a crooked tear.
 */
export function renderThermalLabel(product: Fabric, opts: ThermalOptions = {}): HTMLCanvasElement {
  const size = opts.size ?? THERMAL_SIZES[0];
  const code = String(product.barcode ?? '').trim();
  if (!code) throw new Error('This product has no barcode yet — generate one first.');

  const { bars, modules } = code128(code);
  const QUIET = 10;
  const symbolDots = (modules + QUIET * 2) * size.moduleDots;
  if (symbolDots > size.dots) {
    throw new Error(`The barcode needs ${symbolDots} dots but the ${size.rollMm}mm head is only ${size.dots}.`);
  }

  const pad = Math.round(2 * DOTS_PER_MM);            // 2mm of white all round
  const inner = size.dots - pad * 2;
  const barHeight = Math.round(11 * DOTS_PER_MM);     // 11mm — tall enough to aim at

  // Measure first so the canvas is exactly as tall as the content.
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) throw new Error('Could not measure the label.');

  const brand = String(product.brand ?? '').toUpperCase();
  const name = String(product.name ?? '');
  const category = opts.showCategory === false ? '' : categoryOf(product);
  const mrp = Number(product.mrp ?? product.price ?? 0);
  const price = Number(product.price ?? mrp);
  const discounted = price > 0 && price < mrp;

  const F_BRAND = 18;
  const F_NAME = 22;
  const F_CAT = 15;
  const F_CODE = 20;
  const F_PRICE = 40;
  const F_WAS = 17;
  const GAP = 8;

  probe.font = `bold ${F_NAME}px Arial, Helvetica, sans-serif`;
  const nameLines = wrap(probe, name, inner, 2);

  let height = pad;
  if (brand) height += F_BRAND + GAP;
  height += nameLines.length * (F_NAME + 4) + GAP;
  if (category) height += F_CAT + GAP;
  height += barHeight + 6 + F_CODE + GAP;
  if (discounted) height += F_WAS + 2;
  height += F_PRICE + GAP;
  height += 14 + pad;                                  // "Incl. of all taxes"

  const canvas = document.createElement('canvas');
  canvas.width = size.dots;
  canvas.height = Math.round(height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not draw the label.');

  // Thermal paper is white and the head burns black. No greys anywhere.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const mid = size.dots / 2;
  let y = pad;

  if (brand) {
    ctx.font = `bold ${F_BRAND}px Arial, Helvetica, sans-serif`;
    ctx.fillText(brand, mid, y, inner);
    y += F_BRAND + GAP;
  }

  ctx.font = `bold ${F_NAME}px Arial, Helvetica, sans-serif`;
  for (const line of nameLines) {
    ctx.fillText(line, mid, y, inner);
    y += F_NAME + 4;
  }
  y += GAP;

  if (category) {
    ctx.font = `${F_CAT}px Arial, Helvetica, sans-serif`;
    ctx.fillText(category, mid, y, inner);
    y += F_CAT + GAP;
  }

  // --- The symbol, on whole dots ------------------------------------------
  // Rounded to a whole dot so the whole symbol sits on the dot grid; every bar
  // is then an exact multiple of the module width.
  let x = Math.round((size.dots - symbolDots) / 2) + QUIET * size.moduleDots;
  let isBar = true;
  for (const w of bars) {
    if (isBar) ctx.fillRect(x, y, w * size.moduleDots, barHeight);
    x += w * size.moduleDots;
    isBar = !isBar;
  }
  y += barHeight + 6;

  ctx.font = `${F_CODE}px "Courier New", monospace`;
  ctx.fillText(code, mid, y, inner);
  y += F_CODE + GAP;

  if (discounted) {
    ctx.font = `${F_WAS}px Arial, Helvetica, sans-serif`;
    const was = rupee(mrp);
    ctx.fillText(was, mid, y, inner);
    // Strike it through: a price with a line through it is a different claim
    // from the same number printed plain.
    const w = Math.min(ctx.measureText(was).width, inner);
    ctx.fillRect(mid - w / 2, y + F_WAS / 2, w, 2);
    y += F_WAS + 2;
  }

  ctx.font = `bold ${F_PRICE}px Arial, Helvetica, sans-serif`;
  ctx.fillText(rupee(price || mrp), mid, y, inner);
  y += F_PRICE + GAP;

  ctx.font = `13px Arial, Helvetica, sans-serif`;
  ctx.fillText('Incl. of all taxes', mid, y, inner);

  return canvas;
}

/**
 * Save the label as a PNG.
 *
 * A real file download, not the print dialog: the printer's own app is what
 * sends the image to the head, and it wants a picture from the gallery. On a
 * phone this lands in Downloads, ready to pick from the printer app.
 */
export async function downloadThermalLabel(product: Fabric, opts: ThermalOptions = {}): Promise<void> {
  const canvas = renderThermalLabel(product, opts);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not produce the label image.');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${String(product.barcode ?? 'label').trim()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a moment to start the download before the blob goes.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
