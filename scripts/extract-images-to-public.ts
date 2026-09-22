/**
 * Phase 1 of docs/ops/load-performance.md — take the photographs OUT of the
 * Firestore documents and put them on the CDN as ordinary files.
 *
 * WHY. A first-time visitor downloads 9.63 MB before the shop grid paints,
 * 99.4% of it base64 photographs living inside the product documents. While
 * the bytes are inside the JSON, no image technique helps: a data URI is not
 * fetched, so `loading="lazy"`, `srcset`, preloading and CDN caching are all
 * inert. Moving them to files is not an optimisation, it is what makes every
 * other optimisation possible.
 *
 * WHERE. `public/products/`, served at `/products/...`. This is the existing
 * pattern — `src/lib/photo.ts` already maps catalogue photography that way,
 * and `vercel.json` already caches `/products/(.*)` for 30 days. No new
 * service, no bucket, no credentials: the project has no Firebase Storage
 * bucket, which is why the images ended up in Firestore to begin with.
 *
 * WHAT IT DOES NOT TOUCH. The SVG swatch placeholders (90 of the 103
 * products) stay inline. They are ~1 KB each; a network round trip would cost
 * more than they weigh.
 *
 * TWO STEPS, DELIBERATELY SEPARATE. This script only writes files and a
 * manifest. Firestore is not modified, because the documents must not point
 * at files that are not deployed yet. Run this, commit the files, deploy, and
 * only then run scripts/apply-image-urls.ts.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json npx tsx scripts/extract-images-to-public.ts
 */
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import * as path from 'node:path';

/** Below this, a file costs more in latency than the bytes save. */
const INLINE_BELOW_BYTES = 20_000;

/**
 * Both collections that carry inline images, and where each one's files live.
 *
 * `config` holds the six `homeart-*` category images the home page reads — and
 * `loadHomeArt()` reads the WHOLE collection to find them, so those six are
 * downloaded before the home page can show its category art. At 0.81 MB they
 * are now larger than the entire product catalogue.
 */
const COLLECTIONS = [
  { name: 'products', dir: 'public/products', prefix: '/products' },
  { name: 'config', dir: 'public/art', prefix: '/art' },
] as const;

const MANIFEST = path.resolve(process.cwd(), 'scripts/image-url-manifest.json');

const EXT: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
};

function bootstrap(): void {
  if (getApps().length) return;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath) {
    const sa = JSON.parse(readFileSync(keyPath, 'utf8')) as Record<string, unknown>;
    initializeApp({ credential: cert(sa as never), projectId: sa.project_id as string });
    return;
  }
  initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || 'tresor-couture' });
}

interface Extracted {
  photo?: string;
  photoGallery?: string[];
}

/** Write one data URI to a file; return its public path, or null to keep inline. */
function extract(
  dataUri: string,
  stem: string,
  outDir: string,
  prefix: string,
  written: Map<string, number>,
): string | null {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(dataUri);
  if (!m) return null;
  const [, mime, b64] = m;
  const bytes = Buffer.from(b64!, 'base64');
  if (bytes.length < INLINE_BELOW_BYTES) return null;

  const ext = EXT[mime!] ?? 'bin';
  const file = `${stem}.${ext}`;
  writeFileSync(path.join(outDir, file), bytes);
  written.set(`${prefix}/${file}`, bytes.length);
  return `${prefix}/${file}`;
}

async function main(): Promise<void> {
  bootstrap();
  const db = getFirestore();

  const written = new Map<string, number>();
  // Keyed by "<collection>/<id>" so one manifest covers both collections and
  // apply-image-urls.ts knows which document each entry belongs to.
  const manifest: Record<string, Extracted> = {};
  let inlineKept = 0;
  let beforeBytes = 0;
  let afterBytes = 0;

  for (const col of COLLECTIONS) {
    const outDir = path.resolve(process.cwd(), col.dir);
    mkdirSync(outDir, { recursive: true });
    const snap = await db.collection(col.name).get();

    for (const doc of snap.docs) {
      const p = doc.data() as Record<string, unknown>;
      // Barcode is stable and human-readable at the CDN; the id is the
      // fallback for anything that predates barcoding, and for config docs
      // (`homeart-laces`) where the id already reads well.
      const stem = String(p.barcode ?? doc.id).replace(/[^A-Za-z0-9_-]/g, '');
      const out: Extracted = {};

      const photo = typeof p.photo === 'string' ? p.photo : '';
      if (photo.startsWith('data:')) {
        beforeBytes += photo.length;
        // A config doc's single image is not "the main of several", so it
        // takes the bare stem rather than a -main suffix.
        const name = col.name === 'products' ? `${stem}-main` : stem;
        const url = extract(photo, name, outDir, col.prefix, written);
        if (url) {
          out.photo = url;
          afterBytes += url.length;
        } else {
          inlineKept++;
          afterBytes += photo.length;
        }
      }

      const gallery = Array.isArray(p.photoGallery) ? (p.photoGallery as unknown[]) : [];
      if (gallery.length) {
        const next: string[] = [];
        let changed = false;
        gallery.forEach((g, i) => {
          const s = typeof g === 'string' ? g : '';
          if (!s.startsWith('data:')) {
            next.push(s);
            return;
          }
          beforeBytes += s.length;
          const url = extract(s, `${stem}-g${i + 1}`, outDir, col.prefix, written);
          if (url) {
            next.push(url);
            afterBytes += url.length;
            changed = true;
          } else {
            next.push(s);
            afterBytes += s.length;
            inlineKept++;
          }
        });
        if (changed) out.photoGallery = next;
      }

      if (out.photo || out.photoGallery) manifest[`${col.name}/${doc.id}`] = out;
    }
  }

  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));

  const mb = (n: number) => (n / 1024 / 1024).toFixed(2) + ' MB';
  let fileBytes = 0;
  for (const b of written.values()) fileBytes += b;

  console.log(`${written.size} images written (${mb(fileBytes)} of files)`);
  console.log(`  ${inlineKept} kept inline (under ${INLINE_BELOW_BYTES / 1000} KB — swatches)`);
  console.log(`  ${Object.keys(manifest).length} documents to change\n`);
  console.log(`  image bytes inside documents: ${mb(beforeBytes)} -> ${mb(afterBytes)}`);
  console.log(`\nmanifest: ${path.relative(process.cwd(), MANIFEST)}`);
  console.log('Firestore NOT modified. Commit + deploy the files, then run apply-image-urls.ts.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
