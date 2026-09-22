/**
 * Phase 1, second half — point the product documents at the extracted files.
 *
 * Run this ONLY after the files written by extract-images-to-public.ts are
 * committed AND deployed. The documents must never reference a path the CDN
 * cannot serve yet: between those two moments every photographed product on
 * the live site would render its fallback swatch.
 *
 * Reversible by design. Before writing anything it saves the current `photo`
 * and `photoGallery` of every document it touches to a backup file, and
 * `--rollback` puts them back. The images are data URIs today, so the backup
 * is the only copy of them once the documents change.
 *
 *   # after deploying the files
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/sa.json npx tsx scripts/apply-image-urls.ts --yes
 *
 *   # if anything looks wrong
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/sa.json npx tsx scripts/apply-image-urls.ts --rollback
 */
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

const MANIFEST = path.resolve(process.cwd(), 'scripts/image-url-manifest.json');
const BACKUP = path.resolve(process.cwd(), 'scripts/.image-url-backup.json');
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

interface Entry {
  photo?: string;
  photoGallery?: string[];
}

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

/** Every URL in the manifest must exist on disk, or the commit is incomplete. */
function checkFilesPresent(manifest: Record<string, Entry>): string[] {
  const missing: string[] = [];
  for (const entry of Object.values(manifest)) {
    const urls = [entry.photo, ...(entry.photoGallery ?? [])].filter(
      (u): u is string => typeof u === 'string' && u.startsWith('/'),
    );
    for (const u of urls) {
      if (!existsSync(path.join(PUBLIC_DIR, u))) missing.push(u);
    }
  }
  return missing;
}

async function rollback(): Promise<void> {
  bootstrap();
  const db = getFirestore();
  if (!existsSync(BACKUP)) throw new Error(`no backup at ${BACKUP} — nothing to roll back to`);
  const backup = JSON.parse(readFileSync(BACKUP, 'utf8')) as Record<string, Entry>;
  let n = 0;
  for (const [key, prev] of Object.entries(backup)) {
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (prev.photo !== undefined) patch.photo = prev.photo;
    if (prev.photoGallery !== undefined) patch.photoGallery = prev.photoGallery;
    // A manifest key is already a document path ("products/x", "config/y").
    // Older backups hold a bare product id, so those still need the prefix.
    await db.doc(key.includes('/') ? key : `products/${key}`).update(patch);
    n++;
  }
  console.log(`rolled back ${n} documents to their pre-migration images`);
}

async function apply(): Promise<void> {
  bootstrap();
  const db = getFirestore();

  if (!existsSync(MANIFEST)) throw new Error(`no manifest at ${MANIFEST} — run extract-images-to-public.ts first`);
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, Entry>;

  const missing = checkFilesPresent(manifest);
  if (missing.length) {
    console.error(`${missing.length} file(s) named in the manifest are not in public/:`);
    for (const m of missing.slice(0, 10)) console.error(`  ${m}`);
    throw new Error('refusing to point documents at files that are not in the build');
  }

  const backup: Record<string, Entry> = {};
  let changed = 0;
  let saved = 0;

  for (const [key, entry] of Object.entries(manifest)) {
    const ref = db.doc(key.includes('/') ? key : `products/${key}`);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`  ${key} no longer exists — skipped`);
      continue;
    }
    const cur = snap.data() as Record<string, unknown>;

    // Idempotent: a document already on URLs is left alone, so a re-run after
    // a partial failure finishes the job instead of overwriting the backup
    // with URLs and losing the only copy of the images.
    const already = typeof cur.photo === 'string' && cur.photo.startsWith('/');
    if (already) {
      console.log(`  ${String(cur.barcode ?? key)} already migrated — skipped`);
      continue;
    }

    backup[key] = {
      ...(typeof cur.photo === 'string' ? { photo: cur.photo } : {}),
      ...(Array.isArray(cur.photoGallery) ? { photoGallery: cur.photoGallery as string[] } : {}),
    };

    const before = JSON.stringify(cur).length;
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (entry.photo) patch.photo = entry.photo;
    if (entry.photoGallery) patch.photoGallery = entry.photoGallery;

    // Write the backup BEFORE the update, every iteration: if the process dies
    // mid-run, the documents already changed are still recoverable.
    writeFileSync(BACKUP, JSON.stringify(backup, null, 1));
    await ref.update(patch);

    const after = JSON.stringify({ ...cur, ...patch }).length;
    saved += before - after;
    changed++;
    console.log(
      `  ${String(cur.barcode ?? key).padEnd(26)} ${(before / 1024).toFixed(0).padStart(4)} KB -> ${(after / 1024).toFixed(0).padStart(3)} KB  ${String(cur.name ?? cur.category ?? '').slice(0, 24)}`,
    );
  }

  console.log(`\n${changed} documents migrated, ${(saved / 1024 / 1024).toFixed(2)} MB removed from Firestore`);
  console.log(`backup: ${path.relative(process.cwd(), BACKUP)}  (rollback with --rollback)`);
}

const args = process.argv.slice(2);
const run = args.includes('--rollback')
  ? rollback()
  : args.includes('--yes')
    ? apply()
    : Promise.reject(
        new Error('pass --yes to migrate (files must be DEPLOYED first), or --rollback to undo'),
      );

run.catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
