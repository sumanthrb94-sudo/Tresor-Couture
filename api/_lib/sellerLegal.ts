/**
 * Seller legal identifiers for server-rendered documents (order emails).
 *
 * Deliberately a small copy of the client-side rule in `src/lib/business.ts`
 * rather than an import: `api/` compiles as standalone ESM for the Vercel
 * runtime and does not share the browser bundle's module graph or path
 * aliases. The duplication is the regex and the placeholder list only — keep
 * the two in step if either changes.
 *
 * The gate matters more than the value. A registration number that does not
 * belong to us is a misrepresentation on a document a customer keeps; showing
 * nothing is merely incomplete. So this returns null unless the configured
 * GSTIN is both well-formed and not one of the known placeholders.
 */

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

/** Sample/placeholder GSTINs that must never reach a customer document. */
const PLACEHOLDERS = ['36ABCDE1234F1Z5', '22AAAAA0000A1Z5', '29AAAAA0000A1Z5'];

/** The seller GSTIN, or null when none is configured or it is a placeholder. */
export function sellerGstin(): string | null {
  const raw = String(process.env.VITE_GSTIN || process.env.GSTIN || '').trim().toUpperCase();
  if (!raw) return null;
  if (!GSTIN_RE.test(raw)) return null;
  if (PLACEHOLDERS.includes(raw)) return null;
  return raw;
}

/** Registered legal name, falling back to the trading name. */
export function sellerLegalName(): string {
  return String(process.env.VITE_LEGAL_NAME || 'Tresor Couture').trim();
}
