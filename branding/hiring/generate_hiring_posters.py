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


def small_wordmark(canvas, y, font, ink_fill, dot_fill):
    """TRESOR · COUTURE with the gold pip at exact canvas center (W/2),
    so this dot stacks vertically with the eyebrow dot, the contact dot,
    and the ornament diamond. Words extend outward from the pip rather
    than the composition being centered as a whole."""
    d = ImageDraw.Draw(canvas)
    gap = int(font.size * 0.32)
    word_gap = int(font.size * 0.55)
    pip_r = max(3, font.size // 18)
    cx = W // 2

    def word_widths(s):
        return [d.textbbox((0, 0), c, font=font)[2] - d.textbbox((0, 0), c, font=font)[0]
                for c in s]

    tres, cout = "TRESOR", "COUTURE"
    tw = word_widths(tres); cw = word_widths(cout)
    tres_total = sum(tw) + gap * (len(tres) - 1)

    ref = d.textbbox((0, 0), "A", font=font)
    y_draw = y - ref[1]
    pip_cy = y + (ref[3] - ref[1]) // 2

    # Pip anchored at canvas center
    pip_left_x = cx - pip_r
    pip_right_x = cx + pip_r

    # TRESOR ends at pip_left_x - word_gap
    x = pip_left_x - word_gap - tres_total
    for c, w in zip(tres, tw):
        d.text((x, y_draw), c, font=font, fill=ink_fill)
        x += w + gap

    d.ellipse([pip_left_x, pip_cy - pip_r, pip_right_x, pip_cy + pip_r], fill=dot_fill)

    # COUTURE starts at pip_right_x + word_gap
    x = pip_right_x + word_gap
    for c, w in zip(cout, cw):
        d.text((x, y_draw), c, font=font, fill=ink_fill)
        x += w + gap

    return y, y + (ref[3] - ref[1])


def centred_pivoted(canvas, y, left_text, right_text, font, text_fill,
                    pip_fill, tracking_em=0.0, sep_pad_factor=0.6,
                    pip_radius_factor=8):
    """Render 'left  ⋅  right' with a gold pip at exact canvas center.
    Use tracking_em>0 for letter-spaced caps (eyebrow style), 0 for
    natural typesetting (contact line style). Pip radius defaults to
    font.size / pip_radius_factor so it scales with the line."""
    d = ImageDraw.Draw(canvas)
    cx = W // 2
    pip_r = max(3, font.size // pip_radius_factor)
    sep_pad = int(font.size * sep_pad_factor)

    if tracking_em > 0:
        gap = int(font.size * tracking_em)

        def measure(s):
            return [d.textbbox((0, 0), c, font=font)[2] - d.textbbox((0, 0), c, font=font)[0]
                    for c in s]
        lw = measure(left_text)
        rw = measure(right_text)
        left_total = sum(lw) + gap * (len(left_text) - 1)
    else:
        lb = d.textbbox((0, 0), left_text, font=font)
        rb = d.textbbox((0, 0), right_text, font=font)
        left_total = lb[2] - lb[0]

    ref = d.textbbox((0, 0), "A", font=font)
    y_draw = y - ref[1]
    pip_cy = y + (ref[3] - ref[1]) // 2

    pip_left_x = cx - pip_r
    pip_right_x = cx + pip_r

    # left text — ends sep_pad px before the pip
    left_start_x = pip_left_x - sep_pad - left_total
    if tracking_em > 0:
        x = left_start_x
        for c, w in zip(left_text, lw):
            d.text((x, y_draw), c, font=font, fill=text_fill)
            x += w + gap
    else:
        d.text((left_start_x - lb[0], y_draw), left_text, font=font, fill=text_fill)

    # pip at exact W/2
    d.ellipse([pip_left_x, pip_cy - pip_r, pip_right_x, pip_cy + pip_r], fill=pip_fill)

    # right text — starts sep_pad px after the pip
    right_start_x = pip_right_x + sep_pad
    if tracking_em > 0:
        x = right_start_x
        for c, w in zip(right_text, rw):
            d.text((x, y_draw), c, font=font, fill=text_fill)
            x += w + gap
    else:
        d.text((right_start_x - rb[0], y_draw), right_text, font=font, fill=text_fill)

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


def build_poster(headline: str, roles: list[str], contact_left: str, contact_right: str,
                 eyebrow_left: str, eyebrow_right: str, out_name: str) -> Path:
    canvas = reel_canvas()
    hairline_frame(canvas)
    d_probe = ImageDraw.Draw(canvas)
    max_w = W - 2 * SAFE_X

    # 1. TC mark — slightly shorter than the launch posters to make room
    #    for the small wordmark + role list + contact below.
    mark_top = 220
    mark_bottom = paste_mark(canvas, target_height=1100, top_y=mark_top)

    # 2. Small TRESOR · COUTURE wordmark immediately under the mark.
    small_wm_font = cormorant(96, "Medium")
    _, small_wm_bottom = small_wordmark(
        canvas, mark_bottom + 60, small_wm_font, INK, GOLD,
    )

    # 3. Gold ornament.
    orn1_bottom = gold_ornament(canvas, y=small_wm_bottom + 55, span=540)

    # 4. Eyebrow — split on the pivot dot, drawn through centred_pivoted so
    #    its dot sits at W/2 — same X as the wordmark pip + contact dot.
    eb_font = inter(50, "Medium")
    eb_top = orn1_bottom + 70
    _, eb_bottom = centred_pivoted(
        canvas, eb_top, eyebrow_left, eyebrow_right, eb_font,
        text_fill=GOLD_DEEP, pip_fill=GOLD, tracking_em=0.45,
        sep_pad_factor=1.6, pip_radius_factor=8,
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

    # 8. CONTACT line — colon separator (no dot), centred as a single block.
    # Anchored relative to the closing ornament so it sits tight against the
    # content block instead of floating near the canvas bottom — removes the
    # dead white space between role list and contact.
    contact_text = f"{contact_left}: {contact_right}"
    contact_size = autofit_size(
        d_probe, contact_text, lambda s: inter(s, "Bold"),
        start_size=150, min_size=90, max_width=max_w,
    )
    contact_font = inter(contact_size, "Bold")
    contact_y = orn2_bottom + 240
    _, contact_bottom = centred_text(canvas, contact_y, contact_text, contact_font, INK)

    # 9. WEBSITE sub-line under the contact — gold deep, spaced caps so it
    #    reads as a quiet companion to the bold contact line above it.
    site_font = inter(64, "SemiBold")
    centred_spaced(
        canvas, contact_bottom + 50, "TRESORCOUTURE.IN",
        site_font, GOLD_DEEP, tracking_em=0.28,
    )

    if orn2_bottom > contact_y - 40:
        raise RuntimeError(
            f"layout collision in {out_name}: orn2_bottom={orn2_bottom} contact_y={contact_y}"
        )

    out_path = OUT / out_name
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)
    return out_path


def main() -> None:
    EYEBROW_L, EYEBROW_R = "3 POSITIONS OPEN", "AT THE ATELIER"
    ROLES   = ["Master Tailor", "Sales Person"]
    CONTACT_L, CONTACT_R = "Contact", "6304211922"

    variants = [
        ("Staff Wanted",     "TresorCouture_Hiring_StaffWanted_2160x3840.png"),
        ("Now Hiring",       "TresorCouture_Hiring_NowHiring_2160x3840.png"),
        ("We Are Hiring",    "TresorCouture_Hiring_WeAreHiring_2160x3840.png"),
    ]
    for headline, name in variants:
        path = build_poster(headline, ROLES, CONTACT_L, CONTACT_R,
                            EYEBROW_L, EYEBROW_R, name)
        print(f"  wrote {path.relative_to(ROOT.parent)}  ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
