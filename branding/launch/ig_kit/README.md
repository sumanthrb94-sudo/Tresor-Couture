# Tresor Couture — Instagram Kit

50 ready-to-publish assets for `@tresor.couture`. Built from the boutique
script bank, rewritten in the Tresor museum-archival voice (no emojis, no
exclamations, present tense, Indian-English spelling).

## What's inside

| Folder      | Count | Format                | Use                                  |
| ----------- | ----- | --------------------- | ------------------------------------ |
| `videos/`   | 20    | 1080×1920 MP4, 8 sec, no audio, H.264 | Instagram Reels, Facebook Reels, Stories |
| `posts/`    | 30    | 1080×1350 JPG portrait, sRGB           | Instagram feed posts, Facebook posts     |
| `captions.csv` | 50 | UTF-8 CSV             | Pre-written captions + hashtags per asset |

All videos are silent — drop a brand-safe royalty-free track in the Meta
composer at upload time, or post as-is for ambient feed scrolling.

## Naming convention

```
videos/TresorCouture_Reel_<slug>_1080x1920.mp4
posts/TresorCouture_Post_<slug>_1080x1350.jpg
```

The `<slug>` matches the source script number (e.g. `01-new-arrival`, `85-seventy-twenty-ten`)
so you can cross-reference back to the 100-script bank.

## Posting cadence (suggestion)

- **Mon / Wed / Fri** — one feed post + one Reel
- **Tue / Thu**       — one feed post
- **Sat**             — one Reel
- **Sun**             — story-only (use the assets as story slides too — they fit 9:16)

At 1 post + 1 reel per active day, this kit covers roughly **five weeks** of
content with zero overlap.

## Re-running / extending

```
cd branding/launch/ig_kit

# Render one item:
python3 render.py video 0       # first video spec
python3 render.py post 0        # first post spec

# Render everything:
python3 render.py all

# Rebuild the caption CSV:
python3 build_caption_pack.py
```

Edit `specs.py` to swap copy, change categories, or add new pieces — the
renderer reads the list, so new entries are picked up automatically.

## Brand fidelity

- **Palette**: warm cream `#F5ECDC`, ink `#2A1F12`, gold `#B8893A`. From `branding/palette.json`.
- **Typography**: Cormorant Garamond (italic headlines) + Inter (eyebrows, CTA, handle). From `branding/_fonts/`.
- **End card**: painted glow artwork (`endcard_image_1080x1920.png`) appears as the final 2.5 seconds of every Reel.
- **Monogram lockup**: the master TC + figure (`master-logo-filled.png`) is the visual anchor of every post.

Tone follows `branding/BRAND.md`: "Curated, restrained, archival. Treat every
piece like a museum artefact. Avoid exclamation marks."
