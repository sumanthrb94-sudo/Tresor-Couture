// Tight, high-DPI capture of the navbar top-right across desktop widths,
// to inspect crowding/overlap near the sign-in / profile / wishlist / bag cluster.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const BASE = process.env.SITE ?? 'https://tresorcouture.in';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'navbar');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const WIDTHS = [1180, 1280, 1366, 1440, 1536, 1680];

(async () => {
  for (const w of WIDTHS) {
    const browser = await chromium.launch({ headless: true, args: ['--single-process', '--no-zygote', '--disable-gpu', '--disable-dev-shm-usage'] });
    const ctx = await browser.newContext({ viewport: { width: w, height: 700 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.locator('header').first().waitFor({ timeout: 20000 });
      await page.waitForTimeout(1500);
      // full header strip
      await page.locator('header').first().screenshot({ path: path.join(OUT, `w${w}-header.png`) });
      // tight crop of the right ~520px of the top bar
      await page.screenshot({ path: path.join(OUT, `w${w}-topright.png`), clip: { x: Math.max(0, w - 540), y: 0, width: Math.min(540, w), height: 80 } });
      console.log(`✓ ${w}`);
    } catch (e) { console.log(`✗ ${w} — ${e.message.split('\n')[0]}`); }
    await ctx.close(); await browser.close();
  }
  console.log('saved', OUT);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
