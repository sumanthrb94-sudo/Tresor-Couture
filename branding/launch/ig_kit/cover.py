"""
Tresor Couture — IG Reels cover generator.

Produces 1080×1920 thumbnail/cover images optimised for scroll-stop
conversion on Instagram Reels. The cover is what IG shows in:
  - the Reels tab (full 9:16)
  - the profile grid (center-cropped to 4:5 ≈ 1080×1350)
  - the Explore tab (varies)

Design rules baked in:
  - Critical content sits in the central 1080×1080 zone so it survives
    every crop IG applies
  - Bold serif headline at a size that reads on a 5" phone scrolling
    fast (the "thumb stop" test)
  - Mark-master.png (transparent, no wordmark) as the brand anchor
  - Cream-on-ink high contrast or ink-on-cream for maximum scroll
    pop — both options included
  - Single decorative gold rule, no clutter

Usage:
    python cover.py <slug>
        Slug controls which preset hook + style combo is rendered.
        See PRESETS below.

Outputs: covers/TresorCouture_Cover_<slug>_1080x1920.jpg
"""

from __future__ import annotations
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

from render import (
    BRAND_BG, BRAND_BG_SOFT, BRAND_INK, BRAND_GOLD, BRAND_GOLD_SOFT,
    BRAND_GOLD_DEEP, BRAND_ACCENT, LOGO_PATH, font, wrap_centered,
    draw_text_block, gradient_bg, gold_rule, paste_monogram,
    VIDEO_W, VIDEO_H,
)

OUT = Path(__file__).resolve().parent / "covers"
OUT.mkdir(exist_ok=True)


# ---------------------------------------------------------------------------
# Three cover presets — each one tests a different hook-conversion angle
# ---------------------------------------------------------------------------

PRESETS = {
    # ─────────────────────────────────────────────────────────────────
    # STARTING covers (kind="start") — the scroll-stop thumbnail. This
    # is what IG uses as the Reel cover in the feed / grid / explore.
    # Optimised for thumb-stop conversion: bold serif hook in the
    # central 1080×1080 crop-safe zone.
    # ─────────────────────────────────────────────────────────────────
    "A-cream-editorial": dict(
        kind="start", bg="cream",
        eyebrow="A SINGLE PIECE",
        hook="The dress\nthat earns\nthe question.",
        sub="Hand-cut · Limited · Tresor Couture",
    ),
    "B-ink-dramatic": dict(
        kind="start", bg="ink",
        eyebrow="THE ARCHIVE",
        hook="A new piece,\nquietly\narrived.",
        sub="Handpicked. Unrepeatable.",
    ),
    "C-question-curiosity": dict(
        kind="start", bg="cream-warm",
        eyebrow="STYLING NOTE",
        hook="What makes\na boutique\npiece worth it?",
        sub="The four-point test, inside.",
    ),

    # ─────────────────────────────────────────────────────────────────
    # ENDING covers (kind="end") — the static "after the Reel loops"
    # frame. Drives the follow conversion. Three CTA flavours so the
    # account can rotate them as last-frame stickers in the IG
    # composer.
    # ─────────────────────────────────────────────────────────────────
    "End-A-follow-cream": dict(
        kind="end", bg="cream",
        cta="FOLLOW @TRESOR.COUTURE",
        sub="ONE PIECE A DAY  ·  HAND-CUT IN INDIA",
    ),
    "End-B-follow-ink": dict(
        kind="end", bg="ink",
        cta="FOLLOW @TRESOR.COUTURE",
        sub="ONE PIECE A DAY  ·  HAND-CUT IN INDIA",
    ),
    "End-C-tomorrow": dict(
        kind="end", bg="cream-warm",
        cta="MORE TOMORROW",
        sub="FOLLOW @TRESOR.COUTURE FOR FIRST LOOKS",
    ),
}


def warm_cream_bg(size: tuple[int, int]) -> Image.Image:
    """Cream with a touch more gold warmth than the default gradient."""
    img = gradient_bg(size)
    wash = Image.new("RGB", size, BRAND_ACCENT)
    img = Image.blend(img, wash, 0.18)
    return img


def ink_bg(size: tuple[int, int]) -> Image.Image:
    """Deep warm ink with a soft gold vignette at top."""
    w, h = size
    img = Image.new("RGB", size, (24, 16, 8))  # near-black warm
    # Soft gold radial top
    halo = Image.new("L", size, 0)
    hd = ImageDraw.Draw(halo)
    hd.ellipse([w // 2 - 600, -300, w // 2 + 600, 700], fill=80)
    halo = halo.filter(ImageFilter.GaussianBlur(radius=160))
    gold_layer = Image.new("RGB", size, BRAND_GOLD_DEEP)
    img = Image.composite(gold_layer, img, halo)
    return img


def draw_tracked(draw: ImageDraw.ImageDraw, text: str, fnt, fill, cy: int,
                 canvas_w: int, track: int = 7) -> int:
    """Centered, letter-tracked uppercase text. Returns baseline y."""
    chars = list(text)
    widths = [draw.textlength(c, font=fnt) for c in chars]
    total = sum(widths) + track * (len(chars) - 1)
    x = (canvas_w - total) / 2
    for c, w in zip(chars, widths):
        draw.text((x, cy), c, font=fnt, fill=fill)
        x += w + track
    return cy + fnt.size


def _make_bg(kind_bg: str) -> Image.Image:
    if kind_bg == "cream":      return gradient_bg((VIDEO_W, VIDEO_H))
    if kind_bg == "cream-warm": return warm_cream_bg((VIDEO_W, VIDEO_H))
    return ink_bg((VIDEO_W, VIDEO_H))


def build_starting_cover(spec: dict) -> Image.Image:
    is_ink = spec["bg"] == "ink"
    img = _make_bg(spec["bg"])
    draw = ImageDraw.Draw(img)

    ink_color  = (250, 235, 197) if is_ink else BRAND_INK
    gold_color = BRAND_GOLD_SOFT if is_ink else BRAND_GOLD

    paste_monogram(img, top_y=170, target_h=300)

    cat_fnt = font("sans-semi", 28)
    draw_tracked(draw, spec["eyebrow"], cat_fnt, gold_color, cy=580,
                 canvas_w=VIDEO_W, track=8)

    rule_y = 680
    if is_ink:
        draw.line([(VIDEO_W // 2 - 130, rule_y), (VIDEO_W // 2 + 130, rule_y)],
                  fill=BRAND_GOLD_SOFT, width=2)
        s = 7
        draw.polygon([(VIDEO_W // 2, rule_y - s), (VIDEO_W // 2 + s, rule_y),
                      (VIDEO_W // 2, rule_y + s), (VIDEO_W // 2 - s, rule_y)],
                     fill=BRAND_GOLD_SOFT)
    else:
        gold_rule(img, VIDEO_W // 2, rule_y, width=260)

    hook_fnt = font("serif-bold", 124)
    lines = spec["hook"].split("\n")
    draw_text_block(img, lines, hook_fnt, ink_color, top=760, line_gap=1.04)

    sub_fnt = font("sans-medium", 28)
    sub_w = draw.textlength(spec["sub"], font=sub_fnt)
    draw.text(((VIDEO_W - sub_w) / 2, VIDEO_H - 320),
              spec["sub"], font=sub_fnt,
              fill=(217, 176, 112) if is_ink else (107, 99, 88))

    h_fnt = font("sans-semi", 30)
    handle = "@tresor.couture"
    hw = draw.textlength(handle, font=h_fnt)
    draw.text(((VIDEO_W - hw) / 2, VIDEO_H - 160),
              handle, font=h_fnt,
              fill=(250, 235, 197) if is_ink else BRAND_INK)

    return img


def build_ending_cover(spec: dict) -> Image.Image:
    """Sister-frame to the video outro. Mark + wordmark + CTA pill +
    tagline + handle. Static JPG for "what stays after the Reel loops"
    placement OR as a profile-grid sign-off post."""
    is_ink = spec["bg"] == "ink"
    img = _make_bg(spec["bg"])
    draw = ImageDraw.Draw(img)

    ink_color  = (250, 235, 197) if is_ink else BRAND_INK
    gold_color = BRAND_GOLD_SOFT if is_ink else BRAND_GOLD
    pill_bg    = (250, 235, 197) if is_ink else BRAND_INK
    pill_text  = BRAND_INK if is_ink else (250, 235, 197)

    # Mark — large, central
    paste_monogram(img, top_y=320, target_h=520)

    # Wordmark
    wm_fnt = font("serif-semi", 84)
    wm_text = "TRESOR  ·  COUTURE"
    wm_w = draw.textlength(wm_text, font=wm_fnt)
    draw.text(((VIDEO_W - wm_w) / 2, 900), wm_text, font=wm_fnt, fill=ink_color)

    # Gold rule
    rule_y = 1030
    if is_ink:
        draw.line([(VIDEO_W // 2 - 120, rule_y), (VIDEO_W // 2 + 120, rule_y)],
                  fill=BRAND_GOLD_SOFT, width=2)
        s = 7
        draw.polygon([(VIDEO_W // 2, rule_y - s), (VIDEO_W // 2 + s, rule_y),
                      (VIDEO_W // 2, rule_y + s), (VIDEO_W // 2 - s, rule_y)],
                     fill=BRAND_GOLD_SOFT)
    else:
        gold_rule(img, VIDEO_W // 2, rule_y, width=240)

    # Sub / tagline
    sub_fnt = font("sans-medium", 26)
    draw_tracked(draw, spec["sub"], sub_fnt, gold_color, cy=1100,
                 canvas_w=VIDEO_W, track=5)

    # CTA pill
    cta_fnt = font("sans-bold", 44)
    cta_text = spec["cta"]
    chars = list(cta_text)
    widths = [draw.textlength(c, font=cta_fnt) for c in chars]
    track = 7
    total = sum(widths) + track * (len(chars) - 1)
    pad_x, pad_y = 60, 30
    pill_w = int(total + pad_x * 2)
    pill_h = 44 + pad_y * 2
    pill_x = (VIDEO_W - pill_w) // 2
    pill_y = 1320
    draw.rounded_rectangle(
        [pill_x, pill_y, pill_x + pill_w, pill_y + pill_h],
        radius=pill_h // 2, fill=pill_bg,
    )
    cx_in = pill_x + pad_x
    cy_in = pill_y + pad_y - 6
    for c, w in zip(chars, widths):
        draw.text((cx_in, cy_in), c, font=cta_fnt, fill=pill_text)
        cx_in += w + track

    # Handle
    h_fnt = font("sans-bold", 40)
    handle = "@TRESOR.COUTURE"
    chars = list(handle)
    widths = [draw.textlength(c, font=h_fnt) for c in chars]
    track = 6
    total = sum(widths) + track * (len(chars) - 1)
    x = (VIDEO_W - total) / 2
    cy = VIDEO_H - 220
    for c, w in zip(chars, widths):
        draw.text((x, cy), c, font=h_fnt, fill=ink_color)
        x += w + track

    # Site domain
    site_fnt = font("sans-medium", 24)
    site_text = "tresorcouture.in"
    sw = draw.textlength(site_text, font=site_fnt)
    draw.text(((VIDEO_W - sw) / 2, VIDEO_H - 145),
              site_text, font=site_fnt,
              fill=BRAND_GOLD_SOFT if is_ink else BRAND_GOLD_DEEP)

    return img


def build_cover(slug: str) -> Image.Image:
    spec = PRESETS[slug]
    if spec.get("kind") == "end":
        return build_ending_cover(spec)
    return build_starting_cover(spec)


def main():
    if len(sys.argv) < 2 or sys.argv[1] == "all":
        for slug in PRESETS:
            img = build_cover(slug)
            out = OUT / f"TresorCouture_Cover_{slug}_1080x1920.jpg"
            img.save(out, quality=94, optimize=True)
            print(f"COVER ok: {out.name}")
    else:
        slug = sys.argv[1]
        if slug not in PRESETS:
            print(f"unknown preset: {slug}. options: {list(PRESETS)}",
                  file=sys.stderr)
            sys.exit(2)
        img = build_cover(slug)
        out = OUT / f"TresorCouture_Cover_{slug}_1080x1920.jpg"
        img.save(out, quality=94, optimize=True)
        print(f"COVER ok: {out.name}")


if __name__ == "__main__":
    main()
