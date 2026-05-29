#!/usr/bin/env python3
"""
Tresor Couture — FINAL posters at print spec.

Renders the two finals at 7200 × 10800 px (24" × 36" @ 300 DPI):
    1. Launching Soon final
    2. We Are Hiring final

Outputs land in branding/print/final/:
    TresorCouture_Final_LaunchingSoon_24x36in.png + .pdf
    TresorCouture_Final_WeAreHiring_24x36in.png + .pdf
    TresorCouture_Final_Master.pdf      ← 2-page combined deck

Layout is identical to generate_final_posters.py (the approved preview),
scaled by H/3840 = 2.8125. Uses the user's high-res
master-logo-reference.png with the cream BG chroma-keyed out so the logo
composites onto the canvas with no visible patch.

Run from repo root:
    python3 branding/generate_final_print.py
"""

from __future__ import annotations
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
FONTS = ROOT / "_fonts"
OUT = ROOT / "print" / "final"
OUT.mkdir(parents=True, exist_ok=True)

# Print canvas: 24" × 36" @ 300 DPI = 7200 × 10800 px.
W, H = 7200, 10800
DPI = 300
S = H / 3840  # 2.8125 — scale from the digital 2160×3840 design.

# Palette — matched to the chroma-keyed reference logo's BG.
CREAM       = (245, 231, 219)
CREAM_SOFT  = (250, 237, 224)
INK         = (42, 31, 18)
GOLD        = (184, 137, 58)
GOLD_SOFT   = (216, 185, 122)
GOLD_DEEP   = (142, 101, 32)

SAFE_X = int(200 * S)


def cormorant(size, weight="Regular"):
    return ImageFont.truetype(str(FONTS / f"Cormorant-{weight}.ttf"), int(size))


def inter(size, weight="Regular"):
    return ImageFont.truetype(str(FONTS / f"Inter-{weight}.ttf"), int(size))


def sc(v):
    return int(v * S)


def reel_canvas():
    """Solid cream — flat colour matched to the logo's BG. No gradient,
    no grain, so the chroma-keyed logo composites with zero visible seam."""
    arr = np.full((H, W, 3), CREAM, dtype=np.uint8)
    return Image.fromarray(arr, "RGB").convert("RGBA")


def hairline_frame(canvas):
    d = ImageDraw.Draw(canvas)
    inset = sc(90)
    d.rectangle([inset, inset, W - inset, H - inset], outline=GOLD_SOFT, width=sc(3))


def gold_ornament(canvas, y, span):
    d = ImageDraw.Draw(canvas)
    cx = W // 2
    half = span // 2
    line_y = y + sc(8)
    d.line([(cx - half, line_y), (cx - sc(30), line_y)], fill=GOLD, width=sc(3))
    d.line([(cx + sc(30), line_y), (cx + half, line_y)], fill=GOLD, width=sc(3))
    pip = sc(12)
    d.polygon([(cx, line_y - pip), (cx + pip, line_y),
               (cx, line_y + pip), (cx - pip, line_y)], fill=GOLD)
    dot = sc(6)
    for sign in (-1, +1):
        d.ellipse([cx + sign * half - dot, line_y - dot,
                   cx + sign * half + dot, line_y + dot], fill=GOLD)
    return line_y + pip + sc(8)


_logo_rgba_cache: Image.Image | None = None


def _load_master_logo_with_alpha() -> Image.Image:
    """Replace the master logo's baked BG pixels with the EXACT canvas
    CREAM colour. Combined with a solid canvas, zero visible seam."""
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
    step = max(sc(8), 4)
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
        size -= step
    return size


# ---------- LAUNCH FINAL ----------

def build_launch_final():
    canvas = reel_canvas()
    hairline_frame(canvas)
    d_probe = ImageDraw.Draw(canvas)
    max_w = W - 2 * SAFE_X

    logo_top = sc(260)
    logo_bottom = paste_master_logo(canvas, target_height=sc(1640), top_y=logo_top)

    orn1_bottom = gold_ornament(canvas, y=logo_bottom + sc(90), span=sc(620))

    eb_font = inter(sc(50), "Medium")
    _, eb_bottom = centred_spaced(canvas, orn1_bottom + sc(85), "AN ATELIER IN THE MAKING",
                                   eb_font, GOLD_DEEP, tracking_em=0.45)

    head_size = autofit_size(d_probe, "Launching Soon",
                              lambda s: cormorant(s, "Italic"),
                              start_size=sc(440), min_size=sc(200), max_width=max_w)
    head_font = cormorant(head_size, "Italic")
    _, headline_bottom = centred_text(canvas, eb_bottom + sc(100), "Launching Soon",
                                       head_font, INK)

    orn2_bottom = gold_ornament(canvas, y=headline_bottom + sc(100), span=sc(620))

    tag_text = "DESIGNER PRET"
    tag_size = autofit_size(d_probe, tag_text,
                             lambda s: inter(s, "Bold"),
                             start_size=sc(160), min_size=sc(80), max_width=max_w,
                             tracking_em=0.35)
    tag_font = inter(tag_size, "Bold")
    centred_spaced(canvas, orn2_bottom + sc(280), tag_text, tag_font, GOLD_DEEP,
                    tracking_em=0.35)

    url_font = inter(sc(64), "SemiBold")
    centred_spaced(canvas, H - sc(280), "TRESORCOUTURE.IN", url_font, GOLD_DEEP,
                    tracking_em=0.28)

    out_path = OUT / "TresorCouture_Final_LaunchingSoon_24x36in.png"
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)
    return out_path


# ---------- HIRING FINAL ----------

def build_hiring_final():
    canvas = reel_canvas()
    hairline_frame(canvas)
    d_probe = ImageDraw.Draw(canvas)
    max_w = W - 2 * SAFE_X

    logo_top = sc(220)
    logo_bottom = paste_master_logo(canvas, target_height=sc(1320), top_y=logo_top)

    orn1_bottom = gold_ornament(canvas, y=logo_bottom + sc(60), span=sc(540))

    eb_font = inter(sc(50), "Medium")
    _, eb_bottom = centred_pivoted(
        canvas, orn1_bottom + sc(65), "3 POSITIONS OPEN", "AT THE ATELIER", eb_font,
        text_fill=GOLD_DEEP, pip_fill=GOLD, tracking_em=0.45,
        sep_pad_factor=1.6, pip_radius_factor=8,
    )

    head_size = autofit_size(d_probe, "We Are Hiring",
                              lambda s: cormorant(s, "Italic"),
                              start_size=sc(420), min_size=sc(200), max_width=max_w)
    head_font = cormorant(head_size, "Italic")
    _, headline_bottom = centred_text(canvas, eb_bottom + sc(80), "We Are Hiring",
                                       head_font, INK)

    roles = ["Master / Tailor", "Sales Person"]
    role_size = autofit_size(d_probe, max(roles, key=len),
                              lambda s: cormorant(s, "Regular"),
                              start_size=sc(240), min_size=sc(140), max_width=max_w)
    role_font = cormorant(role_size, "Regular")
    role_y = headline_bottom + sc(75)
    role_bottom = role_y
    for role in roles:
        _, role_bottom = centred_text(canvas, role_y, role, role_font, GOLD_DEEP)
        role_y = role_bottom + sc(18)

    orn2_bottom = gold_ornament(canvas, y=role_bottom + sc(55), span=sc(540))

    phone = "6304211922"
    phone_size = autofit_size(d_probe, phone,
                                lambda s: inter(s, "Bold"),
                                start_size=sc(320), min_size=sc(120), max_width=max_w)
    phone_font = inter(phone_size, "Bold")
    phone_y = orn2_bottom + sc(180)
    _, phone_bottom = centred_text(canvas, phone_y, phone, phone_font, INK)

    site_font = inter(sc(64), "SemiBold")
    centred_spaced(canvas, phone_bottom + sc(100), "TRESORCOUTURE.IN", site_font,
                    GOLD_DEEP, tracking_em=0.28)

    out_path = OUT / "TresorCouture_Final_WeAreHiring_24x36in.png"
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)
    return out_path


def png_to_pdf(png_path):
    img = Image.open(png_path).convert("RGB")
    pdf_path = png_path.with_suffix(".pdf")
    img.save(pdf_path, "PDF", resolution=DPI)
    return pdf_path


def combine_pdfs(png_paths, out_pdf):
    images = [Image.open(p).convert("RGB") for p in png_paths]
    images[0].save(out_pdf, "PDF", resolution=DPI, save_all=True,
                    append_images=images[1:])
    return out_pdf


def main():
    print(f"▸ Canvas: {W} × {H} px  ({W/DPI:.0f}\" × {H/DPI:.0f}\" @ {DPI} DPI)")

    print("\n▸ Rendering finals")
    pngs = [build_launch_final(), build_hiring_final()]
    for p in pngs:
        print(f"  ▸ {p.relative_to(ROOT.parent)}  ({p.stat().st_size // 1024} KB)")

    print("\n▸ Single-page PDFs")
    pdfs = [png_to_pdf(p) for p in pngs]
    for p in pdfs:
        print(f"  ▸ {p.relative_to(ROOT.parent)}  ({p.stat().st_size // 1024} KB)")

    print("\n▸ Combined master PDF (2 pages)")
    master = combine_pdfs(pngs, OUT / "TresorCouture_Final_Master.pdf")
    print(f"  ▸ {master.relative_to(ROOT.parent)}  ({master.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
