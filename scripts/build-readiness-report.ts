/**
 * Build the CEO production-readiness report PDF.
 *
 * Renders docs/readiness/ceo-report.html (written by hand, data filled from
 * the latest emulator-suite run) to an A4 PDF with the same Chromium pipeline
 * as build-test-report.ts.
 *
 *   PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium npx tsx scripts/build-readiness-report.ts
 */
import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SRC = path.resolve('docs/readiness/ceo-report.html');
const OUT = path.resolve('docs/readiness/CEO-PRODUCTION-READINESS.pdf');

async function main(): Promise<void> {
  if (!fs.existsSync(SRC)) throw new Error(`missing ${SRC}`);
  const browser = await chromium.launch({ executablePath: process.env.PW_EXECUTABLE_PATH || undefined });
  const page = await browser.newPage();
  await page.goto(`file://${SRC}`, { waitUntil: 'networkidle' });
  await page.pdf({
    path: OUT, format: 'A4', printBackground: true,
    margin: { top: '14mm', bottom: '16mm', left: '13mm', right: '13mm' },
  });
  await browser.close();
  console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
