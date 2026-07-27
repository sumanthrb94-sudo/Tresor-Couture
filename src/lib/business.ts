/**
 * Single source of truth for the legal/registered business identity.
 *
 * Consumed by GST tax invoices (src/lib/invoice.ts, src/components/TaxInvoice.tsx),
 * the public policy pages (src/content/policies.ts), the admin Compliance section,
 * and the storefront footer. Keep the brand voice OUT of here — this is the
 * dry legal record (what goes on an invoice and a privacy policy).
 *
 * TODO: confirm the real registered values before going live. The placeholders
 * below are structurally correct (GSTIN format, state code) but are NOT the
 * actual registration — replace them once the entity paperwork is in hand.
 */

export interface BusinessProfile {
  /** Trading / brand name shown to customers. */
  brandName: string;
  /** Registered legal entity name (proprietor / LLP / Pvt Ltd) for invoices. */
  legalName: string;
  /** 15-char GSTIN. First two digits encode the state (see stateCode). */
  gstin: string;
  /** PAN (10 chars) — embedded in the GSTIN but shown separately on invoices. */
  pan: string;
  /** Optional CIN for a Pvt Ltd / LLP; empty for a proprietorship. */
  cin?: string;
  /** Registered place of business, one line per array entry. */
  addressLines: string[];
  /** GST "place of supply" home state name — compared to the buyer's state to
   *  decide CGST+SGST (intra-state) vs IGST (inter-state). */
  stateName: string;
  /** Two-digit GST state code (e.g. Telangana = 36). Must match GSTIN prefix. */
  stateCode: string;
  /** Customer-facing contact. */
  email: string;
  phone: string;
  /** Public website / storefront URL. */
  website: string;
  /** When the legal copy (policies) was last reviewed — ISO date. */
  policiesUpdatedAt: string;
}

// Read legal registrations from environment so real values are never
// committed to source control. The fallbacks are intentionally invalid
// placeholders; set VITE_LEGAL_NAME, VITE_GSTIN and VITE_PAN at build time.
const env = typeof (import.meta as any).env !== 'undefined' ? (import.meta as any).env : {};

/** Fallback registered address — deliberately obvious placeholder text so the
 *  compliance screen can detect that it was never replaced. */
const PLACEHOLDER_ADDRESS = 'Tresor Atelier|Road No. 12, Banjara Hills|Hyderabad, Telangana 500034|India';

export const BUSINESS: BusinessProfile = {
  brandName: 'Tresor Couture',
  // CEO ACTION REQUIRED: set VITE_LEGAL_NAME before going live.
  legalName: String(env.VITE_LEGAL_NAME || 'Tresor Couture (Sole Proprietorship)'),
  // CEO ACTION REQUIRED: set VITE_GSTIN (15 chars) before going live.
  gstin: String(env.VITE_GSTIN || '36ABCDE1234F1Z5'),
  // CEO ACTION REQUIRED: set VITE_PAN (10 chars) before going live.
  pan: String(env.VITE_PAN || 'ABCDE1234F'),
  // Companies have a CIN and LLPs an LLPIN; a partnership firm or sole
  // proprietorship has neither, so empty is legitimate for those. Set VITE_CIN
  // when the entity has one.
  cin: String(env.VITE_CIN || ''),
  // Registered place of business, printed on every GST invoice. Set
  // VITE_BUSINESS_ADDRESS as pipe-separated lines, e.g.
  //   "Tresor Atelier|12-3-45 Some Road|Hyderabad, Telangana 500034|India"
  // (pipe, not comma — commas appear inside the lines themselves).
  addressLines: String(env.VITE_BUSINESS_ADDRESS || PLACEHOLDER_ADDRESS)
    .split('|')
    .map(s => s.trim())
    .filter(Boolean),
  stateName: 'Telangana',
  stateCode: '36',
  // Was concierge@tresorcouture.com — a domain the business does not own (it is
  // still unregistered), so mail to it bounced. The site publishes
  // hello@tresorcouture.in everywhere else; that is the default now.
  email: String(env.VITE_BUSINESS_EMAIL || 'hello@tresorcouture.in'),
  phone: '+91 63042 11922',
  website: 'https://tresorcouture.in',
  policiesUpdatedAt: '2026-06-02',
};

/** Launch blocker check: grep for these placeholder patterns in this file
 *  before approving go-live. They must all be replaced with real registrations. */
export const PLACEHOLDER_PATTERNS = ['36ABCDE1234F1Z5', 'ABCDE1234F'];

/** PAN — five letters, four digits, one letter. */
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** GSTIN — two-digit state code, then the 10-char PAN, an entity number,
 *  a literal 'Z', and a checksum character. */
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

/** The 4th character of a PAN encodes the holder's entity type. Surfacing this
 *  catches a genuine mismatch — e.g. an invoice that says "Sole Proprietorship"
 *  while the PAN is registered to a partnership firm. */
const PAN_ENTITY: Record<string, string> = {
  A: 'Association of Persons',
  B: 'Body of Individuals',
  C: 'Company',
  F: 'Partnership Firm / LLP',
  G: 'Government',
  H: 'Hindu Undivided Family',
  J: 'Artificial Juridical Person',
  L: 'Local Authority',
  P: 'Individual / Sole Proprietor',
  T: 'Trust',
};

export function panEntityType(pan: string): string | null {
  if (!PAN_RE.test(pan)) return null;
  return PAN_ENTITY[pan[3]] ?? null;
}

export interface LegalCheck {
  ok: boolean;
  label: string;
  note: string;
}

/**
 * Validate the legal registrations that end up on GST invoices. Beyond
 * "is it set", this cross-checks the two identifiers against each other: a
 * GSTIN embeds the PAN at characters 3–12 and its first two digits are the
 * state code, so a typo in either one is caught here rather than on a customer's
 * invoice.
 */
export function legalChecks(b: BusinessProfile = BUSINESS): LegalCheck[] {
  const pan = b.pan.trim().toUpperCase();
  const gstin = b.gstin.trim().toUpperCase();
  const panIsPlaceholder = PLACEHOLDER_PATTERNS.includes(pan);
  const gstinIsPlaceholder = PLACEHOLDER_PATTERNS.includes(gstin);
  const panValid = PAN_RE.test(pan) && !panIsPlaceholder;
  const gstinValid = GSTIN_RE.test(gstin) && !gstinIsPlaceholder;
  const legalNameSet = !/sole proprietorship\)$/i.test(b.legalName.trim());
  const addressSet = b.addressLines.join('|') !== PLACEHOLDER_ADDRESS;
  const entity = panEntityType(pan);

  const checks: LegalCheck[] = [
    {
      ok: panValid,
      label: 'PAN configured',
      note: panIsPlaceholder || !pan
        ? 'Placeholder PAN — set VITE_PAN in the deployment environment.'
        : panValid
          ? `${pan}${entity ? ` · ${entity}` : ''}`
          : `"${pan}" is not a valid PAN (expected 5 letters, 4 digits, 1 letter).`,
    },
    {
      ok: gstinValid,
      label: 'GSTIN configured',
      note: gstinIsPlaceholder || !gstin
        ? 'Placeholder GSTIN — set VITE_GSTIN in the deployment environment.'
        : gstinValid
          ? gstin
          : `"${gstin}" is not a valid GSTIN (expected 15 chars, e.g. 36ABCDE1234F1Z5).`,
    },
    {
      ok: legalNameSet,
      label: 'Registered legal name set',
      note: legalNameSet
        ? b.legalName
        : 'Still the default — set VITE_LEGAL_NAME to the registered entity name.',
    },
    {
      ok: addressSet,
      label: 'Registered place of business set',
      note: addressSet
        ? b.addressLines.join(', ')
        : 'Still the placeholder address — set VITE_BUSINESS_ADDRESS (pipe-separated lines). It is printed on every GST invoice.',
    },
    {
      ok: Boolean(b.email) && !/@tresorcouture\.com$/i.test(b.email),
      label: 'Contact email deliverable',
      note: /@tresorcouture\.com$/i.test(b.email)
        ? `${b.email} — tresorcouture.com is not a domain this business owns, so this address bounces. Use the .in domain.`
        : b.email,
    },
  ];

  // A company must carry a CIN; an LLP an LLPIN. A partnership firm or sole
  // proprietor has neither, so we only make this a hard requirement where the
  // PAN tells us unambiguously that it is a company.
  if (pan[3] === 'C') {
    checks.push({
      ok: Boolean(b.cin.trim()),
      label: 'CIN set (entity is a company)',
      note: b.cin.trim() || 'The PAN identifies a company — set VITE_CIN to the CIN.',
    });
  }

  // Cross-checks only make sense once both identifiers are individually valid.
  if (panValid && gstinValid) {
    const embedded = gstin.slice(2, 12);
    checks.push({
      ok: embedded === pan,
      label: 'GSTIN matches PAN',
      note: embedded === pan
        ? 'GSTIN embeds the registered PAN.'
        : `GSTIN carries PAN "${embedded}" but VITE_PAN is "${pan}" — one of them is wrong.`,
    });
    checks.push({
      ok: gstin.slice(0, 2) === b.stateCode,
      label: 'GSTIN state code matches place of supply',
      note: gstin.slice(0, 2) === b.stateCode
        ? `${b.stateCode} · ${b.stateName}`
        : `GSTIN starts ${gstin.slice(0, 2)} but place of supply is ${b.stateCode} (${b.stateName}).`,
    });
  }

  return checks;
}

/** Default HSN code for woven textile goods, used on invoice lines until a
 *  per-product HSN is captured. 5007 = woven fabrics of silk; broad enough as
 *  a sensible default for a heritage-weave catalogue. */
export const DEFAULT_HSN = '5007';

/** GST rate applied to the pre-tax value of tax-inclusive product prices. */
export const GST_RATE = 0.05;
