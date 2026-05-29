#!/usr/bin/env python3
"""
Tresor Couture — vertical Instagram reel posters, 4K (2160 x 3840).

Cream "website-flow" background (matches palette.json brand-bg), TC mark
emblem at the top, huge italic Cormorant headline as the focal point, and
the wordmark + URL anchored at the bottom. Generates a 3-slide carousel:

    Launching Soon  →  Opening Soon  →  Coming Soon

Run from repo root:
    python3 branding/launch/generate_reel_posters.py

Every text element is placed using textbbox measurements so adjacent
elements keep guaranteed vertical breathing room — no overlap regardless
of the headline's character set.

Outputs land in branding/launch/reel/.
"""

from __future__ import annotations
from pathlib import Path
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "_fonts"
OUT = ROOT / "launch" / "reel"
OUT.mkdir(parents=True, exist_ok=True)

# Brand palette (sampled from palette.json — website background flow)
CREAM       = (245, 236, 220)
CREAM_SOFT  = (251, 245, 234)
INK         = (42, 31, 18)
INK_SOFT    = (70, 56, 38)
GOLD        = (184, 137, 58)
GOLD_SOFT   = (216, 185, 122)
GOLD_DEEP   = (142, 101, 32)
ACCENT      = (234, 217, 186)

# Vertical 4K — 9:16 at 2160×3840 (exactly 2× IG reel 1080×1920).
W, H = 2160, 3840
SAFE_X = 200  # left/right safe inset for text


def cormorant(size: int, weight: str = "Regular") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / f"Cormorant-{weight}.ttf"), size)


def inter(size: int, weight: str = "Regular") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / f"Inter-{weight}.ttf"), size)


def reel_canvas() -> Image.Image:
    """Pure cream canvas with a soft vertical lift (cream-soft top → cream
    bottom) + a very low-amplitude paper grain. No radial glow — the mark
    sits flush against the website-flow cream."""
    base = np.zeros((H, W, 3), dtype=np.float32)
    for y in range(H):
        t = y / (H - 1)
        for ch, (a, b) in enumerate(zip(CREAM_SOFT, CREAM)):
            base[y, :, ch] = a * (1 - t) + b * t

    rng = np.random.default_rng(13)
    noise = rng.integers(-3, 4, size=base.shape, dtype=np.int16)
    arr = np.clip(base.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB").convert("RGBA")


def hairline_frame(canvas: Image.Image) -> None:
    """Very thin gold inset border — the 'engraved card' feel."""
    d = ImageDraw.Draw(canvas)
    inset = 90
    d.rectangle([inset, inset, W - inset, H - inset], outline=GOLD_SOFT, width=3)


def gold_ornament(canvas: Image.Image, y: int, span: int = 520) -> int:
    """Centred gold hairline + diamond pip + flanking dots.
    Returns the bottom y of the ornament so the next element can stack."""
    d = ImageDraw.Draw(canvas)
    cx = W // 2
    half = span // 2
    line_y = y + 8
    d.line([(cx - half, line_y), (cx - 30, line_y)], fill=GOLD, width=3)
    d.line([(cx + 30, line_y), (cx + half, line_y)], fill=GOLD, width=3)
    pip = 12
    d.polygon([(cx, line_y - pip), (cx + pip, line_y),
               (cx, line_y + pip), (cx - pip, line_y)], fill=GOLD)
    # flanking dots at the ends
    dot = 6
    for sign in (-1, +1):
        d.ellipse([cx + sign * half - dot, line_y - dot,
                   cx + sign * half + dot, line_y + dot], fill=GOLD)
    return line_y + pip + 8


def paste_mark(canvas: Image.Image, target_height: int, top_y: int) -> int:
    """Drop the bare TC mark (no wordmark) at top_y, centred horizontally.
    No halo — the source PNG is fully alpha-transparent (corners 255,255,255,0),
    so the mark blends straight into the cream canvas with no visible patch.
    Returns the bottom y of the mark so subsequent elements can stack."""
    src = Image.open(ROOT / "mark-master.png").convert("RGBA")
    ratio = target_height / src.height
    new_w = int(src.width * ratio)
    mark = src.resize((new_w, target_height), Image.LANCZOS)
    mx = (W - new_w) // 2
    canvas.alpha_composite(mark, (mx, top_y))
    return top_y + target_height


def centred_text(canvas: Image.Image, y: int, text: str,
                 font: ImageFont.FreeTypeFont, fill) -> tuple[int, int]:
    """Draw centred text at baseline y_top. Returns (drawn_top, drawn_bottom)
    derived from textbbox so callers can stack without overlap."""
    d = ImageDraw.Draw(canvas)
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    # Anchor so visible top of glyphs aligns at y (use bbox top offset)
    x = (W - tw) // 2 - bbox[0]
    y_draw = y - bbox[1]
    d.text((x, y_draw), text, font=font, fill=fill)
    drawn_top = y
    drawn_bottom = y + (bbox[3] - bbox[1])
    return drawn_top, drawn_bottom


def centred_spaced(canvas: Image.Image, y: int, text: str,
                   font: ImageFont.FreeTypeFont, fill,
                   tracking_em: float = 0.4) -> tuple[int, int]:
    """Letter-spaced caps. Draws char-by-char with extra advance.
    tracking_em is the gap as a fraction of font size."""
    d = ImageDraw.Draw(canvas)
    gap = int(font.size * tracking_em)
    widths = [d.textbbox((0, 0), c, font=font) for c in text]
    char_widths = [(bb[2] - bb[0]) for bb in widths]
    total = sum(char_widths) + gap * (len(text) - 1)
    # Vertical alignment: use uppercase-A bbox as the reference baseline.
    ref = d.textbbox((0, 0), "A", font=font)
    y_draw = y - ref[1]
    x = (W - total) // 2
    for c, cw in zip(text, char_widths):
        d.text((x, y_draw), c, font=font, fill=fill)
        x += cw + gap
    return y, y + (ref[3] - ref[1])


def draw_wordmark_block(canvas: Image.Image, y: int) -> tuple[int, int]:
    """The TRESOR / COUTURE lockup. Returns (top, bottom)."""
    d = ImageDraw.Draw(canvas)
    tres_font = cormorant(140, "Medium")
    cout_font = inter(46, "SemiBold")

    _, tres_bottom = centred_spaced(canvas, y, "TRESOR", tres_font, INK, tracking_em=0.42)
    cy = tres_bottom + 60

    # gold rule + COUTURE + gold rule, vertically aligned to cap-height of COUTURE
    cout = "COUTURE"
    gap_letters = int(cout_font.size * 0.55)
    chws = [d.textbbox((0, 0), c, font=cout_font) for c in cout]
    char_widths = [(bb[2] - bb[0]) for bb in chws]
    cout_total = sum(char_widths) + gap_letters * (len(cout) - 1)

    rule_len = 220
    side_gap = 60
    cx = W // 2
    rule_y = cy + int(cout_font.size * 0.5)
    d.line([(cx - cout_total / 2 - side_gap - rule_len, rule_y),
            (cx - cout_total / 2 - side_gap, rule_y)], fill=GOLD, width=4)
    d.line([(cx + cout_total / 2 + side_gap, rule_y),
            (cx + cout_total / 2 + side_gap + rule_len, rule_y)], fill=GOLD, width=4)

    _, cout_bottom = centred_spaced(canvas, cy, cout, cout_font, GOLD_DEEP, tracking_em=0.55)
    return y, cout_bottom


def draw_url(canvas: Image.Image, y: int, text: str) -> tuple[int, int]:
    f = inter(48, "Regular")
    return centred_spaced(canvas, y, text, f, GOLD_DEEP, tracking_em=0.18)


def build_poster(eyebrow: str, headline: str, url: str, out_name: str) -> Path:
    canvas = reel_canvas()
    hairline_frame(canvas)

    # ---- TOP: TC mark ----
    mark_top = 320
    mark_bottom = paste_mark(canvas, target_height=900, top_y=mark_top)

    # ---- ornament under mark ----
    orn1_bottom = gold_ornament(canvas, y=mark_bottom + 90, span=620)

    # ---- eyebrow ----
    eb_font = inter(50, "Medium")
    eb_top = orn1_bottom + 110
    _, eb_bottom = centred_spaced(canvas, eb_top, eyebrow, eb_font, GOLD_DEEP, tracking_em=0.45)

    # ---- HEADLINE (focal point) ----
    head_font = cormorant(440, "Italic")
    # measure to confirm it fits the safe width; downscale if not
    d_probe = ImageDraw.Draw(canvas)
    while head_font.size > 200:
        bbox = d_probe.textbbox((0, 0), headline, font=head_font)
        if bbox[2] - bbox[0] <= W - 2 * SAFE_X:
            break
        head_font = cormorant(head_font.size - 20, "Italic")

    headline_top = eb_bottom + 140
    _, headline_bottom = centred_text(canvas, headline_top, headline, head_font, INK)

    # ---- second ornament under headline ----
    orn2_top = headline_bottom + 140
    orn2_bottom = gold_ornament(canvas, y=orn2_top, span=620)

    # ---- BOTTOM: wordmark + URL anchored upward from canvas bottom ----
    url_baseline = H - 320
    _, url_bottom = draw_url(canvas, y=url_baseline, text=url)

    wordmark_top = url_baseline - 360   # reserve ~360 px for the lockup
    _, wm_bottom = draw_wordmark_block(canvas, y=wordmark_top)

    # ---- assert no overlap (defensive) ----
    if orn2_bottom > wordmark_top - 40:
        raise RuntimeError(
            f"layout collision in {out_name}: headline ornament ends at {orn2_bottom} "
            f"but wordmark begins at {wordmark_top}"
        )

    out_path = OUT / out_name
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)
    return out_path


def main() -> None:
    variants = [
        ("AN ATELIER IN THE MAKING", "Launching Soon", "tresorcouture.in",
         "TresorCouture_Reel_LaunchingSoon_2160x3840.png"),
        ("DOORS ABOUT TO OPEN",      "Opening Soon",   "tresorcouture.in",
         "TresorCouture_Reel_OpeningSoon_2160x3840.png"),
        ("A QUIET ANNOUNCEMENT",     "Coming Soon",    "tresorcouture.in",
         "TresorCouture_Reel_ComingSoon_2160x3840.png"),
    ]
    for eyebrow, headline, footer, name in variants:
        path = build_poster(eyebrow, headline, footer, name)
        print(f"  wrote {path.relative_to(ROOT.parent)}  ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
