import type { Fabric } from '../types';
import { inStock } from './availability';

/**
 * Catalogue SEO audit — runs entirely over our own product data.
 *
 * Deliberately NOT a Semrush/Ahrefs clone. Those sell a crawled index of the
 * whole web (Ahrefs alone crawls ~8bn pages/day); that asset cannot be
 * self-hosted, and every open-source "alternative" is really a paid client for
 * DataForSEO or a SERP scraper. What CAN be done for free, and what actually
 * moves the needle on a 50-product catalogue, is auditing our own data — which
 * is what this does. No API key, no vendor, no request budget.
 *
 * Each rule states the customer-visible or ranking consequence, so the fix is
 * self-justifying rather than a number to chase.
 */

export type Severity = 'critical' | 'warning' | 'notice';

export interface SeoIssue {
  /** Stable rule id, for filtering and for tests. */
  rule: string;
  severity: Severity;
  /** One-line statement of what is wrong. */
  title: string;
  /** Why it matters — the consequence, not the rule restated. */
  why: string;
  /** Products this fires on. */
  productIds: string[];
  /** Suggested next action. */
  fix: string;
}

export interface SeoAuditResult {
  issues: SeoIssue[];
  scanned: number;
  /** Products with at least one critical issue. */
  criticalProducts: number;
  score: number;
}

/** A name that is just a SKU/stock code rather than something a person searches for. */
const SKU_NAME_RE = /^[A-Z]{0,3}[-\s]?\d{2,}([-\s][A-Z0-9]+)*$/i;

/** Leaked importer/tooling notes that were never meant to face a customer. */
const LEAKED_NOTE_RE = /\b(note:|not found in|using generated|lorem ipsum|todo|placeholder|tbd)\b/i;

const MIN_DESCRIPTION_CHARS = 120;
const MIN_NAME_CHARS = 12;

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Normalised description, for duplicate detection. */
const descKey = (f: Fabric): string =>
  text(f.description).toLowerCase().replace(/\s+/g, ' ').replace(/[₹\d.,]+/g, '#');

const issue = (
  rule: string,
  severity: Severity,
  title: string,
  why: string,
  fix: string,
  productIds: string[],
): SeoIssue | null => (productIds.length ? { rule, severity, title, why, fix, productIds } : null);

export function auditCatalogue(products: Fabric[]): SeoAuditResult {
  const list = products ?? [];
  const found: (SeoIssue | null)[] = [];

  // --- Duplicate descriptions -------------------------------------------------
  // The single biggest on-page problem in this catalogue. Search engines
  // collapse near-identical pages, so 30 products sharing one paragraph compete
  // with each other and typically only one is kept.
  const byDesc = new Map<string, string[]>();
  for (const p of list) {
    const k = descKey(p);
    if (!k) continue;
    byDesc.set(k, [...(byDesc.get(k) ?? []), p.id]);
  }
  const duplicated = [...byDesc.values()].filter(ids => ids.length > 1).flat();
  found.push(issue(
    'duplicate-description', 'critical',
    'Several products share the same description',
    'Near-identical pages get collapsed in search results, so these products compete with each other and usually only one survives. It also reads as boilerplate to a shopper comparing two colourways.',
    'Write one or two distinct sentences per product — the colour, the occasion, what the work is.',
    duplicated,
  ));

  // --- SKU-code names ---------------------------------------------------------
  const skuNamed = list
    .filter(p => {
      const n = text(p.name);
      return !n || SKU_NAME_RE.test(n);
    })
    .map(p => p.id);
  found.push(issue(
    'sku-as-name', 'critical',
    'Product name is a stock code, not a product name',
    'Nobody searches for "HA3858". The name is the single strongest on-page ranking signal and the first thing a customer reads — a bare code makes the listing look broken and unbuyable.',
    'Rename to what it is, e.g. "Chantilly Lace Trim · Ivory · 9m bundle".',
    skuNamed,
  ));

  // --- Leaked tooling notes ---------------------------------------------------
  const leaked = list
    .filter(p => LEAKED_NOTE_RE.test(text(p.description)) || LEAKED_NOTE_RE.test(text(p.name)))
    .map(p => p.id);
  found.push(issue(
    'leaked-import-note', 'critical',
    'Import or placeholder note is visible to customers',
    'Text like "Code not found in slide text; using generated code" is internal tooling output. It is on the live page, it gets indexed, and it tells a shopper the catalogue is unmaintained.',
    'Delete the note and write real copy.',
    leaked,
  ));

  // --- Fabricated MRP ---------------------------------------------------------
  // Not strictly SEO, but it is a legal exposure and it is in this data.
  const fakeMrp = list
    .filter(p => {
      const mrp = typeof p.mrp === 'number' ? p.mrp : 0;
      const price = typeof p.price === 'number' ? p.price : 0;
      if (mrp <= price) return false;
      // A machine-generated MRP: price divided by a round margin, to the paisa.
      return Math.abs(mrp - price / 0.7) < 1 || !Number.isInteger(mrp);
    })
    .map(p => p.id);
  found.push(issue(
    'fabricated-mrp', 'critical',
    'Strike-through MRP looks computed, not real',
    'These MRPs are the selling price divided by a fixed margin (price ÷ 0.7), which produces a "30% OFF" badge for a discount that never existed. Misleading-MRP is actionable under Indian consumer law, and Google Merchant Center suspends feeds for it.',
    'Set mrp equal to price unless there is a genuine higher list price you can evidence.',
    fakeMrp,
  ));

  // --- Thin descriptions ------------------------------------------------------
  const thin = list
    .filter(p => {
      const d = text(p.description);
      return d.length > 0 && d.length < MIN_DESCRIPTION_CHARS;
    })
    .map(p => p.id);
  found.push(issue(
    'thin-description', 'warning',
    `Description is shorter than ${MIN_DESCRIPTION_CHARS} characters`,
    'There is too little text for a search engine to understand what the page is about, and too little for a shopper to justify a five-figure purchase.',
    'Describe the work, the fabric, the drape and the occasion.',
    thin,
  ));

  const noDesc = list.filter(p => !text(p.description)).map(p => p.id);
  found.push(issue(
    'missing-description', 'critical',
    'Product has no description at all',
    'An empty page body gives search engines nothing to rank and gives the customer nothing to buy on.',
    'Add a description.',
    noDesc,
  ));

  // --- Short names ------------------------------------------------------------
  const shortName = list
    .filter(p => {
      const n = text(p.name);
      return n.length > 0 && n.length < MIN_NAME_CHARS && !SKU_NAME_RE.test(n);
    })
    .map(p => p.id);
  found.push(issue(
    'short-name', 'warning',
    'Product name is very short',
    'Short names miss the descriptive terms people actually type — fabric, colour, occasion.',
    'Expand to include the material and colourway.',
    shortName,
  ));

  // --- Imagery ----------------------------------------------------------------
  const noImage = list
    .filter(p => !text(p.photo) && !text(p.image))
    .map(p => p.id);
  found.push(issue(
    'missing-image', 'critical',
    'Product has no image',
    'An imageless card is effectively unsellable, and the product is ineligible for image search and for Google Shopping.',
    'Upload a photograph.',
    noImage,
  ));

  const base64Image = list
    .filter(p => text(p.photo).startsWith('data:image'))
    .map(p => p.id);
  found.push(issue(
    'inline-base64-image', 'warning',
    'Image is embedded as a base64 data URI',
    'A base64 image is re-downloaded with the document every time, cannot be cached, CDN-served or resized, and is invisible to Google Images because it has no URL. It also inflates the Firestore document and slows the shop grid.',
    'Upload the file to /public/products/ (or storage) and reference it by path.',
    base64Image,
  ));

  // --- Merchandising signals --------------------------------------------------
  const noCategory = list
    .filter(p => !text(p.masterCategory) && !text(p.category))
    .map(p => p.id);
  found.push(issue(
    'missing-category', 'warning',
    'Product is not in any category',
    'It cannot be reached by browsing or filtering, so it depends entirely on search to be found.',
    'Assign a master category.',
    noCategory,
  ));

  const noTags = list.filter(p => !(p.tags ?? []).length).map(p => p.id);
  found.push(issue(
    'missing-tags', 'notice',
    'Product has no tags',
    'Tags feed on-site search and related-product rails, so an untagged product surfaces less often.',
    'Add a few descriptive tags.',
    noTags,
  ));

  const soldOut = list.filter(p => !inStock(p)).map(p => p.id);
  found.push(issue(
    'out-of-stock', 'notice',
    'Product is out of stock',
    'Sold-out pages that stay live for a long time lose ranking and waste crawl budget. Short term this is fine — the storefront badges them and sorts them last.',
    'Restock, or retire the product if it is not coming back.',
    soldOut,
  ));

  const issues = found.filter((i): i is SeoIssue => i !== null)
    .sort((a, b) => {
      const rank = { critical: 0, warning: 1, notice: 2 } as const;
      return rank[a.severity] - rank[b.severity] || b.productIds.length - a.productIds.length;
    });

  const criticalIds = new Set(issues.filter(i => i.severity === 'critical').flatMap(i => i.productIds));
  const scanned = list.length;
  // Share of the catalogue with nothing critical wrong with it. A blunt number
  // on purpose: it is a count of clean products, not a made-up index.
  const score = scanned === 0 ? 100 : Math.round(((scanned - criticalIds.size) / scanned) * 100);

  return { issues, scanned, criticalProducts: criticalIds.size, score };
}
