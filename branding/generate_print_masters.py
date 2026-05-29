#!/usr/bin/env python3
"""
Tresor Couture — print masters at 2 ft × 3 ft (24" × 36"), 300 DPI.

Renders 6 posters at 7200 × 10800 px (2:3 aspect — print spec), then
emits:
    branding/print/launch/<variant>.png + .pdf   — single-page per variant
    branding/print/hiring/<variant>.png + .pdf   — same
    branding/print/TresorCouture_Launch_Master.pdf   — 3 launch pages
    branding/print/TresorCouture_Hiring_Master.pdf   — 3 hiring pages

The two design families:
    LAUNCH  — Launching Soon · Opening Soon · Coming Soon
              (TC mark, eyebrow, italic headline, DESIGNER PRET tagline,
               TRESOR · COUTURE wordmark, URL)
    HIRING  — Staff Wanted · Now Hiring · We Are Hiring
              (TC mark, small TRESOR · COUTURE wordmark, eyebrow,
               italic headline, Master Tailor / Sales Person role list,
               Contact: 6304211922, TRESORCOUTURE.IN)

All sizes scale from the digital 2160 × 3840 reference by H/3840 = 2.8125.

Run from repo root:
    python3 branding/generate_print_masters.py
"""

from __future__ import annotations
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
FONTS = ROOT / "_fonts"
OUT = ROOT / "print"
OUT_LAUNCH = OUT / "launch"
OUT_HIRING = OUT / "hiring"
OUT.mkdir(parents=True, exist_ok=True)
OUT_LAUNCH.mkdir(exist_ok=True)
OUT_HIRING.mkdir(exist_ok=True)

# Print canvas: 24" × 36" @ 300 DPI = 7200 × 10800 px (2:3 aspect).
W, H = 7200, 10800
DPI = 300

# Vertical scale relative to the digital 2160 × 3840 design.
S = H / 3840  # 2.8125

CREAM       = (245, 236, 220)
CREAM_SOFT  = (251, 245, 234)
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
    """Cream gradient + paper grain — vectorised so 78 megapixel canvas
    builds in seconds, not minutes."""
    y_coords = (np.arange(H, dtype=np.float32) / (H - 1)).reshape(H, 1)
    base = np.zeros((H, W, 3), dtype=np.float32)
    for ch, (a, b) in enumerate(zip(CREAM_SOFT, CREAM)):
        base[:, :, ch] = a * (1 - y_coords) + b * y_coords
    rng = np.random.default_rng(13)
    noise = rng.integers(-3, 4, size=base.shape, dtype=np.int16)
    arr = np.clip(base.astype(np.int16) + noise, 0, 255).astype(np.uint8)
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


def paste_mark(canvas, target_height, top_y):
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
    """TRESOR · COUTURE with gold pip anchored at exact W/2."""
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

    pip_left_x = cx - pip_r
    pip_right_x = cx + pip_r

    x = pip_left_x - word_gap - tres_total
    for c, w in zip(tres, tw):
        d.text((x, y_draw), c, font=font, fill=ink_fill)
        x += w + gap

    d.ellipse([pip_left_x, pip_cy - pip_r, pip_right_x, pip_cy + pip_r], fill=dot_fill)

    x = pip_right_x + word_gap
    for c, w in zip(cout, cw):
        d.text((x, y_draw), c, font=font, fill=ink_fill)
        x += w + gap

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


# ---------- LAUNCH POSTER ----------

def build_launch_poster(eyebrow, headline, url, out_name):
    canvas = reel_canvas()
    hairline_frame(canvas)
    d_probe = ImageDraw.Draw(canvas)
    max_w = W - 2 * SAFE_X

    # 1. TC mark
    mark_top = sc(280)
    mark_bottom = paste_mark(canvas, target_height=sc(1300), top_y=mark_top)

    # 2. Ornament under mark
    orn1_bottom = gold_ornament(canvas, y=mark_bottom + sc(55), span=sc(620))

    # 3. Eyebrow
    eb_font = inter(sc(50), "Medium")
    eb_top = orn1_bottom + sc(75)
    _, eb_bottom = centred_spaced(canvas, eb_top, eyebrow, eb_font, GOLD_DEEP,
                                   tracking_em=0.45)

    # 4. HEADLINE (auto-fit)
    head_size = autofit_size(d_probe, headline,
                              lambda s: cormorant(s, "Italic"),
                              start_size=sc(440), min_size=sc(200), max_width=max_w)
    head_font = cormorant(head_size, "Italic")
    _, headline_bottom = centred_text(canvas, eb_bottom + sc(95), headline, head_font, INK)

    # 5. Second ornament
    orn2_top = headline_bottom + sc(95)
    orn2_bottom = gold_ornament(canvas, y=orn2_top, span=sc(620))

    # 6. BOTTOM: wordmark + URL anchored upward from canvas bottom
    url_baseline = H - sc(320)
    url_font = inter(sc(48), "Regular")
    _, url_bottom = centred_spaced(canvas, url_baseline, url, url_font, GOLD_DEEP,
                                    tracking_em=0.18)

    wordmark_top = url_baseline - sc(360)
    tres_font = cormorant(sc(140), "Medium")
    cout_font = inter(sc(46), "SemiBold")
    _, tres_bottom = centred_spaced(canvas, wordmark_top, "TRESOR", tres_font, INK,
                                     tracking_em=0.42)
    cy = tres_bottom + sc(60)
    cout = "COUTURE"
    gap_letters = int(cout_font.size * 0.55)
    chws = [d_probe.textbbox((0, 0), c, font=cout_font) for c in cout]
    char_widths = [(bb[2] - bb[0]) for bb in chws]
    cout_total = sum(char_widths) + gap_letters * (len(cout) - 1)
    rule_len = sc(220)
    side_gap = sc(60)
    cx = W // 2
    rule_y = cy + int(cout_font.size * 0.5)
    d = ImageDraw.Draw(canvas)
    d.line([(cx - cout_total / 2 - side_gap - rule_len, rule_y),
            (cx - cout_total / 2 - side_gap, rule_y)], fill=GOLD, width=sc(4))
    d.line([(cx + cout_total / 2 + side_gap, rule_y),
            (cx + cout_total / 2 + side_gap + rule_len, rule_y)], fill=GOLD, width=sc(4))
    _, cout_bottom = centred_spaced(canvas, cy, cout, cout_font, GOLD_DEEP,
                                     tracking_em=0.55)

    # 7. DESIGNER PRET tagline in the gap
    tag_text = "DESIGNER PRET"
    tag_size = autofit_size(d_probe, tag_text,
                             lambda s: inter(s, "Bold"),
                             start_size=sc(160), min_size=sc(80), max_width=max_w,
                             tracking_em=0.35)
    tag_font = inter(tag_size, "Bold")
    ref = d_probe.textbbox((0, 0), "A", font=tag_font)
    cap_h = ref[3] - ref[1]
    tag_y = (orn2_bottom + wordmark_top) // 2 - cap_h // 2
    centred_spaced(canvas, tag_y, tag_text, tag_font, GOLD_DEEP, tracking_em=0.35)

    out_path = OUT_LAUNCH / out_name
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)
    return out_path


# ---------- HIRING POSTER ----------

def build_hiring_poster(eyebrow_l, eyebrow_r, headline, roles, contact_text, out_name):
    canvas = reel_canvas()
    hairline_frame(canvas)
    d_probe = ImageDraw.Draw(canvas)
    max_w = W - 2 * SAFE_X

    # 1. TC mark
    mark_top = sc(220)
    mark_bottom = paste_mark(canvas, target_height=sc(1100), top_y=mark_top)

    # 2. Small TRESOR · COUTURE wordmark
    small_wm_font = cormorant(sc(96), "Medium")
    _, small_wm_bottom = small_wordmark(canvas, mark_bottom + sc(60),
                                         small_wm_font, INK, GOLD)

    # 3. Ornament
    orn1_bottom = gold_ornament(canvas, y=small_wm_bottom + sc(55), span=sc(540))

    # 4. Eyebrow (pivoted)
    eb_font = inter(sc(50), "Medium")
    eb_top = orn1_bottom + sc(70)
    _, eb_bottom = centred_pivoted(canvas, eb_top, eyebrow_l, eyebrow_r, eb_font,
                                    text_fill=GOLD_DEEP, pip_fill=GOLD,
                                    tracking_em=0.45, sep_pad_factor=1.6,
                                    pip_radius_factor=8)

    # 5. HEADLINE
    head_size = autofit_size(d_probe, headline,
                              lambda s: cormorant(s, "Italic"),
                              start_size=sc(420), min_size=sc(200), max_width=max_w)
    head_font = cormorant(head_size, "Italic")
    _, headline_bottom = centred_text(canvas, eb_bottom + sc(90), headline, head_font, INK)

    # 6. Role list
    role_size = autofit_size(d_probe, max(roles, key=len),
                              lambda s: cormorant(s, "Regular"),
                              start_size=sc(240), min_size=sc(140), max_width=max_w)
    role_font = cormorant(role_size, "Regular")
    role_y = headline_bottom + sc(90)
    role_bottom = role_y
    for role in roles:
        _, role_bottom = centred_text(canvas, role_y, role, role_font, GOLD_DEEP)
        role_y = role_bottom + sc(18)

    # 7. Closing ornament
    orn2_bottom = gold_ornament(canvas, y=role_bottom + sc(65), span=sc(540))

    # 8. Contact + website (anchored to ornament)
    contact_size = autofit_size(d_probe, contact_text,
                                  lambda s: inter(s, "Bold"),
                                  start_size=sc(150), min_size=sc(90), max_width=max_w)
    contact_font = inter(contact_size, "Bold")
    contact_y = orn2_bottom + sc(240)
    _, contact_bottom = centred_text(canvas, contact_y, contact_text, contact_font, INK)

    site_font = inter(sc(64), "SemiBold")
    centred_spaced(canvas, contact_bottom + sc(140), "TRESORCOUTURE.IN",
                    site_font, GOLD_DEEP, tracking_em=0.28)

    out_path = OUT_HIRING / out_name
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)
    return out_path


# ---------- PDF OUTPUT ----------

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

    print("\n▸ Launch posters (3 variants)")
    launch_variants = [
        ("AN ATELIER IN THE MAKING", "Launching Soon", "tresorcouture.in",
         "TresorCouture_Launch_LaunchingSoon_24x36in.png"),
        ("DOORS ABOUT TO OPEN", "Opening Soon", "tresorcouture.in",
         "TresorCouture_Launch_OpeningSoon_24x36in.png"),
        ("A QUIET ANNOUNCEMENT", "Coming Soon", "tresorcouture.in",
         "TresorCouture_Launch_ComingSoon_24x36in.png"),
    ]
    launch_pngs = []
    for eyebrow, headline, url, name in launch_variants:
        p = build_launch_poster(eyebrow, headline, url, name)
        launch_pngs.append(p)
        print(f"  ▸ {p.relative_to(ROOT.parent)}  ({p.stat().st_size // 1024} KB)")

    print("\n▸ Hiring posters (3 variants)")
    eb_left, eb_right = "3 POSITIONS OPEN", "AT THE ATELIER"
    roles = ["Master Tailor", "Sales Person"]
    contact_text = "Contact: 6304211922"
    hiring_variants = [
        ("Staff Wanted", "TresorCouture_Hiring_StaffWanted_24x36in.png"),
        ("Now Hiring",   "TresorCouture_Hiring_NowHiring_24x36in.png"),
        ("We Are Hiring","TresorCouture_Hiring_WeAreHiring_24x36in.png"),
    ]
    hiring_pngs = []
    for headline, name in hiring_variants:
        p = build_hiring_poster(eb_left, eb_right, headline, roles, contact_text, name)
        hiring_pngs.append(p)
        print(f"  ▸ {p.relative_to(ROOT.parent)}  ({p.stat().st_size // 1024} KB)")

    print("\n▸ Single-page PDFs")
    for p in launch_pngs + hiring_pngs:
        pdf = png_to_pdf(p)
        print(f"  ▸ {pdf.relative_to(ROOT.parent)}  ({pdf.stat().st_size // 1024} KB)")

    print("\n▸ Master PDFs (3 pages each)")
    launch_master = combine_pdfs(launch_pngs, OUT / "TresorCouture_Launch_Master.pdf")
    hiring_master = combine_pdfs(hiring_pngs, OUT / "TresorCouture_Hiring_Master.pdf")
    print(f"  ▸ {launch_master.relative_to(ROOT.parent)}  ({launch_master.stat().st_size // 1024} KB)")
    print(f"  ▸ {hiring_master.relative_to(ROOT.parent)}  ({hiring_master.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
