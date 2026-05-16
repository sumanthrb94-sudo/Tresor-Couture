#!/usr/bin/env python3
"""
Trésor Couture — brand kit generator.

Regenerates every raster asset under branding/ (favicons, social, OG image)
from the source palette + master monogram. Run:

    python3 branding/generate.py

Outputs are deterministic. Re-running overwrites existing files.

Dependencies: Pillow, numpy. Fonts ship in branding/_fonts/.
"""

from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
FONTS = ROOT / "_fonts"
SOCIAL = ROOT / "social"
FAVI = ROOT / "favicons"
PRINT = ROOT / "print"

PALETTE = json.loads((ROOT / "palette.json").read_text())["tokens"]
CREAM = (245, 236, 220)
CREAM_SOFT = (251, 245, 234)
INK = (42, 31, 18)
INK_SOFT = (70, 56, 38)
GOLD = (184, 137, 58)
GOLD_SOFT = (216, 185, 122)
GOLD_DEEP = (142, 101, 32)
ACCENT = (234, 217, 186)
WHITE = (255, 255, 255)


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / f"{name}.ttf"), size)


def cormorant(size: int, weight: str = "Regular") -> ImageFont.FreeTypeFont:
    return font(f"Cormorant-{weight}", size)


def inter(size: int, weight: str = "Regular") -> ImageFont.FreeTypeFont:
    return font(f"Inter-{weight}", size)


# ----- master monogram -----------------------------------------------------

_master_cache: dict[int, Image.Image] = {}


def load_master(max_dim: int | None = None) -> Image.Image:
    if max_dim in _master_cache:
        return _master_cache[max_dim].copy()
    im = Image.open(ROOT / "monogram-master.png").convert("RGBA")
    if max_dim is not None and max(im.size) > max_dim:
        ratio = max_dim / max(im.size)
        im = im.resize(
            (int(im.width * ratio), int(im.height * ratio)),
            Image.LANCZOS,
        )
    _master_cache[max_dim] = im
    return im.copy()


# ----- primitives ----------------------------------------------------------


def gradient_bg(w: int, h: int, top, bottom) -> Image.Image:
    """Vertical linear gradient cream → soft cream."""
    base = Image.new("RGB", (1, h), top)
    for y in range(h):
        t = y / max(1, h - 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        base.putpixel((0, y), (r, g, b))
    return base.resize((w, h))


def paper_canvas(w: int, h: int) -> Image.Image:
    """Cream canvas with a faint vertical lift and very subtle paper grain."""
    img = gradient_bg(w, h, CREAM_SOFT, CREAM).convert("RGB")
    # tasteful, very low noise (paper texture)
    import numpy as np

    arr = np.array(img, dtype=np.int16)
    rng = np.random.default_rng(7)
    noise = rng.integers(-4, 5, size=arr.shape, dtype=np.int16)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def hairline(draw: ImageDraw.ImageDraw, p1, p2, color=GOLD, width=1, alpha=200):
    r, g, b = color
    draw.line([p1, p2], fill=(r, g, b, alpha), width=width)


def deco_corner(im: Image.Image, x: int, y: int, size: int, color=GOLD, flip_x=False, flip_y=False, width=2):
    """L-shaped corner ornament with a centered fleuron dot."""
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    dx, dy = (-1 if flip_x else 1), (-1 if flip_y else 1)
    r, g, b = color
    d.line([(x, y), (x + size * dx, y)], fill=(r, g, b, 230), width=width)
    d.line([(x, y), (x, y + size * dy)], fill=(r, g, b, 230), width=width)
    # tiny corner dot
    cx, cy = x + 4 * dx, y + 4 * dy
    d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=(r, g, b, 230))
    im.paste(overlay, (0, 0), overlay)


def four_corners(im: Image.Image, margin: int, size: int, color=GOLD, width=2):
    w, h = im.size
    deco_corner(im, margin, margin, size, color, False, False, width)
    deco_corner(im, w - margin, margin, size, color, True, False, width)
    deco_corner(im, margin, h - margin, size, color, False, True, width)
    deco_corner(im, w - margin, h - margin, size, color, True, True, width)


def center_text(draw, xy, text, fnt, fill, anchor="mm", spacing=None, tracking=0):
    """Draw text centered. Supports manual letter-spacing (tracking, in px)."""
    if tracking == 0:
        draw.text(xy, text, font=fnt, fill=fill, anchor=anchor)
        return
    # measure with tracking
    total = 0
    widths = []
    for ch in text:
        bbox = fnt.getbbox(ch)
        cw = bbox[2] - bbox[0]
        widths.append(cw)
        total += cw + tracking
    total -= tracking
    x_start = xy[0] - total // 2 if anchor[0] == "m" else xy[0]
    bbox = fnt.getbbox(text)
    ascent = -bbox[1]
    y = xy[1] - (bbox[3] - bbox[1]) // 2 if anchor[1] == "m" else xy[1]
    for ch, cw in zip(text, widths):
        draw.text((x_start, y - ascent), ch, font=fnt, fill=fill)
        x_start += cw + tracking


def text_size(fnt: ImageFont.FreeTypeFont, text: str) -> tuple[int, int]:
    bbox = fnt.getbbox(text)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def paste_logo(im: Image.Image, max_w: int, center_xy: tuple[int, int]):
    """Paste the master logo centered at center_xy, scaled so its width <= max_w."""
    logo = load_master(max_w * 2)
    scale = max_w / logo.width
    new_size = (int(logo.width * scale), int(logo.height * scale))
    logo = logo.resize(new_size, Image.LANCZOS)
    x = center_xy[0] - logo.width // 2
    y = center_xy[1] - logo.height // 2
    im.alpha_composite(logo, (x, y))


def floral_sprig(im: Image.Image, cx: int, cy: int, length: int = 120, color=GOLD, alpha=200):
    """Hand-drawn-style sprig of three buds. Decorative."""
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    r, g, b = color
    # main stem (gentle curve)
    pts = []
    for t in range(0, 101, 2):
        u = t / 100
        x = cx - length / 2 + length * u
        y = cy + 8 * math.sin(u * math.pi)
        pts.append((x, y))
    d.line(pts, fill=(r, g, b, alpha), width=2)
    # three buds along the stem
    for u in (0.25, 0.55, 0.85):
        x = cx - length / 2 + length * u
        y = cy + 8 * math.sin(u * math.pi)
        d.ellipse([x - 5, y - 5, x + 5, y + 5], outline=(r, g, b, alpha), width=2)
        d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(r, g, b, alpha))
    # two side leaves
    for u, sign in ((0.40, -1), (0.70, 1)):
        x = cx - length / 2 + length * u
        y = cy + 8 * math.sin(u * math.pi)
        d.line([(x, y), (x + 10 * sign, y - 10)], fill=(r, g, b, alpha), width=2)
        d.ellipse([x + 6 * sign - 3, y - 14, x + 6 * sign + 3, y - 8], outline=(r, g, b, alpha), width=1)
    im.alpha_composite(overlay)


def wordmark_block(
    draw: ImageDraw.ImageDraw,
    cx: int,
    cy: int,
    *,
    primary_size: int,
    secondary_size: int,
    color=INK,
    tracking_primary: int = 8,
    tracking_secondary: int = 14,
    show_rule: bool = True,
):
    """TRÉSOR / hairline / COUTURE."""
    primary = cormorant(primary_size, "Light")
    secondary = inter(secondary_size, "SemiBold")
    pw, ph = text_size(primary, "TRÉSOR")
    sw, sh = text_size(secondary, "COUTURE")
    # primary
    draw_letters(draw, "TRÉSOR", primary, cx, cy - primary_size // 4, color, tracking_primary)
    if show_rule:
        rule_y = cy + primary_size // 5
        rule_half = max(pw, sw) // 2 + primary_size // 6
        r, g, b = GOLD
        # short hairlines with arrow dots
        draw.line(
            [(cx - rule_half, rule_y), (cx - rule_half + rule_half - sw // 2 - 18, rule_y)],
            fill=(r, g, b, 220),
            width=1,
        )
        draw.line(
            [(cx + sw // 2 + 18, rule_y), (cx + rule_half, rule_y)],
            fill=(r, g, b, 220),
            width=1,
        )
        # central caps
        draw_letters(draw, "COUTURE", secondary, cx, rule_y + secondary_size // 2 + 4, color, tracking_secondary)
    else:
        draw_letters(draw, "COUTURE", secondary, cx, cy + primary_size // 2, color, tracking_secondary)


def draw_letters(draw, text, fnt, cx, cy, fill, tracking):
    """Draw text with custom tracking, horizontally centered at (cx, cy)."""
    widths = []
    for ch in text:
        b = fnt.getbbox(ch)
        widths.append(b[2] - b[0])
    total = sum(widths) + tracking * max(0, len(text) - 1)
    x = cx - total // 2
    bbox = fnt.getbbox(text)
    h = bbox[3] - bbox[1]
    y = cy - h // 2 - bbox[1]
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += w + tracking


# ----- favicons ------------------------------------------------------------


def build_favicons():
    """Browser tab + app icons.

    Two strategies, picked by size:
      • ≤ 96 px — bespoke high-contrast ink-on-cream "TC" + gold border.
        The painted master is too detailed (figure, drape, floral) to read
        at 16/32 px.
      • ≥ 128 px — composite the painted TC mark (mark-master.png, the
        upper portion of the lockup without the TRÉSOR/COUTURE wordmark)
        on a cream tile with the gold-border frame. This carries the real
        brand artwork on PWA install, apple-touch, and OS app surfaces.
    """
    sizes = [16, 32, 48, 64, 96, 180, 192, 256, 512]
    mark_master = Image.open(ROOT / "mark-master.png").convert("RGBA")
    for s in sizes:
        im = Image.new("RGBA", (s, s), CREAM + (255,))
        d = ImageDraw.Draw(im)
        # rounded square border
        pad = max(1, s // 12)
        d.rounded_rectangle(
            [pad, pad, s - pad - 1, s - pad - 1],
            radius=max(2, s // 8),
            outline=GOLD,
            width=max(1, s // 32),
        )
        if s >= 128:
            # Painted mark, fit ~72% of canvas with comfortable margin
            target = int(s * 0.72)
            ratio = min(target / mark_master.width, target / mark_master.height)
            new_w = max(1, int(mark_master.width * ratio))
            new_h = max(1, int(mark_master.height * ratio))
            mark = mark_master.resize((new_w, new_h), Image.LANCZOS)
            mx = (s - new_w) // 2
            my = (s - new_h) // 2
            im.alpha_composite(mark, (mx, my))
        else:
            # Bespoke high-legibility TC at small sizes
            target_h = int(s * 0.50)
            lo, hi = 6, s * 2
            best = lo
            while lo <= hi:
                mid = (lo + hi) // 2
                f = cormorant(mid, "Bold")
                w, h = text_size(f, "TC")
                if w <= s * 0.70 and h <= target_h:
                    best = mid
                    lo = mid + 1
                else:
                    hi = mid - 1
            f = cormorant(best, "Bold")
            w, h = text_size(f, "TC")
            bbox = f.getbbox("TC")
            d.text(
                (s // 2 - w // 2 - bbox[0], s // 2 - h // 2 - bbox[1] - max(0, s // 40)),
                "TC",
                font=f,
                fill=INK,
            )
        out = FAVI / f"favicon-{s}x{s}.png"
        im.save(out)
    # apple-touch-icon
    (FAVI / "apple-touch-icon.png").write_bytes((FAVI / "favicon-180x180.png").read_bytes())
    # multi-resolution .ico
    ico_sources = [
        Image.open(FAVI / f"favicon-{n}x{n}.png").convert("RGBA")
        for n in (16, 32, 48, 64)
    ]
    ico_sources[0].save(
        FAVI / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
        append_images=ico_sources[1:],
    )
    # webmanifest
    manifest = {
        "name": "Trésor Couture",
        "short_name": "Trésor",
        "icons": [
            {"src": "/branding/favicons/favicon-192x192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/branding/favicons/favicon-512x512.png", "sizes": "512x512", "type": "image/png"},
        ],
        "theme_color": "#F5ECDC",
        "background_color": "#F5ECDC",
        "display": "standalone",
    }
    (FAVI / "site.webmanifest").write_text(json.dumps(manifest, indent=2))


# ----- shared layout helpers ----------------------------------------------


@dataclass
class Card:
    w: int
    h: int

    def canvas(self) -> Image.Image:
        return paper_canvas(self.w, self.h).convert("RGBA")


def stamp_url(im: Image.Image, text="tresorcouture.com", color=GOLD_DEEP):
    d = ImageDraw.Draw(im)
    f = inter(max(10, im.height // 80), "Medium")
    tw, th = text_size(f, text)
    d.text(
        (im.width - tw - im.width // 40, im.height - th - im.height // 40),
        text,
        font=f,
        fill=color,
    )


# ----- social media kit ---------------------------------------------------

TAGLINE = "Heritage Indian Weaves · Sold by the Meter"
SHORT_TAG = "Heritage Indian Weaves"

POSTS = [
    {
        "name": "instagram-post-launch-1080",
        "eyebrow": "AN ATELIER IS BORN",
        "title": "The Weaves\nReturn Home",
        "subtitle": "Banarasi · Patola · Jamdani · Kanjivaram · Pashmina",
        "cta": "TRESORCOUTURE.COM",
    },
    {
        "name": "instagram-post-banarasi-1080",
        "eyebrow": "WEAVE STORY · NO. 01",
        "title": "Banarasi,\nLoom-Lit.",
        "subtitle": "Pure tussar warps with real-zari brocade,\nhand-woven on pit looms in Varanasi.",
        "cta": "SHOP THE STORY →",
    },
    {
        "name": "instagram-post-patola-1080",
        "eyebrow": "WEAVE STORY · NO. 02",
        "title": "Patola,\nTwice Tied.",
        "subtitle": "Double-ikat silks dyed thread-by-thread\nin the courtyards of Patan, Gujarat.",
        "cta": "SHOP THE STORY →",
    },
    {
        "name": "instagram-post-quote-1080",
        "eyebrow": "AN ATELIER NOTE",
        "title": "Every metre\ntakes a month.",
        "subtitle": "We sell by the metre — but the loom\ndoesn't care for our calendar.",
        "cta": "@TRESORCOUTURE",
    },
    {
        "name": "instagram-post-weaver-1080",
        "eyebrow": "BEHIND THE LOOM",
        "title": "The Hands\nBehind the Cloth.",
        "subtitle": "Forty master weavers across six states.\nEvery bolt is signed at the selvedge.",
        "cta": "MEET THE ATELIER →",
    },
    {
        "name": "instagram-post-sale-1080",
        "eyebrow": "THE ARCHIVE EVENT",
        "title": "Up to 30% off\nthe last bolts.",
        "subtitle": "Final lengths of the spring archive.\nWhen they're gone, they're gone.",
        "cta": "SHOP THE ARCHIVE →",
    },
]


def social_post_1080(spec):
    W = H = 1080
    im = paper_canvas(W, H).convert("RGBA")
    d = ImageDraw.Draw(im)

    # outer hairline frame
    pad_outer = 56
    d.rectangle(
        [pad_outer, pad_outer, W - pad_outer - 1, H - pad_outer - 1],
        outline=(GOLD[0], GOLD[1], GOLD[2], 200),
        width=1,
    )
    four_corners(im, pad_outer + 24, 28, GOLD, 2)

    # eyebrow (top)
    f_eye = inter(15, "SemiBold")
    draw_letters(d, spec["eyebrow"], f_eye, W // 2, pad_outer + 70, GOLD_DEEP, 6)

    # logo
    paste_logo(im, 240, (W // 2, 290))

    # title (centered, multiline)
    title = spec["title"]
    title_font = cormorant(96, "Light")
    italic_font = cormorant(96, "Italic")
    lines = title.split("\n")
    y = 470
    for i, line in enumerate(lines):
        fnt = italic_font if i == len(lines) - 1 else title_font
        tw, th = text_size(fnt, line)
        d.text((W // 2 - tw // 2 - fnt.getbbox(line)[0], y), line, font=fnt, fill=INK)
        y += int(title_font.size * 1.0)

    # short rule below title
    rule_y = y + 16
    d.line([(W // 2 - 60, rule_y), (W // 2 + 60, rule_y)], fill=GOLD + (220,), width=1)
    d.ellipse([W // 2 - 3, rule_y - 3, W // 2 + 3, rule_y + 3], fill=GOLD)

    # subtitle
    sub_font = inter(26, "Regular")
    sub_lines = spec["subtitle"].split("\n")
    sy = rule_y + 36
    for line in sub_lines:
        tw, th = text_size(sub_font, line)
        d.text((W // 2 - tw // 2 - sub_font.getbbox(line)[0], sy), line, font=sub_font, fill=INK_SOFT)
        sy += int(sub_font.size * 1.5)

    # CTA pill
    cta_font = inter(20, "SemiBold")
    cta = spec["cta"]
    cw, ch = text_size(cta_font, cta)
    pill_w = cw + 80
    pill_h = ch + 32
    px = W // 2 - pill_w // 2
    py = H - pad_outer - 130
    d.rounded_rectangle([px, py, px + pill_w, py + pill_h], radius=pill_h // 2, fill=INK)
    d.text(
        (W // 2 - cw // 2 - cta_font.getbbox(cta)[0], py + pill_h // 2 - ch // 2 - cta_font.getbbox(cta)[1]),
        cta,
        font=cta_font,
        fill=CREAM,
    )

    out = SOCIAL / f"{spec['name']}.png"
    im.convert("RGB").save(str(out).replace(".png", ".jpg"), "JPEG", quality=92, optimize=True)


def social_story_1080x1920(name, eyebrow, title, subtitle, cta="SWIPE UP", italic_last=True):
    W, H = 1080, 1920
    im = paper_canvas(W, H).convert("RGBA")
    d = ImageDraw.Draw(im)

    pad = 64
    d.rectangle([pad, pad, W - pad - 1, H - pad - 1], outline=GOLD + (200,), width=1)
    four_corners(im, pad + 28, 36, GOLD, 2)

    # eyebrow
    draw_letters(d, eyebrow, inter(18, "SemiBold"), W // 2, 200, GOLD_DEEP, 8)

    # logo
    paste_logo(im, 360, (W // 2, 580))

    # title
    title_font = cormorant(120, "Light")
    italic_font = cormorant(120, "Italic")
    lines = title.split("\n")
    y = 900
    for i, line in enumerate(lines):
        fnt = italic_font if italic_last and i == len(lines) - 1 else title_font
        tw, _ = text_size(fnt, line)
        d.text((W // 2 - tw // 2 - fnt.getbbox(line)[0], y), line, font=fnt, fill=INK)
        y += int(title_font.size * 1.05)

    rule_y = y + 24
    d.line([(W // 2 - 80, rule_y), (W // 2 + 80, rule_y)], fill=GOLD + (220,), width=1)
    d.ellipse([W // 2 - 4, rule_y - 4, W // 2 + 4, rule_y + 4], fill=GOLD)

    sub_font = inter(32, "Regular")
    sy = rule_y + 50
    for line in subtitle.split("\n"):
        tw, _ = text_size(sub_font, line)
        d.text((W // 2 - tw // 2 - sub_font.getbbox(line)[0], sy), line, font=sub_font, fill=INK_SOFT)
        sy += int(sub_font.size * 1.5)

    # bottom CTA tap area
    cta_font = inter(26, "SemiBold")
    cw, _ = text_size(cta_font, cta)
    pill_w = cw + 120
    pill_h = 88
    px = W // 2 - pill_w // 2
    py = H - 320
    d.rounded_rectangle([px, py, px + pill_w, py + pill_h], radius=pill_h // 2, fill=INK)
    bbox = cta_font.getbbox(cta)
    d.text((W // 2 - cw // 2 - bbox[0], py + pill_h // 2 - (bbox[3] - bbox[1]) // 2 - bbox[1]), cta, font=cta_font, fill=CREAM)

    # handle below
    handle = "@tresorcouture"
    hf = inter(22, "Medium")
    hw, _ = text_size(hf, handle)
    d.text((W // 2 - hw // 2 - hf.getbbox(handle)[0], py + pill_h + 36), handle, font=hf, fill=GOLD_DEEP)

    im.convert("RGB").save(SOCIAL / f"{name}.jpg", "JPEG", quality=92, optimize=True)


def social_profile_1080():
    """Square profile picture — logo centered on cream within a gold ring."""
    W = H = 1080
    im = paper_canvas(W, H).convert("RGBA")
    d = ImageDraw.Draw(im)
    # outer gold ring
    margin = 40
    d.ellipse([margin, margin, W - margin, H - margin], outline=GOLD, width=4)
    d.ellipse([margin + 16, margin + 16, W - margin - 16, H - margin - 16], outline=GOLD_SOFT, width=1)
    paste_logo(im, 700, (W // 2, H // 2 - 40))
    # micro wordmark
    f = inter(28, "SemiBold")
    txt = "TRÉSOR COUTURE"
    draw_letters(d, txt, f, W // 2, H - 200, INK, 10)
    im.convert("RGB").save(SOCIAL / "instagram-profile-1080.png", "PNG", optimize=True)
    # also resize for fb/twitter/linkedin
    im.convert("RGB").resize((400, 400), Image.LANCZOS).save(SOCIAL / "twitter-profile-400.png", "PNG", optimize=True)
    im.convert("RGB").resize((180, 180), Image.LANCZOS).save(SOCIAL / "facebook-profile-180.png", "PNG", optimize=True)
    im.convert("RGB").resize((300, 300), Image.LANCZOS).save(SOCIAL / "linkedin-logo-300.png", "PNG", optimize=True)
    im.convert("RGB").resize((640, 640), Image.LANCZOS).save(SOCIAL / "whatsapp-business-640.png", "PNG", optimize=True)


def banner(name: str, W: int, H: int, *, paste_logo_w: int, title: str, tagline: str, logo_at=None, title_at=None):
    """Generic horizontal banner (FB cover, Twitter header, LinkedIn, YouTube)."""
    im = paper_canvas(W, H).convert("RGBA")
    d = ImageDraw.Draw(im)

    # subtle gold side rule
    d.line([(40, 40), (40, H - 40)], fill=GOLD + (180,), width=1)
    d.line([(W - 40, 40), (W - 40, H - 40)], fill=GOLD + (180,), width=1)
    deco_corner(im, 60, 60, 26, GOLD, False, False, 2)
    deco_corner(im, W - 60, 60, 26, GOLD, True, False, 2)
    deco_corner(im, 60, H - 60, 26, GOLD, False, True, 2)
    deco_corner(im, W - 60, H - 60, 26, GOLD, True, True, 2)

    # logo
    lx, ly = logo_at if logo_at else (W // 2 - W // 4, H // 2)
    paste_logo(im, paste_logo_w, (lx, ly))

    # right side text
    tx, ty = title_at if title_at else (W // 2 + W // 6, H // 2 - 50)
    title_font = cormorant(max(48, H // 8), "Light")
    italic = cormorant(max(48, H // 8), "Italic")
    # split lines
    lines = title.split("\n")
    cy = ty
    for i, line in enumerate(lines):
        fnt = italic if i == len(lines) - 1 else title_font
        tw, th = text_size(fnt, line)
        d.text((tx - tw // 2 - fnt.getbbox(line)[0], cy), line, font=fnt, fill=INK)
        cy += int(title_font.size * 1.0)

    # rule
    rule_y = cy + 20
    rule_half = max(120, W // 16)
    d.line([(tx - rule_half, rule_y), (tx + rule_half, rule_y)], fill=GOLD + (220,), width=1)
    d.ellipse([tx - 4, rule_y - 4, tx + 4, rule_y + 4], fill=GOLD)

    # tagline
    f_sub = inter(max(18, H // 24), "Medium")
    tw, th = text_size(f_sub, tagline)
    d.text((tx - tw // 2 - f_sub.getbbox(tagline)[0], rule_y + 22), tagline, font=f_sub, fill=INK_SOFT)

    im.convert("RGB").save(SOCIAL / f"{name}.jpg", "JPEG", quality=92, optimize=True)


def build_banners():
    # Facebook cover 1640x624 (safe area ~ centred 820x312)
    banner(
        "facebook-cover-1640x624",
        1640,
        624,
        paste_logo_w=380,
        title="Heritage\nIndian Weaves",
        tagline="Sold by the metre · Shipped worldwide",
        logo_at=(440, 312),
        title_at=(1100, 200),
    )
    # Twitter / X header 1500x500
    banner(
        "twitter-header-1500x500",
        1500,
        500,
        paste_logo_w=300,
        title="Heritage\nIndian Weaves",
        tagline="Sold by the metre · Shipped worldwide",
        logo_at=(400, 250),
        title_at=(1000, 160),
    )
    # LinkedIn banner 1584x396
    banner(
        "linkedin-banner-1584x396",
        1584,
        396,
        paste_logo_w=240,
        title="Heritage Indian Weaves",
        tagline="An atelier rescuing India's dying looms · Est. 2024",
        logo_at=(330, 198),
        title_at=(1000, 150),
    )
    # YouTube banner 2560x1440 (safe area 1546x423 centred)
    banner(
        "youtube-banner-2560x1440",
        2560,
        1440,
        paste_logo_w=540,
        title="Heritage\nIndian Weaves",
        tagline="Films from the atelier · weave stories, fittings, founder notes",
        logo_at=(1015, 720),
        title_at=(1700, 600),
    )


# ----- Pinterest pin -------------------------------------------------------


def build_pinterest_pin():
    W, H = 1000, 1500
    im = paper_canvas(W, H).convert("RGBA")
    d = ImageDraw.Draw(im)

    pad = 50
    d.rectangle([pad, pad, W - pad - 1, H - pad - 1], outline=GOLD + (200,), width=1)
    four_corners(im, pad + 24, 28, GOLD, 2)

    draw_letters(d, "THE TRESOR ATELIER", inter(16, "SemiBold"), W // 2, 130, GOLD_DEEP, 6)

    paste_logo(im, 380, (W // 2, 460))

    # title
    title_font = cormorant(96, "Light")
    italic = cormorant(96, "Italic")
    y = 760
    for i, line in enumerate(["Hand-woven", "Indian fabrics."]):
        fnt = italic if i == 1 else title_font
        tw, _ = text_size(fnt, line)
        d.text((W // 2 - tw // 2 - fnt.getbbox(line)[0], y), line, font=fnt, fill=INK)
        y += int(title_font.size * 1.0)
    rule_y = y + 20
    d.line([(W // 2 - 80, rule_y), (W // 2 + 80, rule_y)], fill=GOLD + (220,), width=1)
    d.ellipse([W // 2 - 3, rule_y - 3, W // 2 + 3, rule_y + 3], fill=GOLD)

    sub = "Banarasi · Patola · Jamdani · Kanjivaram\nPashmina · Chanderi · Mashru"
    f_sub = inter(26, "Regular")
    sy = rule_y + 36
    for line in sub.split("\n"):
        tw, _ = text_size(f_sub, line)
        d.text((W // 2 - tw // 2 - f_sub.getbbox(line)[0], sy), line, font=f_sub, fill=INK_SOFT)
        sy += int(f_sub.size * 1.5)

    cta_font = inter(22, "SemiBold")
    cta = "EXPLORE THE ATELIER →"
    cw, ch = text_size(cta_font, cta)
    pill_w = cw + 80
    pill_h = ch + 32
    px = W // 2 - pill_w // 2
    py = H - 220
    d.rounded_rectangle([px, py, px + pill_w, py + pill_h], radius=pill_h // 2, fill=INK)
    bbox = cta_font.getbbox(cta)
    d.text((W // 2 - cw // 2 - bbox[0], py + pill_h // 2 - (bbox[3] - bbox[1]) // 2 - bbox[1]), cta, font=cta_font, fill=CREAM)

    im.convert("RGB").save(SOCIAL / "pinterest-pin-1000x1500.jpg", "JPEG", quality=92, optimize=True)


# ----- OG default 1200x630 ------------------------------------------------


def build_og_default():
    W, H = 1200, 630
    im = paper_canvas(W, H).convert("RGBA")
    d = ImageDraw.Draw(im)

    pad = 28
    d.rectangle([pad, pad, W - pad - 1, H - pad - 1], outline=GOLD + (200,), width=1)
    four_corners(im, pad + 18, 22, GOLD, 2)

    # left logo
    paste_logo(im, 360, (310, H // 2))

    # right column
    tx = 760
    # eyebrow
    draw_letters(d, "AN INDIAN ATELIER", inter(14, "SemiBold"), tx, 170, GOLD_DEEP, 6)
    # title — 2 lines
    title_font = cormorant(84, "Light")
    italic = cormorant(84, "Italic")
    lines = [("Heritage", title_font), ("Indian Weaves.", italic)]
    cy = 220
    for line, fnt in lines:
        tw, _ = text_size(fnt, line)
        d.text((tx - tw // 2 - fnt.getbbox(line)[0], cy), line, font=fnt, fill=INK)
        cy += int(title_font.size * 0.95)

    # rule
    rule_y = cy + 16
    d.line([(tx - 80, rule_y), (tx + 80, rule_y)], fill=GOLD + (220,), width=1)
    d.ellipse([tx - 3, rule_y - 3, tx + 3, rule_y + 3], fill=GOLD)

    f_sub = inter(22, "Regular")
    sub = "Banarasi · Patola · Jamdani · Kanjivaram · Pashmina\nSold by the metre. Shipped worldwide."
    sy = rule_y + 26
    for line in sub.split("\n"):
        tw, _ = text_size(f_sub, line)
        d.text((tx - tw // 2 - f_sub.getbbox(line)[0], sy), line, font=f_sub, fill=INK_SOFT)
        sy += int(f_sub.size * 1.4)

    im.convert("RGB").save(SOCIAL / "og-default-1200x630.png", "PNG", optimize=True)


# ----- print/brand identity ------------------------------------------------


PRINT_SVGS = {
    # ---- business card front (3.5"x2" @ 300dpi = 1050x600, with 0.125" bleed -> 1125x675)
    "business-card-front.svg": """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="3.625in" height="2.125in" viewBox="0 0 1088 638">
  <title>Trésor Couture — business card (front)</title>
  <desc>Print: 3.5×2 in at 300 dpi with 0.0625 in bleed on every side.</desc>
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#D8B97A"/>
      <stop offset="50%" stop-color="#B8893A"/>
      <stop offset="100%" stop-color="#8E6520"/>
    </linearGradient>
  </defs>

  <!-- bleed background (cream paper) -->
  <rect width="1088" height="638" fill="#F5ECDC"/>

  <!-- safe area frame (do not extend art beyond) -->
  <rect x="56" y="56" width="976" height="526" fill="none" stroke="url(#gold)" stroke-width="0.6" opacity="0.6"/>

  <!-- corners -->
  <g stroke="url(#gold)" stroke-width="1.6" fill="none" stroke-linecap="round">
    <path d="M 88 88 H 116 M 88 88 V 116"/>
    <path d="M 1000 88 H 972 M 1000 88 V 116"/>
    <path d="M 88 550 H 116 M 88 550 V 522"/>
    <path d="M 1000 550 H 972 M 1000 550 V 522"/>
  </g>

  <!-- wordmark, centred -->
  <g text-anchor="middle" font-family="'Cormorant Garamond', 'Times New Roman', serif">
    <text x="544" y="270" font-size="120" font-weight="300" letter-spacing="20" fill="#2A1F12">TRÉSOR</text>
  </g>
  <line x1="380" y1="305" x2="498" y2="305" stroke="url(#gold)" stroke-width="1"/>
  <circle cx="544" cy="305" r="4" fill="url(#gold)"/>
  <line x1="590" y1="305" x2="708" y2="305" stroke="url(#gold)" stroke-width="1"/>
  <text x="544" y="350" text-anchor="middle" font-family="'Inter', sans-serif" font-size="22" letter-spacing="16" font-weight="600" fill="#2A1F12">COUTURE</text>

  <text x="544" y="430" text-anchor="middle" font-family="'Inter', sans-serif" font-size="15" letter-spacing="6" font-weight="500" fill="#8E6520">HERITAGE INDIAN WEAVES</text>
</svg>""",

    "business-card-back.svg": """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="3.625in" height="2.125in" viewBox="0 0 1088 638">
  <title>Trésor Couture — business card (back)</title>
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#D8B97A"/>
      <stop offset="50%" stop-color="#B8893A"/>
      <stop offset="100%" stop-color="#8E6520"/>
    </linearGradient>
  </defs>
  <rect width="1088" height="638" fill="#F5ECDC"/>

  <!-- left: mini mark -->
  <g transform="translate(120 200) scale(2.6)" fill="url(#gold)">
    <path d="M 12 14 L 12 12 Q 12 11 13 11 L 38 11 Q 39 11 39 12 L 39 14 L 36 16 L 17 16 L 14 14 Z"/>
    <path d="M 23 16 L 23 48 L 21 50 L 21 52 L 30 52 L 30 50 L 28 48 L 28 16 Z"/>
  </g>
  <g transform="translate(120 200) scale(2.6)" fill="none" stroke="url(#gold)" stroke-width="3" stroke-linecap="round">
    <path d="M 51 22 C 44 22 40 28 40 34 C 40 40 44 46 51 46"/>
  </g>

  <!-- vertical divider -->
  <line x1="380" y1="160" x2="380" y2="478" stroke="url(#gold)" stroke-width="0.8"/>

  <!-- right: contact block -->
  <g font-family="'Inter', sans-serif" fill="#2A1F12">
    <text x="440" y="220" font-size="34" font-weight="600">{NAME}</text>
    <text x="440" y="262" font-size="20" font-weight="400" fill="#8E6520" letter-spacing="3">{TITLE}</text>

    <line x1="440" y1="296" x2="540" y2="296" stroke="url(#gold)" stroke-width="0.8"/>

    <text x="440" y="346" font-size="20" font-weight="400">{EMAIL}</text>
    <text x="440" y="386" font-size="20" font-weight="400">{PHONE}</text>
    <text x="440" y="426" font-size="20" font-weight="500" fill="#8E6520">tresorcouture.com</text>
    <text x="440" y="466" font-size="17" font-weight="400" fill="#46382A">Atelier · {ADDRESS}</text>
  </g>
</svg>""",
}


LETTERHEAD = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="8.27in" height="11.69in" viewBox="0 0 2480 3508">
  <title>Trésor Couture — letterhead (A4)</title>
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#D8B97A"/>
      <stop offset="50%" stop-color="#B8893A"/>
      <stop offset="100%" stop-color="#8E6520"/>
    </linearGradient>
  </defs>
  <rect width="2480" height="3508" fill="#F5ECDC"/>

  <!-- top mark + wordmark -->
  <g transform="translate(1240 280)">
    <g transform="translate(-380 -40) scale(1.7)" fill="url(#gold)">
      <path d="M 12 14 L 12 12 Q 12 11 13 11 L 38 11 Q 39 11 39 12 L 39 14 L 36 16 L 17 16 L 14 14 Z"/>
      <path d="M 23 16 L 23 56 L 21 58 L 21 60 L 30 58 L 30 56 L 28 54 L 28 16 Z"/>
    </g>
    <g text-anchor="middle" font-family="'Cormorant Garamond', 'Times New Roman', serif" fill="#2A1F12">
      <text font-size="120" font-weight="300" letter-spacing="22">TRÉSOR</text>
      <text y="56" font-size="26" letter-spacing="22" font-family="'Inter', sans-serif" font-weight="600">COUTURE</text>
    </g>
  </g>

  <!-- gold double rule -->
  <line x1="240" y1="430" x2="2240" y2="430" stroke="url(#gold)" stroke-width="1.4"/>
  <line x1="240" y1="442" x2="2240" y2="442" stroke="url(#gold)" stroke-width="0.6" opacity="0.7"/>

  <!-- writing area marker (faint) -->
  <text x="240" y="540" font-family="'Inter', sans-serif" font-size="22" fill="#8E6520" letter-spacing="6" font-weight="600">DATE · RECIPIENT</text>

  <!-- footer -->
  <line x1="240" y1="3260" x2="2240" y2="3260" stroke="url(#gold)" stroke-width="0.8"/>
  <g font-family="'Inter', sans-serif" fill="#46382A" text-anchor="middle">
    <text x="1240" y="3310" font-size="22" letter-spacing="4">Trésor Couture · Heritage Indian Weaves</text>
    <text x="1240" y="3346" font-size="20" fill="#8E6520">concierge@tresorcouture.com  ·  +91 80 1234 5678  ·  tresorcouture.com</text>
    <text x="1240" y="3388" font-size="18">Atelier · 14 Cunningham Crescent, Bengaluru 560 052, India</text>
  </g>
</svg>
"""


INVOICE = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="8.27in" height="11.69in" viewBox="0 0 2480 3508">
  <title>Trésor Couture — invoice template</title>
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#D8B97A"/>
      <stop offset="50%" stop-color="#B8893A"/>
      <stop offset="100%" stop-color="#8E6520"/>
    </linearGradient>
  </defs>
  <rect width="2480" height="3508" fill="#F5ECDC"/>

  <!-- header -->
  <g font-family="'Cormorant Garamond', 'Times New Roman', serif">
    <text x="240" y="320" font-size="120" font-weight="300" letter-spacing="22" fill="#2A1F12">TRÉSOR</text>
    <text x="240" y="370" font-size="26" letter-spacing="16" font-family="'Inter', sans-serif" font-weight="600" fill="#2A1F12">COUTURE</text>
  </g>
  <g text-anchor="end" font-family="'Cormorant Garamond', serif" fill="#8E6520">
    <text x="2240" y="280" font-size="80" font-weight="300" letter-spacing="14">INVOICE</text>
  </g>
  <line x1="240" y1="420" x2="2240" y2="420" stroke="url(#gold)" stroke-width="1.4"/>

  <!-- meta -->
  <g font-family="'Inter', sans-serif" fill="#2A1F12">
    <text x="240" y="500" font-size="22" font-weight="600" letter-spacing="4" fill="#8E6520">BILL TO</text>
    <text x="240" y="546" font-size="26">{CUSTOMER_NAME}</text>
    <text x="240" y="586" font-size="22">{CUSTOMER_ADDRESS_1}</text>
    <text x="240" y="622" font-size="22">{CUSTOMER_ADDRESS_2}</text>

    <text x="1700" y="500" font-size="22" font-weight="600" letter-spacing="4" fill="#8E6520">INVOICE</text>
    <text x="1700" y="546" font-size="22">No.  {INVOICE_NO}</text>
    <text x="1700" y="586" font-size="22">Date {INVOICE_DATE}</text>
    <text x="1700" y="622" font-size="22">Due  {DUE_DATE}</text>
  </g>

  <!-- table header -->
  <rect x="240" y="780" width="2000" height="56" fill="#EAD9BA"/>
  <g font-family="'Inter', sans-serif" font-size="20" font-weight="600" fill="#2A1F12" letter-spacing="3">
    <text x="260" y="816">ITEM</text>
    <text x="1500" y="816">METRES</text>
    <text x="1740" y="816">RATE</text>
    <text x="2220" y="816" text-anchor="end">AMOUNT</text>
  </g>

  <!-- table rows (placeholders) -->
  <g font-family="'Inter', sans-serif" font-size="22" fill="#2A1F12">
    <text x="260" y="900">{ITEM_1_NAME}</text>
    <text x="1500" y="900">{ITEM_1_MTR}</text>
    <text x="1740" y="900">{ITEM_1_RATE}</text>
    <text x="2220" y="900" text-anchor="end">{ITEM_1_AMOUNT}</text>
    <line x1="240" y1="930" x2="2240" y2="930" stroke="#2A1F12" stroke-opacity="0.12"/>

    <text x="260" y="990">{ITEM_2_NAME}</text>
    <text x="1500" y="990">{ITEM_2_MTR}</text>
    <text x="1740" y="990">{ITEM_2_RATE}</text>
    <text x="2220" y="990" text-anchor="end">{ITEM_2_AMOUNT}</text>
    <line x1="240" y1="1020" x2="2240" y2="1020" stroke="#2A1F12" stroke-opacity="0.12"/>

    <text x="260" y="1080">{ITEM_3_NAME}</text>
    <text x="1500" y="1080">{ITEM_3_MTR}</text>
    <text x="1740" y="1080">{ITEM_3_RATE}</text>
    <text x="2220" y="1080" text-anchor="end">{ITEM_3_AMOUNT}</text>
    <line x1="240" y1="1110" x2="2240" y2="1110" stroke="#2A1F12" stroke-opacity="0.12"/>
  </g>

  <!-- totals -->
  <g font-family="'Inter', sans-serif" fill="#2A1F12">
    <text x="1700" y="1340" font-size="22">Subtotal</text>
    <text x="2220" y="1340" font-size="22" text-anchor="end">{SUBTOTAL}</text>
    <text x="1700" y="1390" font-size="22">GST 5%</text>
    <text x="2220" y="1390" font-size="22" text-anchor="end">{GST}</text>
    <text x="1700" y="1440" font-size="22">Shipping</text>
    <text x="2220" y="1440" font-size="22" text-anchor="end">{SHIPPING}</text>
    <line x1="1700" y1="1470" x2="2240" y2="1470" stroke="url(#gold)" stroke-width="1"/>
    <text x="1700" y="1520" font-size="28" font-weight="700">TOTAL</text>
    <text x="2220" y="1520" font-size="28" font-weight="700" text-anchor="end" fill="#8E6520">{TOTAL}</text>
  </g>

  <!-- footer / payment -->
  <line x1="240" y1="3260" x2="2240" y2="3260" stroke="url(#gold)" stroke-width="0.8"/>
  <g font-family="'Inter', sans-serif" fill="#46382A" text-anchor="middle">
    <text x="1240" y="3320" font-size="22">Payable to · Trésor Couture · A/c 1234567890 · IFSC HDFC0001234</text>
    <text x="1240" y="3360" font-size="20" fill="#8E6520">concierge@tresorcouture.com  ·  tresorcouture.com</text>
  </g>
</svg>
"""

THANK_YOU = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="5in" height="7in" viewBox="0 0 1500 2100">
  <title>Trésor Couture — thank you card</title>
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#D8B97A"/>
      <stop offset="50%" stop-color="#B8893A"/>
      <stop offset="100%" stop-color="#8E6520"/>
    </linearGradient>
  </defs>
  <rect width="1500" height="2100" fill="#F5ECDC"/>
  <rect x="70" y="70" width="1360" height="1960" fill="none" stroke="url(#gold)" stroke-width="1.2" opacity="0.7"/>
  <g stroke="url(#gold)" stroke-width="2" fill="none" stroke-linecap="round">
    <path d="M 130 130 H 180 M 130 130 V 180"/>
    <path d="M 1370 130 H 1320 M 1370 130 V 180"/>
    <path d="M 130 1970 H 180 M 130 1970 V 1920"/>
    <path d="M 1370 1970 H 1320 M 1370 1970 V 1920"/>
  </g>

  <g text-anchor="middle">
    <text x="750" y="380" font-family="'Inter', sans-serif" font-size="22" letter-spacing="10" font-weight="600" fill="#8E6520">AN ATELIER NOTE</text>
    <text x="750" y="640" font-family="'Cormorant Garamond', serif" font-size="180" font-weight="300" fill="#2A1F12">Thank you</text>
    <text x="750" y="800" font-family="'Cormorant Garamond', serif" font-size="120" font-style="italic" font-weight="300" fill="#2A1F12">for choosing the loom.</text>
    <line x1="600" y1="900" x2="900" y2="900" stroke="url(#gold)" stroke-width="1"/>
    <circle cx="750" cy="900" r="6" fill="url(#gold)"/>

    <g font-family="'Inter', sans-serif" font-size="26" fill="#2A1F12">
      <text x="750" y="1080">Your fabric has travelled</text>
      <text x="750" y="1130">from a master weaver's hands</text>
      <text x="750" y="1180">to yours. Wear it like an heirloom.</text>
    </g>

    <text x="750" y="1480" font-family="'Cormorant Garamond', serif" font-size="42" font-style="italic" font-weight="300" fill="#46382A">— The Trésor Atelier</text>

    <line x1="600" y1="1840" x2="900" y2="1840" stroke="url(#gold)" stroke-width="0.8"/>
    <text x="750" y="1900" font-family="'Inter', sans-serif" font-size="22" fill="#8E6520" letter-spacing="6" font-weight="600">TRÉSORCOUTURE.COM</text>
  </g>
</svg>
"""

CARE_CARD = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="4in" height="6in" viewBox="0 0 1200 1800">
  <title>Trésor Couture — fabric care card</title>
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#D8B97A"/>
      <stop offset="50%" stop-color="#B8893A"/>
      <stop offset="100%" stop-color="#8E6520"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1800" fill="#F5ECDC"/>
  <rect x="60" y="60" width="1080" height="1680" fill="none" stroke="url(#gold)" stroke-width="1" opacity="0.7"/>

  <g text-anchor="middle">
    <text x="600" y="220" font-family="'Inter', sans-serif" font-size="20" letter-spacing="8" font-weight="600" fill="#8E6520">FABRIC CARE</text>
    <text x="600" y="380" font-family="'Cormorant Garamond', serif" font-size="100" font-weight="300" fill="#2A1F12">For the long</text>
    <text x="600" y="500" font-family="'Cormorant Garamond', serif" font-size="100" font-style="italic" font-weight="300" fill="#2A1F12">life of your weave.</text>
    <line x1="480" y1="580" x2="720" y2="580" stroke="url(#gold)" stroke-width="1"/>
    <circle cx="600" cy="580" r="5" fill="url(#gold)"/>
  </g>

  <g font-family="'Inter', sans-serif" fill="#2A1F12">
    <g transform="translate(120 720)">
      <text x="0" y="0" font-size="22" font-weight="700" letter-spacing="4" fill="#8E6520">01 · DRY CLEAN</text>
      <text x="0" y="40" font-size="22">First wash, always. Then hand-wash</text>
      <text x="0" y="74" font-size="22">in cold water, mild soap.</text>
    </g>
    <g transform="translate(120 900)">
      <text x="0" y="0" font-size="22" font-weight="700" letter-spacing="4" fill="#8E6520">02 · NO SUN</text>
      <text x="0" y="40" font-size="22">Dry flat in shade. Direct sun</text>
      <text x="0" y="74" font-size="22">fades natural dyes.</text>
    </g>
    <g transform="translate(120 1080)">
      <text x="0" y="0" font-size="22" font-weight="700" letter-spacing="4" fill="#8E6520">03 · LOW IRON</text>
      <text x="0" y="40" font-size="22">Iron inside-out on silk setting.</text>
      <text x="0" y="74" font-size="22">A pressing cloth helps the zari.</text>
    </g>
    <g transform="translate(120 1260)">
      <text x="0" y="0" font-size="22" font-weight="700" letter-spacing="4" fill="#8E6520">04 · BREATHE</text>
      <text x="0" y="40" font-size="22">Store in muslin. Refold along a</text>
      <text x="0" y="74" font-size="22">different line every season.</text>
    </g>
  </g>

  <text x="600" y="1680" text-anchor="middle" font-family="'Inter', sans-serif" font-size="20" letter-spacing="6" font-weight="600" fill="#8E6520">TRÉSORCOUTURE.COM</text>
</svg>
"""

HANGTAG = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2.5in" height="4in" viewBox="0 0 750 1200">
  <title>Trésor Couture — fabric hangtag</title>
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#D8B97A"/>
      <stop offset="50%" stop-color="#B8893A"/>
      <stop offset="100%" stop-color="#8E6520"/>
    </linearGradient>
  </defs>

  <!-- tag shape with rounded top and notched corners -->
  <path d="M 60 220 L 60 1140 Q 60 1180 100 1180 L 650 1180 Q 690 1180 690 1140 L 690 220 L 410 60 L 340 60 Z"
        fill="#F5ECDC" stroke="url(#gold)" stroke-width="2"/>
  <!-- punch hole -->
  <circle cx="375" cy="140" r="32" fill="none" stroke="url(#gold)" stroke-width="2"/>
  <circle cx="375" cy="140" r="22" fill="none" stroke="#8E6520" stroke-width="1" opacity="0.7"/>

  <!-- mini mark -->
  <g transform="translate(295 270) scale(2.5)" fill="url(#gold)">
    <path d="M 12 14 L 12 12 Q 12 11 13 11 L 38 11 Q 39 11 39 12 L 39 14 L 36 16 L 17 16 L 14 14 Z"/>
    <path d="M 23 16 L 23 48 L 21 50 L 21 52 L 30 52 L 30 50 L 28 48 L 28 16 Z"/>
  </g>
  <g transform="translate(295 270) scale(2.5)" fill="none" stroke="url(#gold)" stroke-width="3" stroke-linecap="round">
    <path d="M 51 22 C 44 22 40 28 40 34 C 40 40 44 46 51 46"/>
  </g>

  <g text-anchor="middle">
    <text x="375" y="500" font-family="'Cormorant Garamond', serif" font-size="46" font-weight="300" fill="#2A1F12" letter-spacing="6">TRÉSOR</text>
    <text x="375" y="538" font-family="'Inter', sans-serif" font-size="16" font-weight="600" letter-spacing="8" fill="#2A1F12">COUTURE</text>
    <line x1="295" y1="580" x2="455" y2="580" stroke="url(#gold)" stroke-width="0.8"/>
    <text x="375" y="650" font-family="'Inter', sans-serif" font-size="16" font-weight="600" letter-spacing="6" fill="#8E6520">WEAVE</text>
    <text x="375" y="700" font-family="'Cormorant Garamond', serif" font-size="36" font-style="italic" font-weight="300" fill="#2A1F12">{WEAVE_NAME}</text>
    <text x="375" y="780" font-family="'Inter', sans-serif" font-size="16" font-weight="600" letter-spacing="6" fill="#8E6520">ORIGIN</text>
    <text x="375" y="820" font-family="'Inter', sans-serif" font-size="22" fill="#2A1F12">{ORIGIN}</text>
    <text x="375" y="900" font-family="'Inter', sans-serif" font-size="16" font-weight="600" letter-spacing="6" fill="#8E6520">WEAVER</text>
    <text x="375" y="940" font-family="'Inter', sans-serif" font-size="22" fill="#2A1F12">{WEAVER}</text>
    <line x1="200" y1="1000" x2="550" y2="1000" stroke="url(#gold)" stroke-width="0.8"/>
    <text x="375" y="1060" font-family="'Inter', sans-serif" font-size="18" fill="#2A1F12">₹ {PRICE} / metre</text>
    <text x="375" y="1130" font-family="'Inter', sans-serif" font-size="14" letter-spacing="6" font-weight="600" fill="#8E6520">TRÉSORCOUTURE.COM</text>
  </g>
</svg>
"""

PACKING_SLIP = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="8.27in" height="11.69in" viewBox="0 0 2480 3508">
  <title>Trésor Couture — packing slip</title>
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#D8B97A"/>
      <stop offset="50%" stop-color="#B8893A"/>
      <stop offset="100%" stop-color="#8E6520"/>
    </linearGradient>
  </defs>
  <rect width="2480" height="3508" fill="#F5ECDC"/>

  <g font-family="'Cormorant Garamond', serif">
    <text x="240" y="320" font-size="120" font-weight="300" letter-spacing="22" fill="#2A1F12">TRÉSOR</text>
    <text x="240" y="370" font-size="26" letter-spacing="16" font-family="'Inter', sans-serif" font-weight="600" fill="#2A1F12">COUTURE</text>
  </g>
  <g text-anchor="end" font-family="'Cormorant Garamond', serif" fill="#8E6520">
    <text x="2240" y="280" font-size="70" font-weight="300" letter-spacing="14">PACKING SLIP</text>
  </g>
  <line x1="240" y1="420" x2="2240" y2="420" stroke="url(#gold)" stroke-width="1.4"/>

  <g font-family="'Inter', sans-serif" fill="#2A1F12">
    <text x="240" y="500" font-size="22" font-weight="600" letter-spacing="4" fill="#8E6520">SHIP TO</text>
    <text x="240" y="546" font-size="26">{NAME}</text>
    <text x="240" y="586" font-size="22">{ADDRESS_1}</text>
    <text x="240" y="622" font-size="22">{ADDRESS_2}</text>
    <text x="240" y="660" font-size="22">{CITY_PIN}</text>

    <text x="1700" y="500" font-size="22" font-weight="600" letter-spacing="4" fill="#8E6520">ORDER</text>
    <text x="1700" y="546" font-size="22">No.  {ORDER_NO}</text>
    <text x="1700" y="586" font-size="22">Date {ORDER_DATE}</text>
    <text x="1700" y="622" font-size="22">AWB  {AWB}</text>
  </g>

  <rect x="240" y="780" width="2000" height="56" fill="#EAD9BA"/>
  <g font-family="'Inter', sans-serif" font-size="20" font-weight="600" fill="#2A1F12" letter-spacing="3">
    <text x="260" y="816">WEAVE</text>
    <text x="1500" y="816">METRES</text>
    <text x="1800" y="816">CODE</text>
  </g>

  <g font-family="'Inter', sans-serif" font-size="22" fill="#2A1F12">
    <text x="260" y="900">{LINE_1}</text>
    <text x="260" y="980">{LINE_2}</text>
    <text x="260" y="1060">{LINE_3}</text>
  </g>

  <line x1="240" y1="3120" x2="2240" y2="3120" stroke="url(#gold)" stroke-width="0.8"/>
  <g font-family="'Cormorant Garamond', serif" text-anchor="middle" fill="#2A1F12">
    <text x="1240" y="3210" font-size="46" font-style="italic" font-weight="300">Worn well, the weave outlives its weaver.</text>
  </g>
  <g font-family="'Inter', sans-serif" text-anchor="middle" fill="#46382A">
    <text x="1240" y="3300" font-size="22">Returns within 30 days · concierge@tresorcouture.com · +91 80 1234 5678</text>
    <text x="1240" y="3340" font-size="20" fill="#8E6520" letter-spacing="6" font-weight="600">TRÉSORCOUTURE.COM</text>
  </g>
</svg>
"""

STICKER_SEAL = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2in" height="2in" viewBox="0 0 600 600">
  <title>Trésor Couture — wax seal sticker (round, 2in)</title>
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#D8B97A"/>
      <stop offset="50%" stop-color="#B8893A"/>
      <stop offset="100%" stop-color="#8E6520"/>
    </linearGradient>
  </defs>
  <circle cx="300" cy="300" r="290" fill="#F5ECDC" stroke="url(#gold)" stroke-width="6"/>
  <circle cx="300" cy="300" r="262" fill="none" stroke="url(#gold)" stroke-width="1"/>

  <g transform="translate(252 200) scale(2.0)" fill="url(#gold)">
    <path d="M 12 14 L 12 12 Q 12 11 13 11 L 38 11 Q 39 11 39 12 L 39 14 L 36 16 L 17 16 L 14 14 Z"/>
    <path d="M 23 16 L 23 48 L 21 50 L 21 52 L 30 52 L 30 50 L 28 48 L 28 16 Z"/>
  </g>
  <g transform="translate(252 200) scale(2.0)" fill="none" stroke="url(#gold)" stroke-width="3" stroke-linecap="round">
    <path d="M 51 22 C 44 22 40 28 40 34 C 40 40 44 46 51 46"/>
  </g>

  <text x="300" y="420" text-anchor="middle" font-family="'Cormorant Garamond', serif" font-size="34" font-style="italic" font-weight="300" fill="#2A1F12">sealed at the atelier</text>
  <line x1="220" y1="450" x2="380" y2="450" stroke="url(#gold)" stroke-width="0.8"/>
  <text x="300" y="500" text-anchor="middle" font-family="'Inter', sans-serif" font-size="18" letter-spacing="8" font-weight="600" fill="#8E6520">TRÉSOR COUTURE</text>
</svg>
"""

EMAIL_SIG_HTML = """<!--
  Trésor Couture — email signature.
  Paste into Gmail / Apple Mail / Outlook "stationery". Inline styles are mandatory.
  Edit the four spans marked DATA-EDIT.
-->
<table cellpadding="0" cellspacing="0" border="0" style="font-family:Inter,Arial,sans-serif;color:#2A1F12;background:#F5ECDC;padding:18px;border-radius:6px;">
  <tr>
    <td style="vertical-align:top;padding-right:22px;border-right:1px solid #B8893A;">
      <!-- mini mark -->
      <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sig-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#D8B97A"/>
            <stop offset="50%" stop-color="#B8893A"/>
            <stop offset="100%" stop-color="#8E6520"/>
          </linearGradient>
        </defs>
        <g fill="url(#sig-gold)">
          <path d="M 12 14 L 12 12 Q 12 11 13 11 L 38 11 Q 39 11 39 12 L 39 14 L 36 16 L 17 16 L 14 14 Z"/>
          <path d="M 23 16 L 23 48 L 21 50 L 21 52 L 30 52 L 30 50 L 28 48 L 28 16 Z"/>
        </g>
        <g fill="none" stroke="url(#sig-gold)" stroke-width="3" stroke-linecap="round">
          <path d="M 51 22 C 44 22 40 28 40 34 C 40 40 44 46 51 46"/>
        </g>
      </svg>
    </td>
    <td style="vertical-align:top;padding-left:22px;">
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:600;color:#2A1F12;letter-spacing:2px;">TRÉSOR COUTURE</div>
      <div style="font-size:11px;color:#8E6520;letter-spacing:4px;font-weight:600;margin-top:2px;">HERITAGE INDIAN WEAVES</div>
      <div style="height:1px;background:#B8893A;opacity:0.5;margin:10px 0;width:240px;"></div>
      <div style="font-size:14px;font-weight:600;"><span>{NAME}</span></div>
      <div style="font-size:12px;color:#46382A;"><span>{TITLE}</span></div>
      <div style="font-size:12px;margin-top:6px;color:#46382A;">
        <a href="mailto:{EMAIL}" style="color:#8E6520;text-decoration:none;">{EMAIL}</a> ·
        <span>{PHONE}</span> ·
        <a href="https://tresorcouture.com" style="color:#8E6520;text-decoration:none;">tresorcouture.com</a>
      </div>
    </td>
  </tr>
</table>
"""


def build_print():
    for name, content in PRINT_SVGS.items():
        (PRINT / name).write_text(content)
    (PRINT / "letterhead.svg").write_text(LETTERHEAD)
    (PRINT / "invoice-template.svg").write_text(INVOICE)
    (PRINT / "thank-you-card.svg").write_text(THANK_YOU)
    (PRINT / "care-card.svg").write_text(CARE_CARD)
    (PRINT / "hangtag.svg").write_text(HANGTAG)
    (PRINT / "packing-slip.svg").write_text(PACKING_SLIP)
    (PRINT / "sticker-seal.svg").write_text(STICKER_SEAL)
    (PRINT / "email-signature.html").write_text(EMAIL_SIG_HTML)


# ----- stories ------------------------------------------------------------


STORIES = [
    ("instagram-story-launch-1080x1920", "AN ATELIER OPENS",
     "The Weaves\nReturn Home",
     "Banarasi · Patola · Jamdani · Kanjivaram · Pashmina\nNow open at tresorcouture.com",
     "SHOP NOW"),
    ("instagram-story-product-1080x1920", "WEAVE STORY",
     "Patola,\ntwice tied.",
     "Double-ikat silks dyed thread-by-thread\nin the courtyards of Patan.",
     "VIEW THIS BOLT"),
    ("instagram-story-sale-1080x1920", "THE ARCHIVE EVENT",
     "Up to 30% off\nthe last bolts.",
     "Final lengths of the spring archive.\nThree days. Then gone.",
     "SHOP THE ARCHIVE"),
    ("instagram-reel-cover-1080x1920", "INSIDE THE ATELIER",
     "Watch a metre\nbecome.",
     "From thread to selvedge, one weaver, one shuttle.",
     "TAP TO WATCH"),
]


def build_stories():
    for name, eye, title, sub, cta in STORIES:
        social_story_1080x1920(name, eye, title, sub, cta)


# ----- public mirror ------------------------------------------------------


def mirror_to_public():
    """Copy generated rasters into /public/branding so the site can serve them."""
    import shutil

    public_root = ROOT.parent / "public" / "branding"
    src_dirs = [FAVI, SOCIAL]
    for d in src_dirs:
        dest = public_root / d.name
        dest.mkdir(parents=True, exist_ok=True)
        for p in d.iterdir():
            if p.is_file():
                shutil.copy2(p, dest / p.name)
    # Top-level master assets the site references directly (Navbar, admin kit page, etc.)
    public_root.mkdir(parents=True, exist_ok=True)
    for fname in (
        "master-logo.png",
        "master-logo-trim.png",
        "mark-master.png",
        "monogram-master.png",
        "monogram.svg",
        "mark.svg",
        "wordmark.svg",
        "horizontal.svg",
        "palette.json",
    ):
        p = ROOT / fname
        if p.exists():
            shutil.copy2(p, public_root / fname)


# ----- main --------------------------------------------------------------


def main():
    for d in (SOCIAL, FAVI, PRINT):
        d.mkdir(parents=True, exist_ok=True)
    print("⌁ favicons")
    build_favicons()
    print("⌁ social posts")
    for spec in POSTS:
        social_post_1080(spec)
    print("⌁ stories")
    build_stories()
    print("⌁ profile pics")
    social_profile_1080()
    print("⌁ banners")
    build_banners()
    print("⌁ pinterest")
    build_pinterest_pin()
    print("⌁ og default")
    build_og_default()
    print("⌁ print")
    build_print()
    print("⌁ mirror to /public/branding")
    mirror_to_public()
    print("done.")


if __name__ == "__main__":
    main()
