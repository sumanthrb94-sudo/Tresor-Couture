# Trésor Couture — Brand Kit

Single source of truth for the Trésor Couture identity. Drop new assets here; the website reads them via `/public/branding/*` and `palette.json`.

## Logo

| File | Use |
| --- | --- |
| `monogram.svg` | Square hero monogram with floral flourish + wordmark. Use on splash, OG, packing slip cover. |
| `horizontal.svg` | Horizontal lockup (mark + wordmark). Use in headers, email signature, invoice. |
| `wordmark.svg` | Wordmark only. Use when a mark is already nearby. |
| `mark.svg` | Compact TC mark. Use for favicon, app icon, watermark. |
| `logo.jpg` _(in `/public/`)_ | Founder's illustrated logo. **Has a cream paper background — only use over `brand-bg` (`#F5ECDC`) and apply `mix-blend-mode: multiply` if placed on a different surface.** |

The four SVG files have transparent backgrounds and use a gold gradient (`#D8B97A → #B8893A → #8E6520`). They will blend correctly on any background.

### Clear space

Maintain minimum padding equal to the cap-height of the **T** on every side.

### Colour variants

The SVGs are gold by default. To recolour:

1. Find the `<linearGradient id="…">` near the top.
2. Replace stops with the desired colour. Common alternates:
   - **Ink** (single-tone dark): all stops `#2A1F12`.
   - **Cream** (knockout on dark backgrounds): all stops `#F5ECDC`.

## Colour palette

Tokens live in `palette.json` and are wired into Tailwind via `src/index.css` (`@theme`). The five core values:

| Token | Value | Role |
| --- | --- | --- |
| `brand-bg` | `#F5ECDC` | Primary canvas |
| `brand-ink` | `#2A1F12` | Text, outlines |
| `brand-gold` | `#B8893A` | Accents, callouts |
| `brand-gold-soft` | `#D8B97A` | Highlights, gradient stops |
| `brand-accent` | `#EAD9BA` | Soft fills, hover backgrounds |

Always sample from `palette.json` rather than hard-coding hex values in code.

## Typography

- **Serif** — *Cormorant Garamond.* Headings, wordmark, editorial body. Italic preferred for emotive titles.
- **Sans** — *Inter.* UI labels, microcopy, form fields. ALL-CAPS with `letter-spacing: 0.2em` for category labels.

Loaded from Google Fonts in `src/index.css`.

## Tone

Curated, restrained, archival. Treat every product like a museum artefact. Avoid exclamation marks. Prefer present tense, second person, and Indian-English spelling.
