import { test, expect } from '@playwright/test';
import { Recorder } from './lib/recorder';
import { auditCatalogue } from '../../src/lib/seoAudit';
import type { Fabric } from '../../src/types';

/**
 * The catalogue SEO audit is pure logic over our own product data, so it needs
 * neither a browser nor the emulator — and, by design, it calls no external
 * service. That is the whole point: backlink and rank data cannot be
 * self-hosted (Ahrefs alone crawls billions of pages a day), but everything
 * that makes OUR products rank or fail to rank is in OUR database already.
 *
 * These assertions pin the rules that fire on real production data today:
 * 43 products share a description, 34 carry a computed strike-through MRP,
 * 31 are named after a stock code, and one leaks an importer note.
 */

const base: Fabric = {
  id: 'x', brand: 'TRESOR', name: 'Zardozi Floral Lehenga · Sage',
  description: 'A bridal lehenga worked in raised zardozi bouquets across the panels, with a deep mihrab border in sequin and dori.',
  price: 35999, mrp: 35999, photo: '/products/lehenga/a.jpg', image: '',
  category: 'Lehenga Cholis', masterCategory: 'Lehenga Cholis',
  tags: ['Bridal'], stock: 5,
};
const make = (over: Partial<Fabric>): Fabric => ({ ...base, ...over });

const ruleFor = (products: Fabric[], rule: string) =>
  auditCatalogue(products).issues.find(i => i.rule === rule);

test('Catalogue SEO · audit rules fire on the right products', async () => {
  const rec = new Recorder({
    slug: 'seo-catalogue-audit',
    title: 'Catalogue SEO · audit engine',
    area: 'Admin console · Catalogue SEO',
    purpose:
      'The audit reads only our own product data and flags what stops a product ranking or a shopper trusting it: duplicate descriptions, SKU-code names, leaked importer notes, computed strike-through MRPs, base64 images, thin copy and missing imagery. No external SEO service is contacted.',
    reproduce: [
      'Sign in as an admin and open #/admin/seo.',
      'The summary reports how many products carry a critical issue.',
      'Each card names the rule, the consequence, the fix, and the products it fires on.',
      'Filter by Critical / Warning / Notice using the chips.',
    ],
  });

  try {
    // --- Duplicate descriptions ---------------------------------------------
    // Prices differ; the copy does not. Normalising numbers means the rule sees
    // through "…at ₹1299" vs "…at ₹7000" — which is exactly the legacy import.
    const dupes = [
      make({ id: 'a', description: 'Elegant lace from TRESOR. Sold as a bundle of 9 meters at ₹1299.' }),
      make({ id: 'b', description: 'Elegant lace from TRESOR. Sold as a bundle of 9 meters at ₹7000.' }),
      make({ id: 'c', description: 'A wholly different paragraph about a wholly different piece of cloth, long enough to pass.' }),
    ];
    const dup = ruleFor(dupes, 'duplicate-description');
    expect(dup?.productIds.sort()).toEqual(['a', 'b']);
    expect(dup?.severity).toBe('critical');
    rec.note('Duplicate descriptions detected across differing prices',
      'Numbers are normalised, so a templated paragraph is caught even when the price differs.');

    // --- SKU-code names ------------------------------------------------------
    const skus = [
      make({ id: 'k1', name: 'HA3858' }), make({ id: 'k2', name: 'MO2029' }),
      make({ id: 'k3', name: 'NE1386-S31' }), make({ id: 'k4', name: '6988' }),
      make({ id: 'ok', name: 'Threadwork Lehenga · Navy' }),
    ];
    expect(ruleFor(skus, 'sku-as-name')?.productIds.sort()).toEqual(['k1', 'k2', 'k3', 'k4']);
    rec.note('Stock codes rejected as product names',
      'HA3858, MO2029, NE1386-S31 and 6988 flagged; a real name passes.');

    // --- Leaked importer note ------------------------------------------------
    const leaked = [
      make({ id: 'n1', description: 'Elegant patch from TRESOR. Note: Code not found in slide text; using generated code' }),
      make({ id: 'n2' }),
    ];
    expect(ruleFor(leaked, 'leaked-import-note')?.productIds).toEqual(['n1']);
    rec.note('Importer note flagged as customer-visible',
      'Tooling output on a live product page is treated as critical.');

    // --- Fabricated MRP ------------------------------------------------------
    // 1299 / 0.7 = 1855.71… — a computed 30% "discount" that never existed.
    const mrps = [
      make({ id: 'm1', price: 1299, mrp: 1855.71 }),
      make({ id: 'm2', price: 2000, mrp: 2857.14 }),
      make({ id: 'honest', price: 35999, mrp: 35999 }),
      make({ id: 'real', price: 4500, mrp: 7999 }),
    ];
    const mrp = ruleFor(mrps, 'fabricated-mrp');
    expect(mrp?.productIds.sort()).toEqual(['m1', 'm2']);
    rec.note('Computed strike-through MRPs flagged, genuine ones left alone',
      'price ÷ 0.7 is detected; an equal MRP and a real higher list price both pass.');

    // --- base64 images -------------------------------------------------------
    const imgs = [
      make({ id: 'b64', photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRg' }),
      make({ id: 'url', photo: '/products/lehenga/a.jpg' }),
      make({ id: 'none', photo: '', image: '' }),
    ];
    expect(ruleFor(imgs, 'inline-base64-image')?.productIds).toEqual(['b64']);
    expect(ruleFor(imgs, 'missing-image')?.productIds).toEqual(['none']);
    rec.note('Base64 images and missing images separated',
      'A data URI has no URL, so it cannot be cached, CDN-served or indexed by Google Images.');

    // --- A clean catalogue reports clean --------------------------------------
    const clean = [
      make({ id: 'c1', name: 'Threadwork Lehenga · Navy', description: 'Tone-on-tone thread embroidery worked densely across the full flare, so the pattern reads as texture rather than contrast at a distance.' }),
      make({ id: 'c2', name: 'Pearl Strand Lehenga · Gold', description: 'Vertical strands of pearl and bead fall the length of the skirt, opening into a hand-worked floral field at the scalloped hem.' }),
    ];
    const good = auditCatalogue(clean);
    expect(good.issues.filter(i => i.severity === 'critical')).toHaveLength(0);
    expect(good.score).toBe(100);
    rec.note('A clean catalogue scores 100 with no critical issues',
      'The score is the share of products with nothing critical — a count, not an invented index.');

    // --- Empty catalogue must not divide by zero -------------------------------
    expect(auditCatalogue([]).score).toBe(100);
    expect(auditCatalogue([]).issues).toHaveLength(0);
    rec.note('Empty catalogue handled', 'No division by zero on a fresh install.');

    rec.finish('passed');
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});
