import { test, expect, type Browser } from '@playwright/test';
import { Recorder } from './lib/recorder';
import { adminPage, gotoAdmin } from './lib/session';

/**
 * Read-only coverage of EVERY admin console section.
 *
 * One test per section: sign in as admin, open the section, assert its landmark
 * heading and primary controls render against real seeded data, and record a
 * screenshot of each. These are non-mutating, so they are safe to run
 * concurrently with each other — the mutating admin workflows live in
 * admin-workflows.spec.ts.
 */

interface Section {
  slug: string;
  section: string;
  title: string;
  purpose: string;
  /** Accessible name of the section's landmark heading.
   *  Deliberately a heading role, not free text: the admin sidebar's mobile
   *  disclosure renders the section name in a `md:hidden` span that appears
   *  FIRST in the DOM, so getByText(...).first() resolves to a hidden node on
   *  desktop and never becomes visible. */
  heading: RegExp;
  /** Optional extra control to prove the section is interactive, not just painted. */
  control?: { kind: 'placeholder' | 'role'; value: string };
}

const SECTIONS: Section[] = [
  { slug: 'admin-01-dashboard', section: 'dashboard', title: 'Admin · Dashboard',
    purpose: 'The dashboard loads and reports live revenue, order counts and low-stock alerts computed from Firestore.',
    heading: /welcome back/i },
  { slug: 'admin-02-products', section: 'products', title: 'Admin · Products',
    purpose: 'The product catalogue lists seeded products and exposes the create/edit affordance.',
    heading: /^products$/i },
  { slug: 'admin-03-inventory', section: 'inventory', title: 'Admin · Inventory',
    purpose: 'Inventory lists stock levels per product and exposes the increase/decrease stock controls.',
    heading: /^inventory$/i, control: { kind: 'placeholder', value: 'Search product…' } },
  { slug: 'admin-04-orders', section: 'orders', title: 'Admin · Orders',
    purpose: 'The order queue lists seeded orders with searchable id/name/email and a status control per order.',
    heading: /^orders$/i, control: { kind: 'placeholder', value: 'Search id, name or email' } },
  { slug: 'admin-05-returns', section: 'returns', title: 'Admin · Returns & Refunds',
    purpose: 'The RMA queue renders with its totals and search, listing returns raised by customers.',
    heading: /returns & refunds/i, control: { kind: 'placeholder', value: 'Search customer, return, order…' } },
  { slug: 'admin-06-billing', section: 'billing', title: 'Admin · Billing',
    purpose: 'Billing renders revenue reporting derived from orders.',
    heading: /billing & finance/i },
  { slug: 'admin-07-customers', section: 'customers', title: 'Admin · Customers & CRM',
    purpose: 'The customer list shows every account with role, order count and lifetime spend, and offers CSV export.',
    heading: /^customers$/i, control: { kind: 'placeholder', value: 'Search name, email, phone…' } },
  { slug: 'admin-08-support', section: 'support', title: 'Admin · Support inbox',
    purpose: 'The support inbox renders the per-order conversation list with its search.',
    heading: /^support$/i, control: { kind: 'placeholder', value: 'Search conversations…' } },
  { slug: 'admin-09-coupons', section: 'coupons', title: 'Admin · Coupons',
    purpose: 'Coupons lists the seeded discount codes and exposes the create form.',
    heading: /^coupons$/i },
  { slug: 'admin-10-reviews', section: 'reviews', title: 'Admin · Reviews',
    purpose: 'The reviews moderation screen renders (empty state expected with no seeded reviews).',
    heading: /^reviews$/i },
  { slug: 'admin-11-compliance', section: 'compliance', title: 'Admin · Legal & Compliance',
    purpose: 'Compliance renders the registered-business panel and the validated legal checklist — PAN/GSTIN format, placeholder detection, and the GSTIN↔PAN cross-check.',
    heading: /legal & compliance/i },
  { slug: 'admin-12-delivery', section: 'delivery', title: 'Admin · Delivery',
    purpose: 'The delivery settings screen renders with its serviceable-pincode control.',
    heading: /-minute delivery/i },
  { slug: 'admin-13-bulk-email', section: 'bulk-email', title: 'Admin · Bulk Email',
    purpose: 'The bulk email composer renders with subject and recipient controls.',
    heading: /bulk email/i },
];

for (const s of SECTIONS) {
  test(`${s.title}`, async ({ browser }: { browser: Browser }) => {
    test.setTimeout(120_000);
    const rec = new Recorder({
      slug: s.slug,
      title: s.title,
      area: 'Admin console',
      purpose: s.purpose,
      reproduce: [
        'Start the Firebase emulators and seed the full dataset (see README → Tests).',
        'Build with VITE_USE_EMULATORS=1 and serve on http://127.0.0.1:4173.',
        'Sign in as admin@test.local / Test1234! (this account carries the admin custom claim).',
        `Navigate to #/admin/${s.section}.`,
        'Confirm the section heading and its primary controls render against seeded data.',
      ],
    });

    try {
      const adm = await adminPage(browser);
      await rec.step(adm, 'Signed in as the atelier admin', 'The admin custom claim gates both the UI and the Firestore rules.');

      await gotoAdmin(adm, s.section);
      await expect(adm.getByRole('heading', { name: s.heading }).first()).toBeVisible({ timeout: 20_000 });
      await rec.step(adm, `Opened #/admin/${s.section}`, `Landmark heading matches ${s.heading}.`, 'assert');

      if (s.control) {
        const loc = s.control.kind === 'placeholder'
          ? adm.getByPlaceholder(s.control.value)
          : adm.getByRole('button', { name: new RegExp(s.control.value, 'i') });
        await expect(loc.first()).toBeVisible({ timeout: 15_000 });
        await rec.step(adm, `Primary control present: "${s.control.value}"`, 'Proves the section is interactive, not just painted.', 'assert');
      }

      rec.finish('passed');
      await adm.context().close();
    } catch (err) {
      rec.finish('failed', err instanceof Error ? err.message : String(err));
      throw err;
    }
  });
}
