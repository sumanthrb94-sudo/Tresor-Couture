/**
 * Brand-owned email addresses, in one place so a future rename never
 * leaves stale references in the codebase.
 *
 * If you add a new public-facing email, register it here AND update:
 *   - branding/email-templates/SETUP-WALKTHROUGH.md (Firebase Console steps)
 *   - branding/email-templates/auth/*.html footers
 *   - any Footer / Contact page that surfaces these to customers
 */

export const BRAND_CONTACTS = {
  /** General first-contact inbox AND the FROM address on every transactional email. */
  hello:  'hello@tresorcouture.in',
  /** Customer support — returns, exchanges, sizing, complaints, missing parcels. Reply-To on transactional mail. */
  care:   'care@tresorcouture.in',
  /** Made-to-order, fabric customisation, bridal consultations, wholesale, press. */
  studio: 'studio@tresorcouture.in',
} as const;

/** Single sender identity used as the FROM on outbound transactional mail. */
export const TRESOR_FROM = `Tresor Couture <${BRAND_CONTACTS.hello}>`;

/** Customer-facing site URL. Reflects the production deployment. */
export const TRESOR_SITE_DOMAIN = 'tresorcouture.in';
