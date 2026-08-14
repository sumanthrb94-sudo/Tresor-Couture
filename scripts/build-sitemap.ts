/**
 * Generate public/sitemap.xml from the live catalogue.
 *
 * Every URL here is a real path (history routing) — the previous sitemap
 * listed fragment URLs (#/shop), which all collapse to the homepage as far as
 * a crawler is concerned, so no product or category page could be indexed.
 *
 * Run with production credentials to include every product page:
 *   GOOGLE_APPLICATION_CREDENTIALS=… npx tsx scripts/build-sitemap.ts
 *
 * Products out of stock are still listed (their pages render and are honest
 * about availability); products are the long tail that actually ranks.
 */
import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

const ORIGIN = 'https://tresorcouture.in';

const STATIC: { path: string; changefreq: string; priority: string }[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/shop', changefreq: 'weekly', priority: '0.9' },
  { path: '/shop?category=Lehenga%20Cholis', changefreq: 'weekly', priority: '0.8' },
  { path: '/shop?category=Sarees', changefreq: 'weekly', priority: '0.8' },
  { path: '/shop?category=Laces', changefreq: 'weekly', priority: '0.7' },
  { path: '/shop?category=Fabrics', changefreq: 'weekly', priority: '0.7' },
  { path: '/shop?category=Dyeable%20Fabrics', changefreq: 'weekly', priority: '0.6' },
  { path: '/contact', changefreq: 'monthly', priority: '0.5' },
  { path: '/shipping', changefreq: 'monthly', priority: '0.3' },
  { path: '/refund', changefreq: 'monthly', priority: '0.3' },
  { path: '/terms', changefreq: 'yearly', priority: '0.2' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.2' },
];

async function main(): Promise<void> {
  if (!getApps().length) {
    initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || 'tresor-couture' });
  }
  const db = getFirestore();
  const snap = await db.collection('products').get();
  const ids = snap.docs.map(d => d.id).sort();

  const urls = [
    ...STATIC.map(u =>
      `  <url><loc>${ORIGIN}${u.path}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`),
    ...ids.map(id =>
      `  <url><loc>${ORIGIN}/product/${encodeURIComponent(id)}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  fs.writeFileSync('public/sitemap.xml', xml);
  console.log(`sitemap.xml: ${STATIC.length} static + ${ids.length} product URLs`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
