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

export const BUSINESS: BusinessProfile = {
  brandName: 'Tresor Couture',
  legalName: 'Tresor Couture (Sole Proprietorship)', // TODO: confirm registered name
  gstin: '36ABCDE1234F1Z5', // TODO: confirm — placeholder, Telangana (36) format-valid
  pan: 'ABCDE1234F', // TODO: confirm
  cin: '', // proprietorship — no CIN
  addressLines: [
    'Tresor Atelier',
    'Plot No. 110, My Home Vihanga Rd, Q City',
    'Gachibowli, Hyderabad, Telangana 500046',
    'India',
  ],
  stateName: 'Telangana',
  stateCode: '36',
  email: 'hello@tresorcouture.in',
  phone: '+91 63042 11922',
  website: 'https://tresorcouture.in',
  policiesUpdatedAt: '2026-06-02',
};

/** Default HSN code for woven textile goods, used on invoice lines until a
 *  per-product HSN is captured. 5007 = woven fabrics of silk; broad enough as
 *  a sensible default for a heritage-weave catalogue. */
export const DEFAULT_HSN = '5007';

/** GST rate applied at checkout (see ordersApi.place — tax = 5% of taxable). */
export const GST_RATE = 0.05;
