import { test, expect } from '@playwright/test';
import { Recorder } from './lib/recorder';
import { gstinConfigured, panConfigured, type BusinessProfile, BUSINESS } from '../../src/lib/business';
import { sellerGstin } from '../../api/_lib/sellerLegal';

/**
 * A registration number that does not belong to us must never appear on a
 * customer-facing document. Printing a placeholder GSTIN on an invoice, in the
 * Terms, or in an order email is a misrepresentation; printing nothing is
 * merely incomplete — so every surface gates on the same check.
 *
 * This exists because the guard was added to the tax invoice but MISSED in
 * `src/content/policies.ts`, which interpolated the GSTIN unconditionally into
 * the Terms and the Contact page. The placeholder was live on both.
 *
 * Fixtures below are structurally valid but deliberately synthetic. The real
 * registration lives only in the deployment environment, never in this repo.
 */

const PLACEHOLDER = '36ABCDE1234F1Z5';
/** Valid shape, obviously not a real allotment. */
const SYNTHETIC_VALID = '36ZZZZZ9999Z1Z9';

const profile = (gstin: string, pan = 'ZZZZZ9999Z'): BusinessProfile =>
  ({ ...BUSINESS, gstin, pan });

test('Legal disclosure · a placeholder registration never reaches a customer', async () => {
  const rec = new Recorder({
    slug: 'legal-disclosure-gating',
    title: 'Legal disclosure · GSTIN gating',
    area: 'Compliance',
    purpose:
      'Every customer-facing surface that can show a GSTIN — tax invoice, Terms, Contact page, storefront footer and the order-confirmation email — resolves it through the same gate, so a placeholder or malformed registration is omitted rather than printed.',
    reproduce: [
      'Leave VITE_GSTIN unset (or set to the sample 36ABCDE1234F1Z5) and build.',
      'Open an order invoice, #/terms, #/contact and the storefront footer: no GSTIN appears anywhere.',
      'Set VITE_GSTIN to the real registration and rebuild.',
      'The same four surfaces now show it, and the order-confirmation email carries it in its footer.',
    ],
  });

  try {
    // --- The client-side gate -------------------------------------------------
    expect(gstinConfigured(profile(PLACEHOLDER))).toBe(false);
    rec.note('Sample GSTIN rejected', 'The shipped placeholder is treated as "not configured".');

    expect(gstinConfigured(profile(''))).toBe(false);
    expect(gstinConfigured(profile('36ZZZZZ9999'))).toBe(false);      // too short
    expect(gstinConfigured(profile('36ZZZZZ9999Z1XR'))).toBe(false);  // 14th char must be Z
    expect(gstinConfigured(profile('AA360826013968O'))).toBe(false);  // an ARN, not a GSTIN
    rec.note('Empty, truncated and malformed values rejected',
      'Includes the application reference number, which is easy to confuse with the registration itself.');

    expect(gstinConfigured(profile(SYNTHETIC_VALID))).toBe(true);
    rec.note('A well-formed registration is accepted', 'The gate blocks placeholders, not real values.');

    // --- The server-side gate (order email) -----------------------------------
    const prev = process.env.VITE_GSTIN;
    try {
      delete process.env.VITE_GSTIN;
      expect(sellerGstin()).toBeNull();

      process.env.VITE_GSTIN = PLACEHOLDER;
      expect(sellerGstin()).toBeNull();

      process.env.VITE_GSTIN = 'not-a-gstin';
      expect(sellerGstin()).toBeNull();

      process.env.VITE_GSTIN = SYNTHETIC_VALID.toLowerCase();
      expect(sellerGstin()).toBe(SYNTHETIC_VALID);
    } finally {
      if (prev === undefined) delete process.env.VITE_GSTIN; else process.env.VITE_GSTIN = prev;
    }
    rec.note('Order email applies the same rule, and normalises case',
      'api/_lib/sellerLegal.ts mirrors the client gate because api/ compiles as standalone ESM.');

    // --- PAN uses the same discipline ----------------------------------------
    expect(panConfigured({ ...BUSINESS, pan: 'ABCDE1234F' })).toBe(false);
    rec.note('PAN placeholder rejected too', 'Same reasoning: a fabricated PAN on an invoice is worse than none.');

    rec.finish('passed');
  } catch (err) {
    rec.finish('failed', err instanceof Error ? err.message : String(err));
    throw err;
  }
});
