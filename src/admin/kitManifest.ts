/**
 * Catalog of brand-kit assets surfaced in the admin section.
 *
 * Paths are public URLs (served from /public/branding/...), kept in sync with
 * the outputs of branding/generate.py via the mirror_to_public() step.
 */

export interface KitAsset {
  id: string;
  name: string;
  description: string;
  url: string;
  /** Optional override for download filename. Falls back to last url segment. */
  downloadAs?: string;
  /** Display dimensions for the asset card label. */
  size: string;
  /** Aspect ratio hint for the preview tile. */
  aspect: 'square' | 'story' | 'wide' | 'tall' | 'pin' | 'card' | 'a4' | 'pinterest';
  /** Optional inline preview for very tall / wide assets. */
  framing?: 'contain' | 'cover';
  /** Whether the file is a SVG (so we render it inline instead of <img>). */
  kind: 'png' | 'jpg' | 'svg' | 'ico' | 'html';
}

export interface KitSection {
  id: string;
  title: string;
  blurb: string;
  assets: KitAsset[];
}

const SOCIAL = '/branding/social';
const FAVI = '/branding/favicons';
const PRINT = '/branding/print';
const ROOT = '/branding';

export const KIT_SECTIONS: KitSection[] = [
  {
    id: 'logo',
    title: 'Logo & Master Marks',
    blurb:
      'The painted master and four vector lockups. Use the master on cream or dark canvases; switch to the SVG marks anywhere transparency or recolour is needed.',
    assets: [
      {
        id: 'master',
        name: 'Master monogram (painted)',
        description: 'Hand-painted TC with reclining figure and floral sprig. RGBA transparent, 1272 × 1685.',
        url: `${ROOT}/monogram-master.png`,
        size: '1272 × 1685',
        aspect: 'tall',
        framing: 'contain',
        kind: 'png',
      },
      {
        id: 'monogram-svg',
        name: 'Monogram (SVG)',
        description: 'Vector monogram in gold gradient. Recolour via the linear-gradient stops.',
        url: `${ROOT}/monogram.svg`,
        size: 'Vector',
        aspect: 'square',
        framing: 'contain',
        kind: 'svg',
      },
      {
        id: 'horizontal',
        name: 'Horizontal lockup',
        description: 'Mark + wordmark side-by-side. Use in headers, invoices, email signatures.',
        url: `${ROOT}/horizontal.svg`,
        size: 'Vector',
        aspect: 'wide',
        framing: 'contain',
        kind: 'svg',
      },
      {
        id: 'wordmark',
        name: 'Wordmark only',
        description: 'TRÉSOR / COUTURE in the brand serif with hairline rule. Use when a mark is already nearby.',
        url: `${ROOT}/wordmark.svg`,
        size: 'Vector',
        aspect: 'wide',
        framing: 'contain',
        kind: 'svg',
      },
      {
        id: 'mark',
        name: 'Compact mark',
        description: 'Tight TC mark. Favicons, app icons, watermarks.',
        url: `${ROOT}/mark.svg`,
        size: 'Vector',
        aspect: 'square',
        framing: 'contain',
        kind: 'svg',
      },
    ],
  },
  {
    id: 'favicons',
    title: 'Favicons & Web Icons',
    blurb:
      'Ink-on-cream "TC" set built for legibility at small sizes — replaces the painted PNG (which washed out against white tabs). Wired into index.html.',
    assets: [
      { id: 'favicon-16', name: '16 × 16', description: 'Browser tab icon (small).', url: `${FAVI}/favicon-16x16.png`, size: '16 × 16', aspect: 'square', kind: 'png' },
      { id: 'favicon-32', name: '32 × 32', description: 'Browser tab icon (Retina).', url: `${FAVI}/favicon-32x32.png`, size: '32 × 32', aspect: 'square', kind: 'png' },
      { id: 'favicon-48', name: '48 × 48', description: 'Windows tile / shortcut.', url: `${FAVI}/favicon-48x48.png`, size: '48 × 48', aspect: 'square', kind: 'png' },
      { id: 'favicon-64', name: '64 × 64', description: 'Multi-purpose desktop icon.', url: `${FAVI}/favicon-64x64.png`, size: '64 × 64', aspect: 'square', kind: 'png' },
      { id: 'favicon-96', name: '96 × 96', description: 'Android Chrome / large tiles.', url: `${FAVI}/favicon-96x96.png`, size: '96 × 96', aspect: 'square', kind: 'png' },
      { id: 'favicon-180', name: '180 × 180', description: 'iOS apple-touch-icon.', url: `${FAVI}/favicon-180x180.png`, size: '180 × 180', aspect: 'square', kind: 'png' },
      { id: 'favicon-192', name: '192 × 192', description: 'PWA / Android home screen.', url: `${FAVI}/favicon-192x192.png`, size: '192 × 192', aspect: 'square', kind: 'png' },
      { id: 'favicon-256', name: '256 × 256', description: 'High-res browser fallback.', url: `${FAVI}/favicon-256x256.png`, size: '256 × 256', aspect: 'square', kind: 'png' },
      { id: 'favicon-512', name: '512 × 512', description: 'PWA splash / maskable.', url: `${FAVI}/favicon-512x512.png`, size: '512 × 512', aspect: 'square', kind: 'png' },
      { id: 'favicon-ico', name: 'favicon.ico (multi-res)', description: 'Bundle of 16/32/48/64 for legacy browsers.', url: `${FAVI}/favicon.ico`, size: 'Multi', aspect: 'square', kind: 'ico' },
      { id: 'manifest', name: 'site.webmanifest', description: 'PWA manifest declaring colors and icon set.', url: `${FAVI}/site.webmanifest`, size: 'JSON', aspect: 'square', kind: 'html' },
    ],
  },
  {
    id: 'og',
    title: 'Open Graph & Link Preview',
    blurb:
      'Default 1200 × 630 used by WhatsApp, iMessage, Slack, Twitter Cards, Facebook, LinkedIn. Already referenced in index.html.',
    assets: [
      {
        id: 'og-default',
        name: 'OG default',
        description: 'Painted logo + wordmark + tagline on cream. The canonical share preview.',
        url: `${SOCIAL}/og-default-1200x630.png`,
        size: '1200 × 630',
        aspect: 'wide',
        framing: 'cover',
        kind: 'png',
      },
    ],
  },
  {
    id: 'instagram',
    title: 'Instagram',
    blurb:
      'Profile picture, six feed posts, three stories and a reel cover. Posts share a single composition so the grid reads as one curated archive.',
    assets: [
      { id: 'ig-profile', name: 'Profile picture', description: 'Painted logo inside a gold ring with the wordmark below. Use as the IG / FB / X / LinkedIn profile.', url: `${SOCIAL}/instagram-profile-1080.png`, size: '1080 × 1080', aspect: 'square', framing: 'cover', kind: 'png' },
      { id: 'ig-post-launch', name: 'Feed post — Launch', description: '"The Weaves Return Home." Use at brand launch / store reopening.', url: `${SOCIAL}/instagram-post-launch-1080.jpg`, size: '1080 × 1080', aspect: 'square', framing: 'cover', kind: 'jpg' },
      { id: 'ig-post-banarasi', name: 'Feed post — Banarasi', description: 'Weave Story No. 01. Pin under "Banarasi" highlight.', url: `${SOCIAL}/instagram-post-banarasi-1080.jpg`, size: '1080 × 1080', aspect: 'square', framing: 'cover', kind: 'jpg' },
      { id: 'ig-post-patola', name: 'Feed post — Patola', description: 'Weave Story No. 02. Pin under "Patola" highlight.', url: `${SOCIAL}/instagram-post-patola-1080.jpg`, size: '1080 × 1080', aspect: 'square', framing: 'cover', kind: 'jpg' },
      { id: 'ig-post-quote', name: 'Feed post — Atelier note', description: '"Every metre takes a month." Tone-of-voice carousel opener.', url: `${SOCIAL}/instagram-post-quote-1080.jpg`, size: '1080 × 1080', aspect: 'square', framing: 'cover', kind: 'jpg' },
      { id: 'ig-post-weaver', name: 'Feed post — Behind the loom', description: 'Use to announce a weaver feature.', url: `${SOCIAL}/instagram-post-weaver-1080.jpg`, size: '1080 × 1080', aspect: 'square', framing: 'cover', kind: 'jpg' },
      { id: 'ig-post-sale', name: 'Feed post — Archive sale', description: 'Up to 30% off the last bolts. Use for archive events only.', url: `${SOCIAL}/instagram-post-sale-1080.jpg`, size: '1080 × 1080', aspect: 'square', framing: 'cover', kind: 'jpg' },
      { id: 'ig-story-launch', name: 'Story — Launch', description: 'Vertical launch announcement.', url: `${SOCIAL}/instagram-story-launch-1080x1920.jpg`, size: '1080 × 1920', aspect: 'story', framing: 'cover', kind: 'jpg' },
      { id: 'ig-story-product', name: 'Story — Weave story', description: 'Patola feature for stories.', url: `${SOCIAL}/instagram-story-product-1080x1920.jpg`, size: '1080 × 1920', aspect: 'story', framing: 'cover', kind: 'jpg' },
      { id: 'ig-story-sale', name: 'Story — Archive sale', description: 'Vertical sale promo.', url: `${SOCIAL}/instagram-story-sale-1080x1920.jpg`, size: '1080 × 1920', aspect: 'story', framing: 'cover', kind: 'jpg' },
      { id: 'ig-reel-cover', name: 'Reel cover', description: 'Cover frame for atelier reels.', url: `${SOCIAL}/instagram-reel-cover-1080x1920.jpg`, size: '1080 × 1920', aspect: 'story', framing: 'cover', kind: 'jpg' },
    ],
  },
  {
    id: 'facebook',
    title: 'Facebook',
    blurb: 'Page profile and cover.',
    assets: [
      { id: 'fb-profile', name: 'Page profile', description: 'Square profile, downscaled from the IG profile.', url: `${SOCIAL}/facebook-profile-180.png`, size: '180 × 180', aspect: 'square', framing: 'cover', kind: 'png' },
      { id: 'fb-cover', name: 'Page cover', description: 'Logo + wordmark composition with safe-area margins.', url: `${SOCIAL}/facebook-cover-1640x624.jpg`, size: '1640 × 624', aspect: 'wide', framing: 'cover', kind: 'jpg' },
    ],
  },
  {
    id: 'twitter',
    title: 'X / Twitter',
    blurb: 'Profile and header banner.',
    assets: [
      { id: 'x-profile', name: 'Profile', description: 'Logo on cream with gold ring.', url: `${SOCIAL}/twitter-profile-400.png`, size: '400 × 400', aspect: 'square', framing: 'cover', kind: 'png' },
      { id: 'x-header', name: 'Header banner', description: 'Wide brand banner.', url: `${SOCIAL}/twitter-header-1500x500.jpg`, size: '1500 × 500', aspect: 'wide', framing: 'cover', kind: 'jpg' },
    ],
  },
  {
    id: 'linkedin',
    title: 'LinkedIn',
    blurb: 'Company-page logo and cover banner.',
    assets: [
      { id: 'li-logo', name: 'Company logo', description: 'Square logo, 300px.', url: `${SOCIAL}/linkedin-logo-300.png`, size: '300 × 300', aspect: 'square', framing: 'cover', kind: 'png' },
      { id: 'li-banner', name: 'Page banner', description: 'Company-page cover with safe-area margins.', url: `${SOCIAL}/linkedin-banner-1584x396.jpg`, size: '1584 × 396', aspect: 'wide', framing: 'cover', kind: 'jpg' },
    ],
  },
  {
    id: 'pinterest',
    title: 'Pinterest',
    blurb: 'Tall pin format for boards and rich pins.',
    assets: [
      { id: 'pin', name: 'Standard pin', description: 'Editorial-style pin. Use for the atelier and weave-story boards.', url: `${SOCIAL}/pinterest-pin-1000x1500.jpg`, size: '1000 × 1500', aspect: 'pin', framing: 'cover', kind: 'jpg' },
    ],
  },
  {
    id: 'youtube',
    title: 'YouTube',
    blurb: 'Channel banner with all platforms safe-area accounted for.',
    assets: [
      { id: 'yt-banner', name: 'Channel banner', description: 'Critical art fits inside the 1546 × 423 central safe area.', url: `${SOCIAL}/youtube-banner-2560x1440.jpg`, size: '2560 × 1440', aspect: 'wide', framing: 'cover', kind: 'jpg' },
    ],
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp Business',
    blurb: 'Square profile for the WhatsApp Business catalog.',
    assets: [
      { id: 'wa-profile', name: 'Business profile', description: 'Logo on cream, 640px.', url: `${SOCIAL}/whatsapp-business-640.png`, size: '640 × 640', aspect: 'square', framing: 'cover', kind: 'png' },
    ],
  },
  {
    id: 'print',
    title: 'Print & Stationery',
    blurb:
      'Production-ready SVGs. Edit the {PLACEHOLDER} fields per-piece, then send to print. 0.0625 in bleed already baked into edge-to-edge pieces.',
    assets: [
      { id: 'bc-front', name: 'Business card — front', description: '3.5 × 2 in, bleed included. Wordmark composition.', url: `${PRINT}/business-card-front.svg`, size: '3.5 × 2 in', aspect: 'card', kind: 'svg' },
      { id: 'bc-back', name: 'Business card — back', description: 'Mark + contact block. Replace {NAME} / {TITLE} / {EMAIL} / {PHONE} / {ADDRESS}.', url: `${PRINT}/business-card-back.svg`, size: '3.5 × 2 in', aspect: 'card', kind: 'svg' },
      { id: 'letterhead', name: 'Letterhead', description: 'A4 letterhead with brand block + gold double rule + footer.', url: `${PRINT}/letterhead.svg`, size: 'A4 (210 × 297 mm)', aspect: 'a4', kind: 'svg' },
      { id: 'invoice', name: 'Invoice', description: 'A4 invoice template. Fill {INVOICE_NO} / {CUSTOMER} / line items.', url: `${PRINT}/invoice-template.svg`, size: 'A4', aspect: 'a4', kind: 'svg' },
      { id: 'packing-slip', name: 'Packing slip', description: 'A4 packing slip with shipping address, AWB, line items.', url: `${PRINT}/packing-slip.svg`, size: 'A4', aspect: 'a4', kind: 'svg' },
      { id: 'thank-you', name: 'Thank-you card', description: '5 × 7 in atelier note. Insert in every shipped order.', url: `${PRINT}/thank-you-card.svg`, size: '5 × 7 in', aspect: 'card', kind: 'svg' },
      { id: 'care-card', name: 'Care card', description: '4 × 6 in fabric-care instructions. Dry-clean / no sun / low iron / breathe.', url: `${PRINT}/care-card.svg`, size: '4 × 6 in', aspect: 'card', kind: 'svg' },
      { id: 'hangtag', name: 'Hangtag', description: '2.5 × 4 in fabric hangtag with weave / origin / weaver / price fields.', url: `${PRINT}/hangtag.svg`, size: '2.5 × 4 in', aspect: 'card', kind: 'svg' },
      { id: 'sticker', name: 'Wax-seal sticker', description: '2 in round seal for tissue paper and envelopes.', url: `${PRINT}/sticker-seal.svg`, size: '2 in round', aspect: 'square', kind: 'svg' },
      { id: 'email-sig', name: 'Email signature', description: 'Inline HTML signature for Gmail / Apple Mail / Outlook.', url: `${PRINT}/email-signature.html`, size: 'HTML', aspect: 'wide', kind: 'html' },
    ],
  },
];

export const COLOR_TOKENS: { name: string; hex: string; role: string; css: string }[] = [
  { name: 'brand-bg',        hex: '#F5ECDC', role: 'Primary canvas. Warm cream sampled from the logo paper.', css: '--color-brand-bg' },
  { name: 'brand-bg-soft',   hex: '#FBF5EA', role: 'Secondary canvas / cards / inputs.',                       css: '--color-brand-bg-soft' },
  { name: 'brand-ink',       hex: '#2A1F12', role: 'Primary text and outlines.',                                css: '--color-brand-ink' },
  { name: 'brand-gold',      hex: '#B8893A', role: 'Accents, callouts, numbers, gold details.',                 css: '--color-brand-gold' },
  { name: 'brand-gold-soft', hex: '#D8B97A', role: 'Highlights and gradient stops.',                            css: '--color-brand-gold-soft' },
  { name: 'brand-gold-deep', hex: '#8E6520', role: 'Lower stops in gold gradients, hover states.',              css: '--color-brand-gold-deep' },
  { name: 'brand-accent',    hex: '#EAD9BA', role: 'Soft secondary fills, hover backgrounds.',                  css: '--color-brand-accent' },
];

export const TYPOGRAPHY = {
  serif: {
    family: "'Cormorant Garamond', 'Times New Roman', serif",
    use: 'Headings, wordmark, editorial body. Italic preferred for emotive titles.',
    weights: '300 · 400 · 500 · 600 · 700',
  },
  sans: {
    family: "'Inter', ui-sans-serif, system-ui, sans-serif",
    use: 'UI labels, microcopy, form fields. ALL-CAPS with letter-spacing 0.2em for category labels.',
    weights: '300 · 400 · 500 · 600 · 700',
  },
};

export const VOICE_NOTES = [
  'Curated, restrained, archival. Treat every product like a museum artefact.',
  'Avoid exclamation marks. Avoid superlatives ("amazing", "the best").',
  'Prefer present tense, second person, Indian-English spelling (metre, colour).',
  'Numbers are honoured: "every metre takes a month" beats "we work slowly".',
  'When in doubt, defer to the weaver: name them.',
];
