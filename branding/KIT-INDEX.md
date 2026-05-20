# Tresor Couture — Brand Kit Index

Every asset below is **production-ready** and regenerable.
Run `python3 branding/generate.py` to rebuild rasters from source.

## Quick links

| Surface | File | Size |
| --- | --- | --- |
| Favicon set | `favicons/` | 16 → 512, .ico, .webmanifest |
| OG / link preview | `social/og-default-1200x630.png` | 1200 × 630 |
| Instagram profile | `social/instagram-profile-1080.png` | 1080 × 1080 |
| IG feed posts (6) | `social/instagram-post-*.jpg` | 1080 × 1080 |
| IG / reel stories (4) | `social/instagram-story-*.jpg`, `instagram-reel-cover-*.jpg` | 1080 × 1920 |
| Facebook cover | `social/facebook-cover-1640x624.jpg` | 1640 × 624 |
| Twitter / X header | `social/twitter-header-1500x500.jpg` | 1500 × 500 |
| LinkedIn banner | `social/linkedin-banner-1584x396.jpg` | 1584 × 396 |
| Pinterest pin | `social/pinterest-pin-1000x1500.jpg` | 1000 × 1500 |
| YouTube banner | `social/youtube-banner-2560x1440.jpg` | 2560 × 1440 |
| WhatsApp profile | `social/whatsapp-business-640.png` | 640 × 640 |
| Business card | `print/business-card-front.svg`, `business-card-back.svg` | 3.5 × 2 in |
| Letterhead (A4) | `print/letterhead.svg` | 210 × 297 mm |
| Invoice (A4) | `print/invoice-template.svg` | 210 × 297 mm |
| Packing slip (A4) | `print/packing-slip.svg` | 210 × 297 mm |
| Thank-you card | `print/thank-you-card.svg` | 5 × 7 in |
| Care card | `print/care-card.svg` | 4 × 6 in |
| Hangtag | `print/hangtag.svg` | 2.5 × 4 in |
| Wax-seal sticker | `print/sticker-seal.svg` | 2 in round |
| Email signature | `print/email-signature.html` | inline HTML |

## Where to publish

- **Instagram** — upload `instagram-profile-1080.png` as the profile picture.
  Feed posts: any `instagram-post-*.jpg`. Stories / reels: any `instagram-story-*.jpg` or `instagram-reel-cover-*.jpg`.
- **Facebook** — page profile = `facebook-profile-180.png`; cover photo = `facebook-cover-1640x624.jpg`.
- **X / Twitter** — profile = `twitter-profile-400.png`; header = `twitter-header-1500x500.jpg`.
- **LinkedIn (Company Page)** — logo = `linkedin-logo-300.png`; banner = `linkedin-banner-1584x396.jpg`.
- **Pinterest** — board cover or rich pin = `pinterest-pin-1000x1500.jpg`.
- **YouTube** — channel banner = `youtube-banner-2560x1440.jpg` (safe area is the central 1546 × 423; we kept critical art inside).
- **WhatsApp Business** — profile = `whatsapp-business-640.png`.
- **Browser tab / iOS home screen** — `favicons/` is already wired into `index.html`.
- **Open Graph previews** — `og-default-1200x630.png` is referenced in `index.html` (`og:image`, `twitter:image`).

## Print specs

All print SVGs:

- Are in **mm/inch units** with `viewBox` in pixel space at 300 dpi-equivalent.
- Use a **0.0625 in bleed** on edge-to-edge pieces (business card).
- Embed **gold gradients as `<linearGradient>`** so the printer can swap to spot Pantone (recommended: PMS 871 Gold for foil, PMS 4625 Brown for ink) if budget allows.
- Reference *Cormorant Garamond* and *Inter*. Outline the text in your prepress workflow if the printer doesn't ship those fonts.

Placeholders in CAPS_LIKE_THIS (e.g. `{NAME}`, `{INVOICE_NO}`, `{WEAVE_NAME}`) are meant to be filled in per-piece before print.

## How to edit / regenerate

1. **Recolour or restyle** — edit constants near the top of `branding/generate.py` (`CREAM`, `GOLD`, …) and rerun.
2. **Add a new post** — append to the `POSTS` list. The composition is identical for every post in the set.
3. **Add a new banner size** — call `banner(...)` from `build_banners()`.
4. **Edit a print piece** — open the corresponding `.svg` in `branding/print/` and edit by hand, or change the template strings in `generate.py` and rerun.

Re-running `generate.py` is idempotent and overwrites prior outputs in `branding/favicons/`, `branding/social/`, and mirrors them into `public/branding/` so the site picks them up immediately.
