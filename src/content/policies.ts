/**
 * Static legal/policy copy for the public pages, rendered by src/pages/LegalPage.tsx
 * and linked from the footer + admin Compliance section.
 *
 * India D2C aware: references GST/Consumer-Protection-(E-Commerce)-Rules-2020
 * disclosures and the Digital Personal Data Protection Act, 2023 (DPDP). This
 * is a sensible, structurally-complete starting point — have it reviewed by a
 * lawyer before relying on it commercially. Business identity comes from
 * src/lib/business.ts so there is one source of truth.
 */

import type { PolicyKey } from '../types';
import { BUSINESS } from '../lib/business';

export interface PolicySection {
  heading: string;
  /** Each string is a paragraph; lines starting with "• " render as list items. */
  body: string[];
}

export interface Policy {
  title: string;
  intro: string;
  sections: PolicySection[];
}

const addr = BUSINESS.addressLines.join(', ');

export const POLICIES: Record<PolicyKey, Policy> = {
  privacy: {
    title: 'Privacy Policy',
    intro: `${BUSINESS.legalName} ("we", "us") operates ${BUSINESS.website}. This policy explains what personal data we collect, why, and your rights under the Digital Personal Data Protection Act, 2023 (DPDP).`,
    sections: [
      { heading: 'Data we collect', body: [
        'We collect only what we need to fulfil your orders and run the store:',
        '• Identity & contact: name, email, phone, shipping address.',
        '• Order data: items, amounts, GST invoices, payment status.',
        '• Account data: sign-in method (email, Google, or phone), saved addresses and wishlist.',
        '• Technical data: device/browser information and, with your consent, analytics.',
      ]},
      { heading: 'Why we use it (purpose)', body: [
        'To process and deliver orders, issue tax invoices, provide customer support, prevent fraud, meet legal/tax obligations, and — only with your consent — send marketing.',
      ]},
      { heading: 'Sharing', body: [
        'We share data with service providers strictly to operate the store: payment processors, logistics/courier partners, email/SMS providers (Brevo), and Google Firebase (authentication, database, hosting). We do not sell your personal data.',
      ]},
      { heading: 'Retention', body: [
        'Order and invoice records are retained as long as required by Indian tax law (currently up to 8 years). Other personal data is kept only as long as your account is active or as needed for the purposes above.',
      ]},
      { heading: 'Your rights (DPDP)', body: [
        'You may access, correct, or erase your personal data, and withdraw consent at any time.',
        `• Access/Export: request a copy of your data — signed-in customers can export it from their account, or email ${BUSINESS.email}.`,
        '• Erasure: request deletion. We will erase your profile and anonymise personal details on past orders, retaining only the financial record tax law requires.',
        `• Grievances: contact our Grievance Officer at ${BUSINESS.email}.`,
      ]},
      { heading: 'Security', body: [
        'Access to customer data is restricted to authorised administrators and protected by Firebase Authentication and security rules. No method of transmission is perfectly secure, but we take reasonable safeguards.',
      ]},
    ],
  },
  terms: {
    title: 'Terms of Service',
    intro: `These terms govern your use of ${BUSINESS.website} and any purchase from ${BUSINESS.legalName}.`,
    sections: [
      { heading: 'Orders & acceptance', body: [
        'Placing an order is an offer to buy. We may accept or decline it (e.g. stock or pricing errors). A contract forms when we confirm the order.',
      ]},
      { heading: 'Pricing & GST', body: [
        `All prices are in Indian Rupees and inclusive of applicable taxes unless stated. A GST tax invoice is issued for every order under GSTIN ${BUSINESS.gstin}.`,
      ]},
      { heading: 'Products', body: [
        'Our goods are hand-woven; slight variation in colour, weave and finish is inherent and not a defect. Photographs are indicative.',
      ]},
      { heading: 'Intellectual property', body: [
        'All content, imagery and branding on this site belongs to us and may not be reused without permission.',
      ]},
      { heading: 'Liability', body: [
        'To the extent permitted by law, our liability for any order is limited to the amount you paid for it.',
      ]},
      { heading: 'Governing law', body: [
        `These terms are governed by the laws of India; disputes are subject to the courts of ${BUSINESS.stateName}.`,
      ]},
    ],
  },
  refund: {
    title: 'Refund & Returns Policy',
    intro: 'We want you to love your weave. If something is not right, here is how returns and refunds work.',
    sections: [
      { heading: 'Eligibility', body: [
        '• Returns are accepted within 7 days of delivery for unused items in original condition with tags intact.',
        '• Made-to-order, customised, and altered pieces are not returnable unless they arrive damaged or defective.',
      ]},
      { heading: 'How to start a return', body: [
        `Email ${BUSINESS.email} with your order number and the reason. We will arrange a pickup or share return instructions.`,
      ]},
      { heading: 'Refunds', body: [
        'Once we receive and inspect the item, approved refunds are issued to the original payment method within 5–7 working days. Shipping charges are non-refundable unless the return is due to our error.',
      ]},
      { heading: 'Damaged or wrong items', body: [
        'If you receive a damaged or incorrect item, contact us within 48 hours of delivery with photographs and we will replace it or refund you in full.',
      ]},
    ],
  },
  shipping: {
    title: 'Shipping Policy',
    intro: 'Where we ship, how long it takes, and what it costs.',
    sections: [
      { heading: 'Coverage & charges', body: [
        '• We ship pan-India. Shipping is complimentary on orders over ₹1,999; a flat ₹99 applies below that.',
        '• Select international destinations are served on request — email us for a quote.',
      ]},
      { heading: 'Dispatch & delivery', body: [
        '• In-stock pieces are dispatched within 48 hours. Made-to-order pieces follow the timeline shown on the product page.',
        '• Within Hyderabad, eligible in-stock pieces can be delivered the same day (40-minute service where available).',
      ]},
      { heading: 'Tracking', body: [
        'You will receive a tracking link by email once your parcel leaves the atelier.',
      ]},
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    intro: 'We use a small number of cookies and similar technologies to run the store and, with your consent, to understand usage.',
    sections: [
      { heading: 'Types of cookies', body: [
        '• Strictly necessary: sign-in session, cart, and security. These are always on.',
        '• Analytics/functional: help us understand how the site is used. These load only if you accept.',
        '• Marketing: used to measure campaigns; only with your consent.',
      ]},
      { heading: 'Managing consent', body: [
        'You can accept or reject non-essential cookies from the banner shown on your first visit, and change your choice any time by clearing the site data in your browser.',
      ]},
    ],
  },
  contact: {
    title: 'Contact Us',
    intro: 'We would love to hear from you.',
    sections: [
      { heading: 'Reach the atelier', body: [
        `• Email: ${BUSINESS.email}`,
        `• Phone: ${BUSINESS.phone}`,
        `• Registered address: ${addr}`,
      ]},
      { heading: 'Business details', body: [
        `• Legal entity: ${BUSINESS.legalName}`,
        `• GSTIN: ${BUSINESS.gstin}`,
      ]},
      { heading: 'Grievance officer', body: [
        `For privacy or data-rights requests under DPDP, and for consumer grievances under the Consumer Protection (E-Commerce) Rules, 2020, contact our Grievance Officer at ${BUSINESS.email}.`,
      ]},
    ],
  },
};
