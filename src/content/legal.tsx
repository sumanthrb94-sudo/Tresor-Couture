/**
 * Static content pages — legal/policy, support, and brand pages rendered by
 * src/pages/InfoPage.tsx and linked from the footer.
 *
 * IMPORTANT — before go-live, replace every [BRACKETED] placeholder with the
 * real value (registered entity name, GSTIN, exact return/refund windows,
 * jurisdiction). The contact details below are the known business details;
 * confirm them too. Have a lawyer review the policy copy for your jurisdiction
 * (India D2C / Consumer Protection (E-Commerce) Rules 2020, DPDP Act 2023).
 */

export const LEGAL_UPDATED = '25 June 2026';

export const COMPANY = {
  brand: 'Tresor Couture',
  /** Registered legal entity — fill before launch. */
  legalEntity: '[REGISTERED LEGAL ENTITY NAME] ("Tresor Couture", "we", "us")',
  email: 'hello@tresorcouture.in',
  phone: '+91 63042 11922',
  address: 'Plot No. 110, My Home Vihanga Rd, Q City, Gachibowli, Hyderabad, Telangana 500049',
  gstin: '[GSTIN]',
  instagram: 'https://instagram.com/_tresor.couture',
  hours: 'Mon–Sat, 10:00–19:00 IST',
};

export interface InfoSection {
  /** Heading for the section (also used as the question in FAQ). */
  h?: string;
  /** Paragraphs. */
  p?: string[];
  /** Bullet list. */
  ul?: string[];
}

export interface InfoPageDef {
  title: string;
  /** Show the "Last updated" stamp (legal pages). */
  legal?: boolean;
  /** Lead paragraph under the title. */
  lede?: string;
  sections: InfoSection[];
}

const policyContactNote: InfoSection = {
  h: 'Contact us',
  p: [
    `Questions about this policy? Email ${COMPANY.email} or call ${COMPANY.phone} (${COMPANY.hours}).`,
    `${COMPANY.legalEntity}. Registered address: ${COMPANY.address}. GSTIN: ${COMPANY.gstin}.`,
  ],
};

export const INFO_PAGES: Record<string, InfoPageDef> = {
  privacy: {
    title: 'Privacy Policy',
    legal: true,
    lede: `This policy explains what personal data ${COMPANY.brand} collects, why, and your rights over it. We process personal data in line with India's Digital Personal Data Protection Act, 2023.`,
    sections: [
      { h: 'Information we collect', ul: [
        'Identity & contact: name, email, phone, shipping/billing address.',
        'Order data: items purchased, amounts, and delivery details.',
        'Payment data: handled by our PCI-DSS-compliant payment partner (Razorpay). We do not store full card numbers on our servers.',
        'Technical data: device, browser, IP, and usage analytics (where you consent).',
        'Location: only the approximate location you share to check delivery serviceability.',
      ] },
      { h: 'How we use it', ul: [
        'To process, fulfil, and deliver your orders and send transactional updates.',
        'To provide customer support and handle returns/refunds.',
        'To improve the store, prevent fraud, and meet legal/tax obligations.',
        'For marketing only where you have opted in (you can opt out anytime).',
      ] },
      { h: 'Sharing', p: [
        'We share data only with service providers who help us operate — payment gateway, logistics/courier partners, email/WhatsApp providers, and analytics — under contract, and with authorities where legally required. We never sell your personal data.',
      ] },
      { h: 'Cookies & analytics', p: [
        'We use essential cookies to run the site and, with your consent, analytics/marketing tags. You can control non-essential trackers via your browser or our consent controls.',
      ] },
      { h: 'Data retention', p: [
        'We keep order and tax records as required by Indian law, and other personal data only as long as needed for the purposes above.',
      ] },
      { h: 'Your rights', p: [
        'You may request access, correction, or deletion of your personal data, and withdraw consent, by emailing ' + COMPANY.email + '. We will respond within the timelines required by applicable law.',
      ] },
      { h: 'Grievance Officer', p: [
        'Under the DPDP Act and the Consumer Protection (E-Commerce) Rules, 2020, our Grievance Officer is [GRIEVANCE OFFICER NAME], reachable at ' + COMPANY.email + '. We acknowledge complaints within 48 hours and resolve them within the statutory period.',
      ] },
      policyContactNote,
    ],
  },

  terms: {
    title: 'Terms of Use',
    legal: true,
    lede: `By accessing or buying from ${COMPANY.brand}, you agree to these terms. Please read them carefully.`,
    sections: [
      { h: 'Using the site', p: [
        'You agree to provide accurate information and to use the site lawfully. You must be 18+ or have a guardian’s consent to transact.',
      ] },
      { h: 'Products, pricing & availability', p: [
        'We describe products as accurately as possible; colours may vary slightly by screen and natural materials carry small irregularities. Prices are in INR and inclusive of GST unless stated. We may correct errors, change prices, or limit/decline an order (including for stock or suspected fraud) at any time before dispatch.',
      ] },
      { h: 'Orders & payment', p: [
        'An order is an offer to buy; a contract forms when we confirm dispatch. Payments are processed by our payment partner; order totals are validated on our servers at checkout.',
      ] },
      { h: 'Intellectual property', p: [
        `All site content, imagery, the ${COMPANY.brand} name, logos, and brand assets are owned by us or our licensors and may not be used without written permission.`,
      ] },
      { h: 'Limitation of liability', p: [
        'To the extent permitted by law, our liability for any claim is limited to the amount you paid for the relevant order. We are not liable for indirect or consequential losses.',
      ] },
      { h: 'Governing law', p: [
        'These terms are governed by the laws of India; courts at [CITY/JURISDICTION] have exclusive jurisdiction.',
      ] },
      policyContactNote,
    ],
  },

  shipping: {
    title: 'Shipping & Delivery',
    legal: true,
    lede: 'How and when your order reaches you.',
    sections: [
      { h: 'Express delivery — Hyderabad', p: [
        'For serviceable Hyderabad pincodes, eligible in-stock pieces qualify for our 40-minute express delivery. Eligibility is shown at checkout via the delivery checker; orders outside the express zone ship by standard courier.',
      ] },
      { h: 'Standard shipping — pan-India', ul: [
        'Free standard shipping on orders over ₹1,999; otherwise a flat ₹99.',
        'Orders are dispatched within [1–2] business days; delivery typically [4–7] business days depending on location.',
        'A tracking link is shared by email/WhatsApp once your order ships.',
      ] },
      { h: 'Delays', p: [
        'Couriers may be delayed by weather, regional restrictions, or peak volumes. We are not liable for delays once a parcel is with the carrier, but we will help you track and resolve issues.',
      ] },
      policyContactNote,
    ],
  },

  returns: {
    title: 'Returns & Refunds',
    legal: true,
    lede: 'We want you to love your piece. If something isn’t right, here’s how returns and refunds work.',
    sections: [
      { h: 'Return window', p: [
        'You may request a return within [7] days of delivery, provided items are unused, unwashed, and in original condition with tags and packaging intact.',
      ] },
      { h: 'Non-returnable items', ul: [
        'Custom/made-to-measure or altered pieces.',
        'Fabric cut to a requested length.',
        'Items marked final sale.',
        'Used, washed, or damaged-by-customer items.',
      ] },
      { h: 'How to start a return', p: [
        `Email ${COMPANY.email} with your order number and reason (a photo helps for damaged/incorrect items). We’ll share pickup/return instructions.`,
      ] },
      { h: 'Refunds', ul: [
        'Once we receive and inspect the return, approved refunds are issued to the original payment method within [5–7] business days.',
        'Shipping charges are non-refundable unless the item was defective or incorrect.',
        'For prepaid orders, refunds go via the payment gateway; bank posting times may vary.',
      ] },
      { h: 'Damaged or wrong item', p: [
        'If you receive a damaged or incorrect item, contact us within 48 hours of delivery with photos and we’ll arrange a replacement or full refund at no cost to you.',
      ] },
      policyContactNote,
    ],
  },

  cancellation: {
    title: 'Cancellation Policy',
    legal: true,
    lede: 'When and how an order can be cancelled.',
    sections: [
      { h: 'Before dispatch', p: [
        `You can cancel an order any time before it is dispatched for a full refund. Email ${COMPANY.email} or call ${COMPANY.phone} with your order number as soon as possible.`,
      ] },
      { h: 'Express (40-minute) orders', p: [
        'Express Hyderabad orders move to packing within minutes, so cancellation may not be possible once a rider is assigned. Contact us immediately and we’ll help where we can.',
      ] },
      { h: 'After dispatch', p: [
        'Once dispatched, an order cannot be cancelled but may be eligible for return under our Returns & Refunds policy.',
      ] },
      { h: 'Cancellations by us', p: [
        'We may cancel an order due to stock issues, pricing errors, or suspected fraud; you’ll be notified and refunded in full.',
      ] },
      policyContactNote,
    ],
  },

  contact: {
    title: 'Contact Us',
    lede: 'We’re a small atelier and we read every message. Here’s how to reach us.',
    sections: [
      { h: 'Customer care', p: [
        `Email: ${COMPANY.email}`,
        `Phone/WhatsApp: ${COMPANY.phone}`,
        `Hours: ${COMPANY.hours}`,
      ] },
      { h: 'Studio address', p: [COMPANY.address] },
      { h: 'Orders & returns', p: [
        'For order status, returns, or refunds, email us with your order number and we’ll get back within one business day.',
      ] },
      { h: 'Press & partnerships', p: [
        `For press, collaborations, or atelier visits, write to ${COMPANY.email} with “Press” or “Partnership” in the subject.`,
      ] },
    ],
  },

  faq: {
    title: 'Frequently Asked Questions',
    lede: 'Quick answers to the things customers ask most.',
    sections: [
      { h: 'Where do you deliver?', p: [
        'We ship pan-India. In serviceable Hyderabad pincodes, eligible in-stock pieces qualify for 40-minute express delivery — check yours with the delivery checker on the product and cart pages.',
      ] },
      { h: 'What does shipping cost?', p: [
        'Standard shipping is free over ₹1,999, otherwise a flat ₹99. Express Hyderabad delivery eligibility is shown at checkout.',
      ] },
      { h: 'How do I track my order?', p: [
        'You’ll get a tracking link by email/WhatsApp once your order ships. Signed-in customers can also see orders under My Account → Orders.',
      ] },
      { h: 'What payment methods do you accept?', p: [
        'Cards, UPI, and netbanking via our secure payment partner, plus Cash on Delivery where available.',
      ] },
      { h: 'Can I return or exchange an item?', p: [
        'Yes — unused items in original condition can be returned within [7] days. See our Returns & Refunds page for details and exclusions.',
      ] },
      { h: 'Are the fabrics authentic?', p: [
        'Every weave is sourced from named artisan clusters and quality-checked. Authenticity is core to what we do.',
      ] },
    ],
  },

  about: {
    title: 'About Tresor Couture',
    lede: 'Heritage Indian craft, brought to your door.',
    sections: [
      { h: 'Our story', p: [
        'Tresor Couture exists to keep India’s living weaving traditions thriving — pairing master artisans with people who value the real thing. Every piece is chosen for craft, character, and provenance.',
      ] },
      { h: 'The weavers', p: [
        'We work directly with weaving clusters across India, naming the makers behind each piece and ensuring fair, transparent sourcing. When in doubt, we defer to the weaver.',
      ] },
      { h: 'Sustainability', p: [
        'Natural fibres, small batches, and made-to-order pieces mean less waste. We favour longevity over trend — clothes and fabric meant to be kept.',
      ] },
      { h: 'Visit the atelier', p: [
        `Our studio is in Gachibowli, Hyderabad. To arrange a visit, email ${COMPANY.email}.`,
      ] },
    ],
  },

  careers: {
    title: 'Careers',
    lede: 'Build a heritage-luxury brand with us.',
    sections: [
      { h: 'Working at Tresor Couture', p: [
        'We’re a small, fast-moving atelier in Hyderabad. We hire for craft, care, and ownership across studio operations, merchandising, content, and last-mile delivery.',
      ] },
      { h: 'Open roles', p: [
        'Roles are posted as they open. To express interest, email your CV and a short note to ' + COMPANY.email + ' with the role (or “General”) in the subject.',
      ] },
    ],
  },
};

export type InfoSlug = keyof typeof INFO_PAGES;
