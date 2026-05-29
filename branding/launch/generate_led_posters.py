#!/usr/bin/env python3
"""
Tresor Couture — LED sign-board posters.

Generates "Launching Soon", "Opening Soon", "Coming Soon" at 1920x1080
for indoor/outdoor LED panels. Dark ink background for high-contrast LED
visibility; gold + cream accents; the master TC monogram as the focal point.

Run from repo root:
    python3 branding/launch/generate_led_posters.py

Outputs land in branding/launch/led/.
"""

from __future__ import annotations
from pathlib import Path
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "_fonts"
OUT = ROOT / "launch" / "led"
OUT.mkdir(parents=True, exist_ok=True)

# Brand palette (sampled from palette.json)
INK         = (42, 31, 18)        # primary deep brown — LED background
INK_DEEPER  = (22, 16, 10)        # vignette edge
CREAM       = (245, 236, 220)     # primary cream — wordmark
CREAM_SOFT  = (251, 245, 234)
GOLD        = (184, 137, 58)
GOLD_SOFT   = (216, 185, 122)
GOLD_DEEP   = (142, 101, 32)

W, H = 1920, 1080

def cormorant(size: int, weight: str = "Regular") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / f"Cormorant-{weight}.ttf"), size)

def inter(size: int, weight: str = "Regular") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / f"Inter-{weight}.ttf"), size)


def ink_canvas() -> Image.Image:
    """Deep ink canvas with a soft radial vignette so the centre lifts."""
    arr = np.zeros((H, W, 3), dtype=np.uint8)
    cx, cy = W / 2, H / 2
    max_r = math.hypot(cx, cy)
    yy, xx = np.indices((H, W))
    r = np.hypot(xx - cx, yy - cy) / max_r  # 0 at centre, ~1 at corners
    # interpolate INK (centre) → INK_DEEPER (edges)
    for ch, (a, b) in enumerate(zip(INK, INK_DEEPER)):
        arr[..., ch] = (a * (1 - r) + b * r).astype(np.uint8)
    # subtle film grain so it doesn't band on LED
    rng = np.random.default_rng(11)
    noise = rng.integers(-3, 4, size=arr.shape, dtype=np.int16)
    arr = np.clip(arr.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def gold_divider(im: Image.Image, x: int, y: int, length: int, thickness: int = 2) -> None:
    """A short horizontal gold rule, with a single diamond pip centred on it
    — echoes the wordmark's `--- COUTURE ---` style."""
    d = ImageDraw.Draw(im)
    half = length // 2
    d.line([(x - half, y), (x + half, y)], fill=GOLD, width=thickness)
    # diamond pip in the middle
    pip = 6
    d.polygon([(x, y - pip), (x + pip, y), (x, y + pip), (x - pip, y)], fill=GOLD)


def paste_monogram(canvas: Image.Image, target_height: int, center_y: int) -> None:
    """Drop the master TC mark (bare, no wordmark) in the top half.
    The source art is already gold-on-cream — we just composite it onto
    the dark ink background, with a soft warm glow behind it for LED lift."""
    src = Image.open(ROOT / "mark-master.png").convert("RGBA")
    ratio = target_height / src.height
    new_w = int(src.width * ratio)
    monogram = src.resize((new_w, target_height), Image.LANCZOS)

    # soft warm glow behind the mark so the gold strokes lift off the ink
    glow = Image.new("RGBA", (new_w + 240, target_height + 240), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([0, 0, glow.width, glow.height], fill=GOLD + (38,))
    glow = glow.filter(ImageFilter.GaussianBlur(80))
    gx = (W - glow.width) // 2
    gy = center_y - glow.height // 2
    canvas.alpha_composite(glow, (gx, gy))

    mx = (W - new_w) // 2
    my = center_y - target_height // 2
    canvas.alpha_composite(monogram, (mx, my))


def draw_headline(canvas: Image.Image, eyebrow: str, headline: str, y_center: int) -> None:
    """Eyebrow (spaced sans) on top, big italic Cormorant headline below."""
    d = ImageDraw.Draw(canvas)
    eb_font = inter(28, "Medium")
    # letter-spacing trick: draw char-by-char with extra advance
    eb_text = "  ".join(list(eyebrow))  # double-space between letters
    ew = d.textlength(eb_text, font=eb_font)
    d.text(((W - ew) / 2, y_center - 110), eb_text, font=eb_font, fill=GOLD_SOFT)

    head_font = cormorant(168, "Light")
    hw = d.textlength(headline, font=head_font)
    # subtle drop-glow for LED legibility
    glow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_layer)
    gd.text(((W - hw) / 2, y_center - 30), headline, font=head_font, fill=(184, 137, 58, 90))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(8))
    canvas.alpha_composite(glow_layer)
    d.text(((W - hw) / 2, y_center - 30), headline, font=head_font, fill=CREAM)


def draw_wordmark(canvas: Image.Image, y: int) -> None:
    """The wordmark: TRESOR (spaced caps) · COUTURE (small caps) framed by gold rules."""
    d = ImageDraw.Draw(canvas)
    tres_font = cormorant(64, "Medium")
    cout_font = inter(20, "SemiBold")

    tres = "T R E S O R"
    tw = d.textlength(tres, font=tres_font)
    d.text(((W - tw) / 2, y), tres, font=tres_font, fill=CREAM)

    # gold rule + COUTURE + gold rule (echoing the master logo style)
    cy = y + 92
    cout = "C O U T U R E"
    cw = d.textlength(cout, font=cout_font)
    rule_len = 80
    gap = 24
    rule_y = cy + 12

    cx = W / 2
    d.line([(cx - cw / 2 - gap - rule_len, rule_y), (cx - cw / 2 - gap, rule_y)], fill=GOLD, width=2)
    d.line([(cx + cw / 2 + gap, rule_y), (cx + cw / 2 + gap + rule_len, rule_y)], fill=GOLD, width=2)
    d.text(((W - cw) / 2, cy), cout, font=cout_font, fill=GOLD)


def draw_footer(canvas: Image.Image, footer: str) -> None:
    d = ImageDraw.Draw(canvas)
    f = inter(22, "Regular")
    fw = d.textlength(footer, font=f)
    d.text(((W - fw) / 2, H - 70), footer, font=f, fill=GOLD_SOFT)


def draw_corner_marks(canvas: Image.Image) -> None:
    """L-shaped gold corner brackets — frames the composition for LED."""
    d = ImageDraw.Draw(canvas)
    inset = 60
    length = 90
    thickness = 3
    for (cx, cy, dx, dy) in [
        (inset, inset, +1, +1),
        (W - inset, inset, -1, +1),
        (inset, H - inset, +1, -1),
        (W - inset, H - inset, -1, -1),
    ]:
        d.line([(cx, cy), (cx + dx * length, cy)], fill=GOLD, width=thickness)
        d.line([(cx, cy), (cx, cy + dy * length)], fill=GOLD, width=thickness)


def build_poster(eyebrow: str, headline: str, footer: str, out_name: str) -> Path:
    canvas = ink_canvas().convert("RGBA")
    draw_corner_marks(canvas)
    paste_monogram(canvas, target_height=420, center_y=360)
    draw_headline(canvas, eyebrow=eyebrow, headline=headline, y_center=720)
    draw_wordmark(canvas, y=860)
    draw_footer(canvas, footer=footer)
    out_path = OUT / out_name
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)
    return out_path


def main() -> None:
    variants = [
        ("AN ATELIER IN THE MAKING", "Launching Soon", "tresorcouture.in",
         "TresorCouture_LED_LaunchingSoon_1920x1080.png"),
        ("DOORS ABOUT TO OPEN",      "Opening Soon",   "tresorcouture.in",
         "TresorCouture_LED_OpeningSoon_1920x1080.png"),
        ("A QUIET ANNOUNCEMENT",     "Coming Soon",    "tresorcouture.in",
         "TresorCouture_LED_ComingSoon_1920x1080.png"),
    ]
    for eyebrow, headline, footer, name in variants:
        path = build_poster(eyebrow, headline, footer, name)
        print(f"  wrote {path.relative_to(ROOT.parent)}  ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
