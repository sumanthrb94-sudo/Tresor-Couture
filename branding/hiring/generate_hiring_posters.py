#!/usr/bin/env python3
"""
Tresor Couture — staff-wanted posters, vertical 4K (2160 x 3840).

Identical layout language to generate_reel_posters.py — big TC mark at
the top, gold ornament, eyebrow + italic Cormorant headline, second
ornament, DESIGNER BOUTIQUE tagline, TRESOR / COUTURE wordmark, URL —
so a hiring poster reads as a sibling of the launch carousel rather
than a one-off.

Three samples:
    Staff Wanted   ·  "POSITIONS OPEN AT THE ATELIER"
    Now Hiring     ·  "TAILORS · STYLISTS · DESIGNERS"
    Join the Atelier · "WE ARE HIRING"

Run from repo root:
    python3 branding/hiring/generate_hiring_posters.py

Outputs land in branding/hiring/.
"""

from __future__ import annotations
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "_fonts"
OUT = ROOT / "hiring"
OUT.mkdir(parents=True, exist_ok=True)

# Palette (sampled from palette.json — same as launch posters)
CREAM       = (245, 236, 220)
CREAM_SOFT  = (251, 245, 234)
INK         = (42, 31, 18)
GOLD        = (184, 137, 58)
GOLD_SOFT   = (216, 185, 122)
GOLD_DEEP   = (142, 101, 32)

W, H = 2160, 3840
SAFE_X = 200


def cormorant(size: int, weight: str = "Regular") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / f"Cormorant-{weight}.ttf"), size)


def inter(size: int, weight: str = "Regular") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / f"Inter-{weight}.ttf"), size)


def reel_canvas() -> Image.Image:
    """Cream gradient + paper grain. Identical to the launch posters so the
    two surfaces (launch + hiring) share an unmistakable family resemblance."""
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
    d = ImageDraw.Draw(canvas)
    inset = 90
    d.rectangle([inset, inset, W - inset, H - inset], outline=GOLD_SOFT, width=3)


def gold_ornament(canvas: Image.Image, y: int, span: int = 620) -> int:
    d = ImageDraw.Draw(canvas)
    cx = W // 2
    half = span // 2
    line_y = y + 8
    d.line([(cx - half, line_y), (cx - 30, line_y)], fill=GOLD, width=3)
    d.line([(cx + 30, line_y), (cx + half, line_y)], fill=GOLD, width=3)
    pip = 12
    d.polygon([(cx, line_y - pip), (cx + pip, line_y),
               (cx, line_y + pip), (cx - pip, line_y)], fill=GOLD)
    dot = 6
    for sign in (-1, +1):
        d.ellipse([cx + sign * half - dot, line_y - dot,
                   cx + sign * half + dot, line_y + dot], fill=GOLD)
    return line_y + pip + 8


def paste_mark(canvas: Image.Image, target_height: int, top_y: int) -> int:
    src = Image.open(ROOT / "tc-master-mark-4k.png").convert("RGBA")
    ratio = target_height / src.height
    new_w = int(src.width * ratio)
    mark = src.resize((new_w, target_height), Image.LANCZOS)
    mx = (W - new_w) // 2
    canvas.alpha_composite(mark, (mx, top_y))
    return top_y + target_height


def centred_text(canvas, y, text, font, fill):
    d = ImageDraw.Draw(canvas)
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    x = (W - tw) // 2 - bbox[0]
    y_draw = y - bbox[1]
    d.text((x, y_draw), text, font=font, fill=fill)
    return y, y + (bbox[3] - bbox[1])


def centred_spaced(canvas, y, text, font, fill, tracking_em=0.4):
    d = ImageDraw.Draw(canvas)
    gap = int(font.size * tracking_em)
    widths = [d.textbbox((0, 0), c, font=font) for c in text]
    char_widths = [(bb[2] - bb[0]) for bb in widths]
    total = sum(char_widths) + gap * (len(text) - 1)
    ref = d.textbbox((0, 0), "A", font=font)
    y_draw = y - ref[1]
    x = (W - total) // 2
    for c, cw in zip(text, char_widths):
        d.text((x, y_draw), c, font=font, fill=fill)
        x += cw + gap
    return y, y + (ref[3] - ref[1])


def draw_wordmark_block(canvas, y):
    d = ImageDraw.Draw(canvas)
    tres_font = cormorant(140, "Medium")
    cout_font = inter(46, "SemiBold")

    _, tres_bottom = centred_spaced(canvas, y, "TRESOR", tres_font, INK, tracking_em=0.42)
    cy = tres_bottom + 60

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


def draw_url(canvas, y, text):
    f = inter(48, "Regular")
    return centred_spaced(canvas, y, text, f, GOLD_DEEP, tracking_em=0.18)


def build_poster(eyebrow: str, headline: str, url: str, out_name: str) -> Path:
    canvas = reel_canvas()
    hairline_frame(canvas)

    # ---- TOP: TC mark (same big size as launch posters) ----
    mark_top = 280
    mark_bottom = paste_mark(canvas, target_height=1300, top_y=mark_top)

    orn1_bottom = gold_ornament(canvas, y=mark_bottom + 55, span=620)

    # ---- eyebrow ----
    eb_font = inter(50, "Medium")
    eb_top = orn1_bottom + 75
    _, eb_bottom = centred_spaced(canvas, eb_top, eyebrow, eb_font, GOLD_DEEP, tracking_em=0.45)

    # ---- HEADLINE (auto-fit so longer phrases like "Join the Atelier" never bleed) ----
    head_font = cormorant(440, "Italic")
    d_probe = ImageDraw.Draw(canvas)
    while head_font.size > 200:
        bbox = d_probe.textbbox((0, 0), headline, font=head_font)
        if bbox[2] - bbox[0] <= W - 2 * SAFE_X:
            break
        head_font = cormorant(head_font.size - 20, "Italic")

    headline_top = eb_bottom + 95
    _, headline_bottom = centred_text(canvas, headline_top, headline, head_font, INK)

    orn2_top = headline_bottom + 95
    orn2_bottom = gold_ornament(canvas, y=orn2_top, span=620)

    # ---- BOTTOM block ----
    url_baseline = H - 320
    _, url_bottom = draw_url(canvas, y=url_baseline, text=url)
    wordmark_top = url_baseline - 360
    _, wm_bottom = draw_wordmark_block(canvas, y=wordmark_top)

    # ---- TAGLINE — auto-fit Inter Bold (~120 pt) ----
    tag_text = "DESIGNER PRET"
    tag_tracking = 0.35
    tag_size = 160
    while tag_size > 80:
        f = inter(tag_size, "Bold")
        widths = [d_probe.textbbox((0, 0), c, font=f)[2] - d_probe.textbbox((0, 0), c, font=f)[0]
                  for c in tag_text]
        gap = int(f.size * tag_tracking)
        total = sum(widths) + gap * (len(tag_text) - 1)
        if total <= W - 2 * SAFE_X:
            break
        tag_size -= 8
    tag_font = inter(tag_size, "Bold")
    ref = d_probe.textbbox((0, 0), "A", font=tag_font)
    cap_h = ref[3] - ref[1]
    tag_y = (orn2_bottom + wordmark_top) // 2 - cap_h // 2
    centred_spaced(canvas, tag_y, tag_text, tag_font, GOLD_DEEP, tracking_em=tag_tracking)

    if orn2_bottom > wordmark_top - 40:
        raise RuntimeError(
            f"layout collision in {out_name}: orn2_bottom={orn2_bottom} wordmark_top={wordmark_top}"
        )

    out_path = OUT / out_name
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)
    return out_path


def main() -> None:
    variants = [
        ("3 POSITIONS  ·  MASTER TAILOR & MORE", "Staff Wanted",       "walk in  ·  tresorcouture.in",
         "TresorCouture_Hiring_StaffWanted_2160x3840.png"),
        ("TAILORS  ·  STYLISTS  ·  DESIGNERS", "Now Hiring",         "careers  ·  tresorcouture.in",
         "TresorCouture_Hiring_NowHiring_2160x3840.png"),
        ("JOIN THE ATELIER",                   "We Are Hiring",      "walk in  ·  tresorcouture.in",
         "TresorCouture_Hiring_WeAreHiring_2160x3840.png"),
    ]
    for eyebrow, headline, footer, name in variants:
        path = build_poster(eyebrow, headline, footer, name)
        print(f"  wrote {path.relative_to(ROOT.parent)}  ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
