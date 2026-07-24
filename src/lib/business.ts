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

export const BUSINESS: BusinessProfile = {
  brandName: 'Tresor Couture',
  // CEO ACTION REQUIRED: set VITE_LEGAL_NAME before going live.
  legalName: String(env.VITE_LEGAL_NAME || 'Tresor Couture (Sole Proprietorship)'),
  // CEO ACTION REQUIRED: set VITE_GSTIN (15 chars) before going live.
  gstin: String(env.VITE_GSTIN || '36ABCDE1234F1Z5'),
  // CEO ACTION REQUIRED: set VITE_PAN (10 chars) before going live.
  pan: String(env.VITE_PAN || 'ABCDE1234F'),
  cin: '', // proprietorship — no CIN
  // CEO ACTION REQUIRED: replace with the registered place of business.
  addressLines: [
    'Tresor Atelier',
    'Road No. 12, Banjara Hills',
    'Hyderabad, Telangana 500034',
    'India',
  ],
  stateName: 'Telangana',
  stateCode: '36',
  email: 'concierge@tresorcouture.com',
  phone: '+91 63042 11922',
  website: 'https://tresorcouture.in',
  policiesUpdatedAt: '2026-06-02',
};

/** Launch blocker check: grep for these placeholder patterns in this file
 *  before approving go-live. They must all be replaced with real registrations. */
export const PLACEHOLDER_PATTERNS = ['36ABCDE1234F1Z5', 'ABCDE1234F'];

/** Default HSN code for woven textile goods, used on invoice lines until a
 *  per-product HSN is captured. 5007 = woven fabrics of silk; broad enough as
 *  a sensible default for a heritage-weave catalogue. */
export const DEFAULT_HSN = '5007';

/** GST rate applied to the pre-tax value of tax-inclusive product prices. */
export const GST_RATE = 0.05;
