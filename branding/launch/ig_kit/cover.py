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
    # Style A — Cream background, ink headline. The "editorial poster"
    # look. Calm, premium, lots of negative space. Best when the
    # follower base is the right audience already.
    "A-cream-editorial": dict(
        bg="cream",
        eyebrow="A SINGLE PIECE",
        hook="The dress\nthat earns\nthe question.",
        sub="Hand-cut · Limited · Tresor Couture",
    ),
    # Style B — Ink background, cream headline. Dramatic, high-contrast,
    # designed to win the IG explore tab where cream covers blend into
    # the feed. The pattern-interrupt option.
    "B-ink-dramatic": dict(
        bg="ink",
        eyebrow="THE ARCHIVE",
        hook="A new piece,\nquietly\narrived.",
        sub="Handpicked. Unrepeatable.",
    ),
    # Style C — Gold-deep washed cream, italic question hook. Designed
    # to spark curiosity → tap. The clickbait-but-tasteful option.
    "C-question-curiosity": dict(
        bg="cream-warm",
        eyebrow="STYLING NOTE",
        hook="What makes\na boutique\npiece worth it?",
        sub="The four-point test, inside.",
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


def build_cover(slug: str) -> Image.Image:
    spec = PRESETS[slug]
    is_ink = spec["bg"] == "ink"

    # Background
    if spec["bg"] == "cream":
        img = gradient_bg((VIDEO_W, VIDEO_H))
    elif spec["bg"] == "cream-warm":
        img = warm_cream_bg((VIDEO_W, VIDEO_H))
    else:
        img = ink_bg((VIDEO_W, VIDEO_H))

    draw = ImageDraw.Draw(img)
    ink_color  = (250, 235, 197) if is_ink else BRAND_INK
    gold_color = BRAND_GOLD_SOFT if is_ink else BRAND_GOLD

    # Brand mark — top, sized so the headline owns the centre 1080x1080
    paste_monogram(img, top_y=170, target_h=300)

    # Eyebrow label
    cat_fnt = font("sans-semi", 28)
    draw_tracked(draw, spec["eyebrow"], cat_fnt, gold_color, cy=580,
                 canvas_w=VIDEO_W, track=8)

    # Gold accent rule
    rule_y = 680
    if is_ink:
        # white-gold rule on dark
        draw.line([(VIDEO_W // 2 - 130, rule_y), (VIDEO_W // 2 + 130, rule_y)],
                  fill=BRAND_GOLD_SOFT, width=2)
        s = 7
        draw.polygon([(VIDEO_W // 2, rule_y - s), (VIDEO_W // 2 + s, rule_y),
                      (VIDEO_W // 2, rule_y + s), (VIDEO_W // 2 - s, rule_y)],
                     fill=BRAND_GOLD_SOFT)
    else:
        gold_rule(img, VIDEO_W // 2, rule_y, width=260)

    # THE HOOK — bold serif, large
    hook_fnt = font("serif-bold", 124)
    lines = spec["hook"].split("\n")
    draw_text_block(img, lines, hook_fnt, ink_color, top=760, line_gap=1.04)

    # Sub-line — sans-medium, smaller, sat under the headline
    sub_fnt = font("sans-medium", 28)
    sub_w = draw.textlength(spec["sub"], font=sub_fnt)
    draw.text(((VIDEO_W - sub_w) / 2, VIDEO_H - 320),
              spec["sub"], font=sub_fnt,
              fill=(217, 176, 112) if is_ink else (107, 99, 88))

    # Handle, bottom
    h_fnt = font("sans-semi", 30)
    handle = "@tresor.couture"
    hw = draw.textlength(handle, font=h_fnt)
    draw.text(((VIDEO_W - hw) / 2, VIDEO_H - 160),
              handle, font=h_fnt,
              fill=(250, 235, 197) if is_ink else BRAND_INK)

    return img


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
