/**
 * Move photographs that are embedded in product documents out to static files.
 *
 * A product's photo stored as a data URI rides along in the Firestore document,
 * so the whole catalogue download carries every one of them: on the live shop
 * 14 products held 93% of the catalogue's bytes. Static files in /public/products
 * are cached by the browser/CDN and only fetched for cards actually on screen.
 *
 *   npx tsx scripts/externalise-embedded-photos.ts --prod             # writes image files only, DB untouched
 *   npx tsx scripts/externalise-embedded-photos.ts --prod --apply-db  # ALSO points the documents at the files
 *
 * ORDER MATTERS: run without --apply-db, commit the new files, DEPLOY, confirm
 * the files load at /products/<name>, and only then run with --apply-db —
 * switching the documents first would point shoppers at files that are not live yet.
 */
import fs from 'fs';
import path from 'path';
import { initAdmin } from './lib/admin';
import { FieldValue } from 'firebase-admin/firestore';

const EXT: Record<string, string> = { jpeg: 'jpg', jpg: 'jpg', png: 'png', webp: 'webp', gif: 'gif' };
const decode = (s: string) => {
  const m = /^data:image\/(\w+);base64,(.*)$/s.exec(s);
  return m && EXT[m[1]] ? { ext: EXT[m[1]], bytes: Buffer.from(m[2], 'base64') } : null;
};

async function main() {
  const applyDb = process.argv.includes('--apply-db');
  const { db, prod } = initAdmin();
  const dir = path.resolve(process.cwd(), 'public/products');
  fs.mkdirSync(dir, { recursive: true });
  const snap = await db.collection('products').get();
  let files = 0, bytes = 0, docs = 0;
  for (const d of snap.docs) {
    const f = d.data();
    // Retired pieces are off the shop; leave them as they are.
    if (f.listingStatus === 'Retired') continue;
    const stem = `${String(f.productCode ?? '').trim() || d.id}`.replace(/[^A-Za-z0-9_-]/g, '-');
    const patch: Record<string, unknown> = {};
    const put = (data: string, suffix: string): string | null => {
      const img = decode(data);
      if (!img) return null;
      const name = `${stem}-${suffix}.${img.ext}`;
      fs.writeFileSync(path.join(dir, name), img.bytes);
      files += 1; bytes += img.bytes.length;
      return `/products/${name}`;
    };
    const main = typeof f.photo === 'string' ? put(f.photo, 'main') : null;
    if (main) patch.photo = main;
    if (Array.isArray(f.photoGallery)) {
      const next = f.photoGallery.map((g: string, i: number) => (typeof g === 'string' ? put(g, `g${i + 1}`) ?? g : g));
      if (next.some((v: string, i: number) => v !== f.photoGallery[i])) patch.photoGallery = next;
    }
    if (!Object.keys(patch).length) continue;
    docs += 1;
    console.log(`• ${d.id}  ${String(f.name).slice(0, 30)}  →`, JSON.stringify(patch).slice(0, 140));
    if (applyDb) await d.ref.update({ ...patch, updatedAt: FieldValue.serverTimestamp() });
  }
  console.log(`\n${prod ? 'LIVE' : 'emulator'}: ${docs} products, ${files} files, ${(bytes / 1048576).toFixed(2)} MB written to public/products.`);
  console.log(applyDb ? 'Documents UPDATED.' : 'Documents NOT changed (re-run with --apply-db after deploying the files).');
}
main().catch(e => { console.error(e); process.exit(1); });
