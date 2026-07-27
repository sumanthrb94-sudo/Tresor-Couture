# 04 — UI/UX Design Brief

> Values here are read from `src/index.css` (CSS custom properties) and
> `tailwind` usage in components. The token names are historical: they are
> prefixed `--color-myntra-*` because the layout pattern started from a
> Myntra-style commerce grid, but **the palette is not Myntra's** — it was
> re-themed to the atelier's champagne-and-cream identity. Don't rename the
> tokens casually; they're referenced across every component.

---

## Aesthetic direction

Warm, heritage-luxury, editorial. Cream and champagne-gold rather than the
white-and-neon of mass-market commerce. Dense, information-rich commerce layouts
(Myntra/Zepto-style cards, sticky mobile bottom nav) wearing a boutique skin —
familiar shopping mechanics, unfamiliar warmth.

**Light-mode only.** There is no dark theme and none is planned; the cream
background is the brand.

## Colour palette

| Token | Value | Role |
|---|---|---|
| `--color-myntra-pink` | `#B8915A` | **Primary CTA** — champagne gold (name is legacy) |
| `--color-myntra-pink-dark` | — | CTA hover/pressed |
| `--color-myntra-navy` | `#2A2520` | Headings, primary text — warm charcoal-brown |
| `--color-myntra-ink` | `#3D362B` | Body text |
| `--color-myntra-ink-soft` | — | Secondary text, labels |
| `--color-myntra-ink-mute` | — | Tertiary / placeholder |
| `--color-myntra-bg` | `#F1E1C3` | Warm cream — matches the logo background |
| `--color-myntra-bg-soft` | — | Page background behind cards |
| `--color-myntra-bg-sale` | — | Sale emphasis |
| `--color-myntra-border` / `-border-soft` | — | Card and divider strokes |
| `--color-myntra-green` / `-green-light` | — | Success, "Delivered" |
| `--color-myntra-orange` / `-yellow` | — | Warning, ratings |

Semantic colours used inline: error `#A12626` on `#FBE6E6`, warning `#9A5B12` on
`#FDF0E1` with `#F0D9B5` border.

## Typography

| | |
|---|---|
| UI / body | `Assistant`, falling back to Whitney → system stack |
| Headings (`--font-display`) | `Manrope`, letter-spacing `-0.01em` |

Sizes are set with Tailwind arbitrary values in `px` (`text-[13px]`,
`text-[15px]`, `text-[20px]`) rather than the default scale — this is deliberate
and consistent; match it rather than introducing `text-sm`/`text-base`.

Recurring treatment: small uppercase labels with wide tracking
(`text-[10px] font-bold uppercase tracking-[0.18em]`) for eyebrows and metadata.

## Component style

- **Sharp-ish corners.** Cards and inputs use small radii (`rounded`, `rounded-md`);
  pills and badges are fully rounded. No large 16px+ radii.
- **Flat with soft borders**, not shadow-heavy. Shadows are reserved for things
  that float: the bottom nav (`0 -2px 10px rgba(0,0,0,0.06)`), the cart FAB,
  and modals (`shadow-2xl`).
- **Utility classes** defined once and reused: `btn-primary`, `btn-outline`,
  `input-box`, `section-eyebrow`. Prefer these over re-styling from scratch.
- Badges: `min-w-[18px] h-[18px]` rounded-full, `text-[10px] font-bold`.

## Layout

- Storefront content: `max-w-[1200px]`; account `max-w-[1100px]`; admin `max-w-[1400px]`.
- Page padding `px-4 md:px-8 lg:px-10`.
- Fixed header — pages compensate with `pt-[100px] md:pt-[112px]`.
- Admin: CSS grid `240px + minmax(0,1fr)`. The `minmax(0,…)` is load-bearing —
  without it wide tables blow out the page instead of scrolling.

## Mobile

Mobile is the primary target; every feature including the admin console must work
on a phone.

- Breakpoint for the mobile/desktop switch is Tailwind `md` (admin) / `lg` (storefront nav).
- **Bottom tab bar** (Home · Shop · Account) with `pb-[env(safe-area-inset-bottom)]`.
- **Cart FAB** anchored at `bottom-[calc(env(safe-area-inset-bottom)+82px)]` so it
  clears both the nav and the home indicator on notched phones.
- Account tabs render as a 5-up grid — every tab visible, no horizontal scrolling.
- Admin sections collapse to a disclosure + 2-column grid (never a clipped
  horizontal scroll strip).
- Modals are bottom-anchored full-width on mobile (`items-end`), centred on desktop.
- **Safe-area insets must be respected** on anything fixed to the bottom.

## Interaction rules

- Any overlay must lock body scroll — use `useBodyScrollLock()`.
- Async actions disable their trigger and show a spinner (see the chat send
  button); never leave a tapped control looking inert.
- Destructive or irreversible actions confirm first (e.g. withdrawing a return).
- Real-time surfaces show unread counts on both sides rather than requiring a
  refresh.
- Optimistic-ish text inputs restore their content on failure (chat send
  restores the message if the throttle rejects it).

## Accessibility

- Every icon-only control carries an `aria-label`.
- Badged controls describe their state (`aria-label="Chat — 2 new replies"`),
  which is why tests match `/^chat\b/i` rather than an exact string.
- Disclosures set `aria-expanded` / `aria-controls`; loading regions set
  `aria-busy` / `aria-live`.
- Active nav items set `aria-current="page"`.
- Status is never conveyed by colour alone — badges carry numbers, statuses
  carry words.

## Reference points

Myntra / Zepto for commerce density and mobile navigation mechanics; heritage
textile lookbooks for the palette and typography.
