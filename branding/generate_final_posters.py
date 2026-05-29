#!/usr/bin/env python3
"""
Tresor Couture — final-version posters (preview).

Two posters at 2160 × 3840:
    1. LAUNCH  — 'Launching Soon' final
    2. HIRING  — 'We Are Hiring', roles 'Master / Tailor' + 'Sales Person',
                  large phone number (no 'Contact:' label).

Uses the INTEGRATED master logo (mark + TRESOR · COUTURE wordmark in one
piece) from monogram-master.png — the lockup the user pointed at as the
reference. Replaces the previous 'TC mark at top + separate wordmark
below' composition.

PNG preview only. PDFs come after the user approves the layout.

Run from repo root:
    python3 branding/generate_final_posters.py
Outputs land in branding/final_preview/.
"""

from __future__ import annotations
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
FONTS = ROOT / "_fonts"
OUT = ROOT / "final_preview"
OUT.mkdir(parents=True, exist_ok=True)

CREAM       = (245, 231, 219)   # matches the reference PNG's baked BG; the
CREAM_SOFT  = (250, 237, 224)   # logo BG is chroma-keyed out so any leftover
INK         = (42, 31, 18)      # edge pixels blend with the same warm cream.
GOLD        = (184, 137, 58)
GOLD_SOFT   = (216, 185, 122)
GOLD_DEEP   = (142, 101, 32)

W, H = 2160, 3840
SAFE_X = 200


def cormorant(size, weight="Regular"):
    return ImageFont.truetype(str(FONTS / f"Cormorant-{weight}.ttf"), int(size))


def inter(size, weight="Regular"):
    return ImageFont.truetype(str(FONTS / f"Inter-{weight}.ttf"), int(size))


def reel_canvas():
    """Solid cream — flat colour matched to the logo's chroma-keyed BG so
    the master logo composites with no visible 'pasted' rectangle around
    it. Earlier gradient + grain created a halo because the logo's baked
    BG didn't share the canvas's noise pattern."""
    arr = np.full((H, W, 3), CREAM, dtype=np.uint8)
    return Image.fromarray(arr, "RGB").convert("RGBA")


def hairline_frame(canvas):
    d = ImageDraw.Draw(canvas)
    inset = 90
    d.rectangle([inset, inset, W - inset, H - inset], outline=GOLD_SOFT, width=3)


def gold_ornament(canvas, y, span=540):
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


_logo_rgba_cache: Image.Image | None = None


def _load_master_logo_with_alpha() -> Image.Image:
    """Replace the master logo's baked cream BG with the EXACT canvas CREAM
    colour, instead of chroma-keying to transparency. Stronger because near-
    BG pixels (source-image noise) also get neutralised to the canvas tone
    instead of becoming faintly visible halo pixels. Combined with a solid
    canvas background, this produces zero detectable seam around the logo."""
    global _logo_rgba_cache
    if _logo_rgba_cache is not None:
        return _logo_rgba_cache.copy()
    rgb = np.array(Image.open(ROOT / "master-logo-reference.png").convert("RGB"),
                    dtype=np.float32)
    border = np.concatenate([
        rgb[:8, :, :].reshape(-1, 3),
        rgb[-8:, :, :].reshape(-1, 3),
        rgb[:, :8, :].reshape(-1, 3),
        rgb[:, -8:, :].reshape(-1, 3),
    ])
    src_bg = np.median(border, axis=0)
    dist = np.linalg.norm(rgb - src_bg, axis=2)
    SOFT_LO, SOFT_HI = 4.0, 22.0
    is_fig = np.clip((dist - SOFT_LO) / (SOFT_HI - SOFT_LO), 0.0, 1.0)[..., None]
    canvas_bg = np.array(CREAM, dtype=np.float32)
    out_rgb = (is_fig * rgb + (1.0 - is_fig) * canvas_bg).clip(0, 255).astype(np.uint8)
    alpha = np.full(out_rgb.shape[:2], 255, dtype=np.uint8)
    rgba = np.dstack([out_rgb, alpha])
    _logo_rgba_cache = Image.fromarray(rgba, "RGBA")
    return _logo_rgba_cache.copy()


def paste_master_logo(canvas, target_height, top_y):
    """Place the integrated master logo at top_y. Uses the user's high-res
    master-logo-reference.png (5737 × 7680) with the cream BG chroma-keyed
    out via _load_master_logo_with_alpha() so the logo composites onto the
    cream gradient with no visible rectangular seam."""
    src = _load_master_logo_with_alpha()
    ratio = target_height / src.height
    new_w = int(src.width * ratio)
    logo = src.resize((new_w, target_height), Image.LANCZOS)
    mx = (W - new_w) // 2
    canvas.alpha_composite(logo, (mx, top_y))
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


def centred_pivoted(canvas, y, left_text, right_text, font, text_fill,
                    pip_fill, tracking_em=0.0, sep_pad_factor=0.6,
                    pip_radius_factor=8):
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

    left_start_x = pip_left_x - sep_pad - left_total
    if tracking_em > 0:
        x = left_start_x
        for c, w in zip(left_text, lw):
            d.text((x, y_draw), c, font=font, fill=text_fill)
            x += w + gap
    else:
        d.text((left_start_x - lb[0], y_draw), left_text, font=font, fill=text_fill)

    d.ellipse([pip_left_x, pip_cy - pip_r, pip_right_x, pip_cy + pip_r], fill=pip_fill)

    right_start_x = pip_right_x + sep_pad
    if tracking_em > 0:
        x = right_start_x
        for c, w in zip(right_text, rw):
            d.text((x, y_draw), c, font=font, fill=text_fill)
            x += w + gap
    else:
        d.text((right_start_x - rb[0], y_draw), right_text, font=font, fill=text_fill)

    return y, y + (ref[3] - ref[1])


def autofit_size(d, text, font_factory, start_size, min_size, max_width,
                 tracking_em=None):
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


# ---------- LAUNCH FINAL ----------

def build_launch_final():
    canvas = reel_canvas()
    hairline_frame(canvas)
    d_probe = ImageDraw.Draw(canvas)
    max_w = W - 2 * SAFE_X

    # 1. Integrated master logo (mark + wordmark together) — taller because
    #    it already includes the wordmark, no separate wordmark at the bottom.
    logo_top = 260
    logo_bottom = paste_master_logo(canvas, target_height=1640, top_y=logo_top)

    # 2. Ornament
    orn1_bottom = gold_ornament(canvas, y=logo_bottom + 90, span=620)

    # 3. Eyebrow
    eb_font = inter(50, "Medium")
    _, eb_bottom = centred_spaced(canvas, orn1_bottom + 85, "AN ATELIER IN THE MAKING",
                                   eb_font, GOLD_DEEP, tracking_em=0.45)

    # 4. HEADLINE
    head_size = autofit_size(d_probe, "Launching Soon",
                              lambda s: cormorant(s, "Italic"),
                              start_size=440, min_size=200, max_width=max_w)
    head_font = cormorant(head_size, "Italic")
    _, headline_bottom = centred_text(canvas, eb_bottom + 100, "Launching Soon",
                                       head_font, INK)

    # 5. Closing ornament
    orn2_bottom = gold_ornament(canvas, y=headline_bottom + 100, span=620)

    # 6. DESIGNER PRET tagline
    tag_text = "DESIGNER PRET"
    tag_size = autofit_size(d_probe, tag_text,
                             lambda s: inter(s, "Bold"),
                             start_size=160, min_size=80, max_width=max_w,
                             tracking_em=0.35)
    tag_font = inter(tag_size, "Bold")
    centred_spaced(canvas, orn2_bottom + 280, tag_text, tag_font, GOLD_DEEP,
                    tracking_em=0.35)

    # 7. URL anchored near the bottom
    url_font = inter(64, "SemiBold")
    centred_spaced(canvas, H - 280, "TRESORCOUTURE.IN", url_font, GOLD_DEEP,
                    tracking_em=0.28)

    out_path = OUT / "PREVIEW_LaunchFinal_LaunchingSoon_2160x3840.png"
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)
    return out_path


# ---------- HIRING FINAL ----------

def build_hiring_final():
    canvas = reel_canvas()
    hairline_frame(canvas)
    d_probe = ImageDraw.Draw(canvas)
    max_w = W - 2 * SAFE_X

    # 1. Integrated master logo (smaller — hiring has more content below)
    logo_top = 220
    logo_bottom = paste_master_logo(canvas, target_height=1320, top_y=logo_top)

    # 2. Ornament
    orn1_bottom = gold_ornament(canvas, y=logo_bottom + 60, span=540)

    # 3. Eyebrow (pivoted so the dot sits at W/2)
    eb_font = inter(50, "Medium")
    _, eb_bottom = centred_pivoted(
        canvas, orn1_bottom + 65, "3 POSITIONS OPEN", "AT THE ATELIER", eb_font,
        text_fill=GOLD_DEEP, pip_fill=GOLD, tracking_em=0.45,
        sep_pad_factor=1.6, pip_radius_factor=8,
    )

    # 4. HEADLINE
    head_size = autofit_size(d_probe, "We Are Hiring",
                              lambda s: cormorant(s, "Italic"),
                              start_size=420, min_size=200, max_width=max_w)
    head_font = cormorant(head_size, "Italic")
    _, headline_bottom = centred_text(canvas, eb_bottom + 80, "We Are Hiring",
                                       head_font, INK)

    # 5. Role list — Master / Tailor + Sales Person
    roles = ["Master / Tailor", "Sales Person"]
    role_size = autofit_size(d_probe, max(roles, key=len),
                              lambda s: cormorant(s, "Regular"),
                              start_size=240, min_size=140, max_width=max_w)
    role_font = cormorant(role_size, "Regular")
    role_y = headline_bottom + 75
    role_bottom = role_y
    for role in roles:
        _, role_bottom = centred_text(canvas, role_y, role, role_font, GOLD_DEEP)
        role_y = role_bottom + 18

    # 6. Closing ornament
    orn2_bottom = gold_ornament(canvas, y=role_bottom + 55, span=540)

    # 7. PHONE NUMBER — large, no 'Contact:' label.
    #    Auto-fits up to 320 pt so it dominates the bottom block.
    phone = "6304211922"
    phone_size = autofit_size(d_probe, phone,
                                lambda s: inter(s, "Bold"),
                                start_size=320, min_size=120, max_width=max_w)
    phone_font = inter(phone_size, "Bold")
    phone_y = orn2_bottom + 180
    _, phone_bottom = centred_text(canvas, phone_y, phone, phone_font, INK)

    # 8. Website sub-line
    site_font = inter(64, "SemiBold")
    centred_spaced(canvas, phone_bottom + 100, "TRESORCOUTURE.IN", site_font,
                    GOLD_DEEP, tracking_em=0.28)

    out_path = OUT / "PREVIEW_HiringFinal_WeAreHiring_2160x3840.png"
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)
    return out_path


def main():
    p1 = build_launch_final()
    p2 = build_hiring_final()
    for p in (p1, p2):
        print(f"  wrote {p.relative_to(ROOT.parent)}  ({p.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
