/**
 * Turns recorded end-to-end runs into downloadable PDF reports.
 *
 * Reads every tests/emulator/artifacts/<slug>/steps.json produced by the
 * Recorder, renders each into a self-contained HTML page (screenshots inlined as
 * base64 so the PDF needs no external files), and prints it to
 * docs/test-reports/<slug>.pdf via headless Chromium. Also writes an index PDF
 * summarising every test.
 *
 * Usage:  npx tsx scripts/build-test-report.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from '@playwright/test';
import type { TestRecord } from '../tests/emulator/lib/recorder';

const ARTIFACTS = path.resolve(process.cwd(), 'tests/emulator/artifacts');
const OUT = path.resolve(process.cwd(), 'docs/test-reports');

const CSS = `
  :root { --ink:#2A2520; --soft:#6B6153; --line:#E4DCCB; --gold:#B8915A; --bg:#FBF7EE; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: var(--ink); margin: 0; padding: 32px 36px; background: #fff; font-size: 12px; }
  h1 { font-size: 21px; margin: 0 0 2px; letter-spacing: -0.01em; }
  .sub { color: var(--soft); font-size: 12px; margin: 0 0 16px; }
  .meta { background: var(--bg); border: 1px solid var(--line); border-radius: 6px;
          padding: 12px 14px; margin-bottom: 18px; }
  .meta dl { display: grid; grid-template-columns: 130px 1fr; gap: 4px 12px; margin: 0; }
  .meta dt { color: var(--soft); font-weight: 600; }
  .meta dd { margin: 0; }
  .badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-weight: 700;
           font-size: 11px; letter-spacing: .04em; }
  .pass { background: #E5EFDB; color: #2F6E2F; }
  .fail { background: #FBE6E6; color: #A12626; }
  h2 { font-size: 13px; margin: 22px 0 8px; text-transform: uppercase;
       letter-spacing: .12em; color: var(--soft); }
  ol.repro { margin: 0 0 4px; padding-left: 18px; }
  ol.repro li { margin-bottom: 3px; }
  .step { border: 1px solid var(--line); border-radius: 6px; margin-bottom: 12px;
          overflow: hidden; page-break-inside: avoid; break-inside: avoid; }
  .step-h { padding: 8px 12px; background: var(--bg); border-bottom: 1px solid var(--line);
            display: flex; gap: 9px; align-items: baseline; }
  .num { font-weight: 800; color: var(--gold); min-width: 20px; }
  .title { font-weight: 700; }
  .tick { color: #2F6E2F; font-weight: 800; }
  .detail { color: var(--soft); padding: 7px 12px 0; }
  .step img { display: block; width: 100%; border-top: 1px solid var(--line); }
  .noshot { padding: 8px 12px; color: var(--soft); font-style: italic; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--soft); text-transform: uppercase; font-size: 10px; letter-spacing: .1em; }
  code { background: var(--bg); padding: 1px 5px; border-radius: 3px; font-size: 11px; }
`;

const esc = (s: string): string =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function dataUri(file: string): string {
  return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
}

function renderTest(rec: TestRecord, dir: string): string {
  const dur = rec.finishedAt
    ? `${((new Date(rec.finishedAt).getTime() - new Date(rec.startedAt).getTime()) / 1000).toFixed(1)}s`
    : '—';
  const steps = rec.steps.map(s => {
    const shot = s.screenshot && fs.existsSync(path.join(dir, s.screenshot))
      ? `<img src="${dataUri(path.join(dir, s.screenshot))}" alt="Step ${s.n}">`
      : `<p class="noshot">No screenshot — data assertion.</p>`;
    return `<div class="step">
      <div class="step-h">
        <span class="num">${s.n}</span>
        <span class="title">${s.kind === 'assert' ? '<span class="tick">✓</span> ' : ''}${esc(s.title)}</span>
      </div>
      ${s.detail ? `<p class="detail">${esc(s.detail)}</p>` : ''}
      ${shot}
    </div>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <h1>${esc(rec.title)}</h1>
    <p class="sub">Tresor Couture · automated end-to-end test report</p>
    <div class="meta"><dl>
      <dt>Area</dt><dd>${esc(rec.area)}</dd>
      <dt>Test id</dt><dd><code>${esc(rec.slug)}</code></dd>
      <dt>Result</dt><dd><span class="badge ${rec.status === 'passed' ? 'pass' : 'fail'}">${(rec.status ?? 'unknown').toUpperCase()}</span></dd>
      <dt>Duration</dt><dd>${dur}</dd>
      <dt>Executed</dt><dd>${esc(rec.startedAt)}</dd>
      <dt>Environment</dt><dd>Firebase Emulator Suite (Auth + Firestore) loading the production <code>firestore.rules</code></dd>
    </dl></div>
    <h2>What this verifies</h2>
    <p>${esc(rec.purpose)}</p>
    <h2>Reproduce manually</h2>
    <ol class="repro">${rec.reproduce.map(r => `<li>${esc(r)}</li>`).join('')}</ol>
    ${rec.error ? `<h2>Failure</h2><pre>${esc(rec.error)}</pre>` : ''}
    <h2>Steps (${rec.steps.length})</h2>
    ${steps}
  </body></html>`;
}

function renderIndex(recs: TestRecord[]): string {
  const passed = recs.filter(r => r.status === 'passed').length;
  const rows = recs.map(r => `<tr>
      <td><strong>${esc(r.title)}</strong><br><code>${esc(r.slug)}.pdf</code></td>
      <td>${esc(r.area)}</td>
      <td>${r.steps.length}</td>
      <td><span class="badge ${r.status === 'passed' ? 'pass' : 'fail'}">${(r.status ?? '?').toUpperCase()}</span></td>
    </tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <h1>End-to-end test report</h1>
    <p class="sub">Tresor Couture · ${recs.length} tests · ${passed}/${recs.length} passed</p>
    <div class="meta"><dl>
      <dt>Environment</dt><dd>Firebase Emulator Suite (Auth + Firestore) loading the production <code>firestore.rules</code>, with the app built in emulator mode and served locally.</dd>
      <dt>Scope</dt><dd>Every admin console section, the customer journey, and the real-time customer&nbsp;↔&nbsp;admin interactions between them.</dd>
      <dt>Generated</dt><dd>${new Date().toISOString()}</dd>
    </dl></div>
    <h2>How to re-run everything</h2>
    <ol class="repro">
      <li><code>npm run emulators</code></li>
      <li><code>npm run seed:emulator:full</code> (with the emulator host env vars — see README)</li>
      <li>Build with <code>VITE_USE_EMULATORS=1</code>, then <code>npm run preview -- --port 4173</code></li>
      <li><code>npm run test:emulator</code></li>
      <li><code>npm run report:pdf</code> to regenerate these PDFs</li>
    </ol>
    <h2>Tests</h2>
    <table><thead><tr><th>Test</th><th>Area</th><th>Steps</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`;
}

async function main(): Promise<void> {
  if (!fs.existsSync(ARTIFACTS)) {
    console.error(`No artifacts at ${ARTIFACTS} — run the emulator suite first.`);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const dirs = fs.readdirSync(ARTIFACTS)
    .map(d => path.join(ARTIFACTS, d))
    .filter(d => fs.existsSync(path.join(d, 'steps.json')));

  if (!dirs.length) {
    console.error('No steps.json manifests found — did the suite run with the Recorder?');
    process.exit(1);
  }

  const browser = await chromium.launch({ executablePath: process.env.PW_EXECUTABLE_PATH || undefined });
  const page = await browser.newPage();
  const recs: TestRecord[] = [];

  for (const dir of dirs) {
    const rec = JSON.parse(fs.readFileSync(path.join(dir, 'steps.json'), 'utf8')) as TestRecord;
    recs.push(rec);
    await page.setContent(renderTest(rec, dir), { waitUntil: 'load' });
    const out = path.join(OUT, `${rec.slug}.pdf`);
    await page.pdf({ path: out, format: 'A4', printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
    const kb = (fs.statSync(out).size / 1024).toFixed(0);
    console.log(`  ✓ ${path.basename(out)} (${rec.steps.length} steps, ${kb} KB)`);
  }

  recs.sort((a, b) => a.slug.localeCompare(b.slug));
  await page.setContent(renderIndex(recs), { waitUntil: 'load' });
  await page.pdf({ path: path.join(OUT, '00-INDEX.pdf'), format: 'A4', printBackground: true,
    margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
  console.log(`  ✓ 00-INDEX.pdf (${recs.length} tests)`);

  await browser.close();
  const failed = recs.filter(r => r.status !== 'passed');
  console.log(`\n${recs.length - failed.length}/${recs.length} passed → ${OUT}`);
}

main().catch(err => { console.error(err); process.exit(1); });
