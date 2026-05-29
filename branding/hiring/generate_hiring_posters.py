#!/usr/bin/env python3
"""
Tresor Couture — hiring posters, vertical 4K (2160 x 3840).

Layout (matches the user's reference markup):
    TC mark (large)
    TRESOR · COUTURE (small wordmark under the mark)
    gold ornament
    eyebrow: "3 POSITIONS OPEN  ·  AT THE ATELIER"
    HEADLINE (italic Cormorant — varies per variant)
    Master Tailor       ← role line 1
    Sales Person        ← role line 2
    gold ornament
    Contact  ·  6304211922   ← anchored at the bottom for visibility

Three samples, identical except for the headline word choice:
    Staff Wanted    /    Now Hiring    /    We Are Hiring

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


def gold_ornament(canvas: Image.Image, y: int, span: int = 540) -> int:
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


def autofit_size(d: ImageDraw.ImageDraw, text: str, font_factory,
                 start_size: int, min_size: int, max_width: int,
                 tracking_em: float | None = None) -> int:
    """Step down from start_size until text fits inside max_width.
    If tracking_em is None, measure as a single block (centred_text).
    Otherwise measure as letter-spaced caps (centred_spaced)."""
    size = start_size
    while size > min_size:
        f = font_factory(size)
        if tracking_em is None:
            bbox = d.textbbox((0, 0), text, font=f)
            if bbox[2] - bbox[0] <= max_width:
                return size
        else:
            widths = [d.textbbox((0, 0), c, font=f) for c in text]
            cw = [(bb[2] - bb[0]) for bb in widths]
            gap = int(f.size * tracking_em)
            total = sum(cw) + gap * (len(text) - 1)
            if total <= max_width:
                return size
        size -= 8
    return size


def build_poster(headline: str, roles: list[str], contact: str,
                 eyebrow: str, out_name: str) -> Path:
    canvas = reel_canvas()
    hairline_frame(canvas)
    d_probe = ImageDraw.Draw(canvas)
    max_w = W - 2 * SAFE_X

    # 1. TC mark — slightly shorter than the launch posters to make room
    #    for the small wordmark + role list + contact below.
    mark_top = 220
    mark_bottom = paste_mark(canvas, target_height=1100, top_y=mark_top)

    # 2. Small TRESOR · COUTURE wordmark immediately under the mark.
    small_wm_font = cormorant(86, "Medium")
    _, small_wm_bottom = centred_spaced(
        canvas, mark_bottom + 60, "TRESOR   ·   COUTURE",
        small_wm_font, INK, tracking_em=0.4,
    )

    # 3. Gold ornament.
    orn1_bottom = gold_ornament(canvas, y=small_wm_bottom + 55, span=540)

    # 4. Eyebrow — fixed wording across all hiring variants.
    eb_font = inter(50, "Medium")
    eb_top = orn1_bottom + 70
    _, eb_bottom = centred_spaced(
        canvas, eb_top, eyebrow, eb_font, GOLD_DEEP, tracking_em=0.45,
    )

    # 5. HEADLINE — italic Cormorant, auto-fit so any phrase fits.
    head_size = autofit_size(
        d_probe, headline, lambda s: cormorant(s, "Italic"),
        start_size=420, min_size=200, max_width=max_w,
    )
    head_font = cormorant(head_size, "Italic")
    _, headline_bottom = centred_text(canvas, eb_bottom + 90, headline, head_font, INK)

    # 6. ROLE LIST — Cormorant Regular (upright, not italic) in deep gold
    #    so it's secondary to the italic headline but still substantial.
    role_size = autofit_size(
        d_probe, max(roles, key=len),
        lambda s: cormorant(s, "Regular"),
        start_size=240, min_size=140, max_width=max_w,
    )
    role_font = cormorant(role_size, "Regular")
    role_y = headline_bottom + 90
    role_bottom = role_y
    for role in roles:
        _, role_bottom = centred_text(canvas, role_y, role, role_font, GOLD_DEEP)
        role_y = role_bottom + 18  # tight stack — they read as a list

    # 7. Closing ornament under the role list.
    orn2_bottom = gold_ornament(canvas, y=role_bottom + 65, span=540)

    # 8. CONTACT line — Inter Bold, ink, big enough to read at distance.
    contact_size = autofit_size(
        d_probe, contact, lambda s: inter(s, "Bold"),
        start_size=160, min_size=90, max_width=max_w,
    )
    contact_font = inter(contact_size, "Bold")
    contact_y = H - 360
    centred_text(canvas, contact_y, contact, contact_font, INK)

    if orn2_bottom > contact_y - 40:
        raise RuntimeError(
            f"layout collision in {out_name}: orn2_bottom={orn2_bottom} contact_y={contact_y}"
        )

    out_path = OUT / out_name
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)
    return out_path


def main() -> None:
    EYEBROW = "3 POSITIONS OPEN   ·   AT THE ATELIER"
    ROLES   = ["Master Tailor", "Sales Person"]
    CONTACT = "Contact  ·  6304211922"

    variants = [
        ("Staff Wanted",     "TresorCouture_Hiring_StaffWanted_2160x3840.png"),
        ("Now Hiring",       "TresorCouture_Hiring_NowHiring_2160x3840.png"),
        ("We Are Hiring",    "TresorCouture_Hiring_WeAreHiring_2160x3840.png"),
    ]
    for headline, name in variants:
        path = build_poster(headline, ROLES, CONTACT, EYEBROW, name)
        print(f"  wrote {path.relative_to(ROOT.parent)}  ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
