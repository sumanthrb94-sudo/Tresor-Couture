/**
 * "Download kit as PDF" — builds a self-contained brand-book document from the
 * same manifest the Brand Kit page renders, then prints it to PDF.
 *
 * Why print-to-PDF instead of a PDF library: the kit is fundamentally a
 * styled document (palette, type specimens, voice, an illustrated asset
 * index). Rendering it as HTML and printing keeps text vector-sharp, paginates
 * cleanly, and embeds the real logo/social images — with zero new
 * dependencies. The browser's print dialog offers "Save as PDF" as the
 * destination; the document <title> becomes the suggested filename.
 *
 * The work happens in a hidden same-origin iframe (not window.open, which gets
 * popup-blocked). Images are preloaded before printing so nothing is blank.
 */

import {
  COLOR_TOKENS,
  KIT_SECTIONS,
  TYPOGRAPHY,
  VOICE_NOTES,
  type KitAsset,
} from './kitManifest';
import { printHtmlDocument } from './printDocument';

const DOC_TITLE = 'Tresor-Couture-Brand-Kit';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Root-relative manifest URLs → absolute so they resolve inside the iframe. */
function abs(url: string): string {
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
}

/** png/jpg/svg render as a thumbnail; ico/html show a labelled placeholder. */
function assetThumb(a: KitAsset): string {
  if (a.kind === 'png' || a.kind === 'jpg' || a.kind === 'svg') {
    return `<img class="thumb" src="${esc(abs(a.url))}" alt="${esc(a.name)}" />`;
  }
  return `<div class="thumb placeholder">${esc(a.kind.toUpperCase())}</div>`;
}

function assetCard(a: KitAsset): string {
  return `
    <div class="asset">
      <div class="asset-thumb">${assetThumb(a)}</div>
      <div class="asset-meta">
        <div class="asset-head">
          <span class="asset-name">${esc(a.name)}</span>
          <span class="asset-size">${esc(a.size)}</span>
        </div>
        <p class="asset-desc">${esc(a.description)}</p>
        <code class="asset-url">${esc(a.url)}</code>
      </div>
    </div>`;
}

function buildDocument(): string {
  const totalAssets = KIT_SECTIONS.reduce((n, s) => n + s.assets.length, 0);
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const palette = COLOR_TOKENS.map(
    t => `
      <div class="swatch">
        <div class="swatch-chip" style="background:${esc(t.hex)}"></div>
        <div class="swatch-body">
          <div class="swatch-name">${esc(t.name)}</div>
          <div class="swatch-hex">${esc(t.hex)}</div>
          <div class="swatch-role">${esc(t.role)}</div>
          <code class="swatch-css">${esc(t.css)}</code>
        </div>
      </div>`,
  ).join('');

  const voice = VOICE_NOTES.map(
    (n, i) => `<li><span class="voice-num">${String(i + 1).padStart(2, '0')}</span><span>${esc(n)}</span></li>`,
  ).join('');

  const sections = KIT_SECTIONS.map(
    (s, idx) => `
      <section class="kit-section">
        <div class="sec-head">
          <span class="sec-eyebrow">${String(idx + 4).padStart(2, '0')}</span>
          <h2>${esc(s.title)}</h2>
          <p>${esc(s.blurb)}</p>
        </div>
        <div class="asset-grid">${s.assets.map(assetCard).join('')}</div>
      </section>`,
  ).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${DOC_TITLE}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
    color: #2A1F12; background: #F5ECDC; font-size: 11px; line-height: 1.5;
  }
  .serif { font-family: 'Cormorant Garamond', 'Times New Roman', serif; }
  code { font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace; }

  /* Cover */
  .cover {
    background: #2A1F12; color: #F5ECDC; padding: 60mm 18mm; min-height: 100vh;
    page-break-after: always; display: flex; flex-direction: column; justify-content: center;
  }
  .cover .eyebrow { letter-spacing: .35em; text-transform: uppercase; font-size: 10px; color: #D8B97A; margin-bottom: 14px; }
  .cover h1 { font-size: 58px; line-height: 1.02; margin: 0 0 18px; font-weight: 500; }
  .cover .brand { font-size: 16px; letter-spacing: .25em; text-transform: uppercase; color: #D8B97A; }
  .cover .meta { margin-top: 40px; font-size: 11px; color: #D8B97A; }

  .page { padding: 0 2mm; }
  .sec-head { margin: 0 0 14px; }
  .sec-eyebrow { font-family: ui-monospace, monospace; letter-spacing: .3em; font-size: 10px; color: #8E6520; display: block; margin-bottom: 4px; }
  .sec-head h2 { font-family: 'Cormorant Garamond', serif; font-size: 30px; margin: 0 0 4px; font-weight: 500; }
  .sec-head p { margin: 0; max-width: 150mm; color: #46382A; }
  section { page-break-inside: avoid; margin-bottom: 16px; }
  .kit-section { page-break-before: auto; }

  /* Palette */
  .swatch-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .swatch { display: flex; gap: 10px; border: 1px solid rgba(184,137,58,.3); background: #FBF5EA; padding: 8px; page-break-inside: avoid; }
  .swatch-chip { width: 56px; height: 56px; flex: 0 0 56px; border: 1px solid rgba(42,31,18,.15); }
  .swatch-name { font-family: ui-monospace, monospace; font-weight: 700; font-size: 11px; }
  .swatch-hex { font-family: ui-monospace, monospace; font-size: 10px; color: #8E6520; }
  .swatch-role { font-size: 10px; color: #46382A; margin: 3px 0; }
  .swatch-css { font-size: 9px; color: #8E6520; }

  /* Typography */
  .type-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .type-card { border: 1px solid rgba(184,137,58,.3); background: #FBF5EA; padding: 14px; page-break-inside: avoid; }
  .type-card .label { letter-spacing: .25em; text-transform: uppercase; font-size: 9px; color: #8E6520; font-weight: 700; }
  .type-card .big { font-size: 46px; line-height: 1; margin: 6px 0; }
  .type-card .specimen { font-size: 18px; margin-bottom: 8px; }
  .type-card .use { font-size: 10px; color: #46382A; }
  .type-card .weights { font-family: ui-monospace, monospace; font-size: 9px; color: #8E6520; margin-top: 6px; }
  .type-card .fam { font-family: ui-monospace, monospace; font-size: 9px; color: #2A1F12; margin-top: 4px; word-break: break-all; }

  /* Voice */
  ol.voice { list-style: none; margin: 0; padding: 0; }
  ol.voice li { display: flex; gap: 10px; border: 1px solid rgba(184,137,58,.3); background: #FBF5EA; padding: 8px 10px; margin-bottom: 6px; page-break-inside: avoid; }
  .voice-num { font-family: 'Cormorant Garamond', serif; color: #B8893A; font-size: 22px; line-height: 1; width: 26px; flex: 0 0 26px; }

  /* Assets */
  .asset-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .asset { border: 1px solid rgba(184,137,58,.3); background: #FBF5EA; page-break-inside: avoid; display: flex; flex-direction: column; }
  .asset-thumb { background: #F5ECDC; aspect-ratio: 16 / 10; display: flex; align-items: center; justify-content: center; overflow: hidden; border-bottom: 1px solid rgba(184,137,58,.2); }
  .thumb { max-width: 100%; max-height: 100%; object-fit: contain; }
  .thumb.placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #8E6520; letter-spacing: .18em; font-size: 11px; }
  .asset-meta { padding: 7px 8px; }
  .asset-head { display: flex; justify-content: space-between; gap: 6px; }
  .asset-name { font-weight: 600; font-size: 10.5px; }
  .asset-size { font-size: 8px; letter-spacing: .12em; text-transform: uppercase; color: #8E6520; white-space: nowrap; }
  .asset-desc { font-size: 9px; color: #46382A; margin: 3px 0 5px; }
  .asset-url { font-size: 8px; color: #8E6520; word-break: break-all; }

  .divider { height: 1px; background: rgba(184,137,58,.3); margin: 18px 0; }
  .foot { text-align: center; font-size: 9px; color: #8E6520; margin-top: 18px; letter-spacing: .15em; text-transform: uppercase; }
</style>
</head>
<body>
  <div class="cover">
    <div class="eyebrow">The Atelier · Brand Guidelines</div>
    <h1 class="serif">Brand<br/>Identity Kit</h1>
    <div class="brand">Tresor · Couture</div>
    <div class="meta">${esc(today)} · ${totalAssets} assets · single source of truth</div>
  </div>

  <div class="page">
    <section>
      <div class="sec-head"><span class="sec-eyebrow">01</span><h2 class="serif">Palette</h2><p>Warm cream canvas, deep ink, gold accents. Hex + CSS token for each.</p></div>
      <div class="swatch-grid">${palette}</div>
    </section>

    <section>
      <div class="sec-head"><span class="sec-eyebrow">02</span><h2 class="serif">Typography</h2><p>Serif headlines, sans for everything else.</p></div>
      <div class="type-grid">
        <div class="type-card">
          <div class="label">Serif · Cormorant Garamond</div>
          <div class="big serif">Aa</div>
          <div class="specimen serif"><em>The weaves return home.</em></div>
          <div class="use">${esc(TYPOGRAPHY.serif.use)}</div>
          <div class="weights">Weights: ${esc(TYPOGRAPHY.serif.weights)}</div>
          <div class="fam">${esc(TYPOGRAPHY.serif.family)}</div>
        </div>
        <div class="type-card">
          <div class="label">Sans · Inter</div>
          <div class="big" style="font-weight:700">Aa</div>
          <div class="specimen" style="letter-spacing:.2em;text-transform:uppercase">The Atelier Note</div>
          <div class="use">${esc(TYPOGRAPHY.sans.use)}</div>
          <div class="weights">Weights: ${esc(TYPOGRAPHY.sans.weights)}</div>
          <div class="fam">${esc(TYPOGRAPHY.sans.family)}</div>
        </div>
      </div>
    </section>

    <section>
      <div class="sec-head"><span class="sec-eyebrow">03</span><h2 class="serif">Voice &amp; Tone</h2><p>How the brand speaks. Five rules — break sparingly.</p></div>
      <ol class="voice">${voice}</ol>
    </section>

    <div class="divider"></div>
    ${sections}

    <div class="foot">Tresor Couture · Brand Identity Kit · regenerate via python3 branding/generate.py</div>
  </div>
</body>
</html>`;
}

/** Wait for every <img> in the doc to finish (load or error), with a cap. */

/**
 * Build the brand book and open the print dialog (choose "Save as PDF").
 * Resolves once printing has been triggered.
 */
export async function downloadKitAsPdf(): Promise<void> {
  await printHtmlDocument(buildDocument());
}
