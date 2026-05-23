"""
Tresor Couture — Instagram kit renderer.

Usage:
    python render.py video <index 0..19>
    python render.py post  <index 0..29>
    python render.py all                  # serial, for sanity tests

Designed for parallel invocation via xargs / GNU parallel. Each call is
stateless and writes exactly one output file.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

from specs import VIDEOS, POSTS, ROOT, OUT_V, OUT_P

# ---------------------------------------------------------------------------
# Brand constants
# ---------------------------------------------------------------------------

BRAND_BG        = (245, 236, 220)   # #F5ECDC — primary cream
BRAND_BG_SOFT   = (251, 245, 234)   # #FBF5EA
BRAND_INK       = (42, 31, 18)      # #2A1F12
BRAND_GOLD      = (184, 137, 58)    # #B8893A
BRAND_GOLD_SOFT = (216, 185, 122)   # #D8B97A
BRAND_GOLD_DEEP = (142, 101, 32)    # #8E6520
BRAND_ACCENT    = (234, 217, 186)   # #EAD9BA

FONT_DIR  = Path("/home/user/Tresor-Couture/branding/_fonts")
# The master mark — painted TC monogram with figure + floral flourish, NO
# wordmark. Same asset the navbar uses on the homepage. Earlier renders
# wrongly used master-logo-filled.png, which has the TRESOR COUTURE
# wordmark baked in and read as a duplicate when the kit's own
# typography sat below it.
LOGO_PATH = Path("/home/user/Tresor-Couture/branding/mark-master.png")
ENDCARD   = Path("/home/user/Tresor-Couture/branding/launch/endcard_image_1080x1920.png")

HANDLE = "@tresor.couture"

VIDEO_W, VIDEO_H = 1080, 1920
POST_W,  POST_H  = 1080, 1350
FPS = 30

def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    table = {
        "serif-bold":    "Cormorant-Bold.ttf",
        "serif-semi":    "Cormorant-SemiBold.ttf",
        "serif-medium":  "Cormorant-Medium.ttf",
        "serif-regular": "Cormorant-Regular.ttf",
        "serif-italic":  "Cormorant-Italic.ttf",
        "serif-light":   "Cormorant-Light.ttf",
        "sans-bold":     "Inter-Bold.ttf",
        "sans-semi":     "Inter-SemiBold.ttf",
        "sans-medium":   "Inter-Medium.ttf",
        "sans-regular":  "Inter-Regular.ttf",
        "sans-light":    "Inter-Light.ttf",
    }
    return ImageFont.truetype(str(FONT_DIR / table[weight]), size)


# ---------------------------------------------------------------------------
# Drawing primitives
# ---------------------------------------------------------------------------

def wrap_centered(draw: ImageDraw.ImageDraw, text: str, fnt, max_w: int) -> list[str]:
    """Greedy word-wrap that respects existing line breaks."""
    out: list[str] = []
    for paragraph in text.split("\n"):
        words = paragraph.split()
        if not words:
            out.append("")
            continue
        line = words[0]
        for w in words[1:]:
            trial = f"{line} {w}"
            if draw.textlength(trial, font=fnt) <= max_w:
                line = trial
            else:
                out.append(line)
                line = w
        out.append(line)
    return out


def draw_text_block(img: Image.Image, lines: list[str], fnt, fill, top: int,
                    line_gap: float = 1.18, letter_space: int = 0) -> int:
    """Draw center-anchored multi-line text. Returns y after last line."""
    draw = ImageDraw.Draw(img)
    asc, desc = fnt.getmetrics()
    line_h = int((asc + desc) * line_gap)
    y = top
    cx = img.width // 2
    for line in lines:
        if letter_space and line:
            chars = list(line)
            widths = [draw.textlength(c, font=fnt) for c in chars]
            total = sum(widths) + letter_space * (len(chars) - 1)
            x = cx - total / 2
            for c, w in zip(chars, widths):
                draw.text((x, y), c, font=fnt, fill=fill)
                x += w + letter_space
        else:
            w = draw.textlength(line, font=fnt)
            draw.text((cx - w / 2, y), line, font=fnt, fill=fill)
        y += line_h
    return y


def gold_rule(img: Image.Image, cx: int, cy: int, width: int = 220):
    """Thin gold horizontal rule with a tiny diamond at center."""
    draw = ImageDraw.Draw(img)
    draw.line([(cx - width // 2, cy), (cx + width // 2, cy)],
              fill=BRAND_GOLD, width=2)
    # diamond
    s = 6
    draw.polygon([(cx, cy - s), (cx + s, cy), (cx, cy + s), (cx - s, cy)],
                 fill=BRAND_GOLD)


def gradient_bg(size: tuple[int, int]) -> Image.Image:
    """Warm cream canvas with subtle vertical gold wash."""
    w, h = size
    img = Image.new("RGB", size, BRAND_BG)
    overlay = Image.new("RGB", (1, h), BRAND_BG)
    px = overlay.load()
    for y in range(h):
        t = y / max(1, h - 1)
        # subtle dip toward warmer cream near vertical center
        k = 1 - 0.15 * (1 - abs(2 * t - 1))
        r = int(BRAND_BG[0] * k + BRAND_ACCENT[0] * (1 - k))
        g = int(BRAND_BG[1] * k + BRAND_ACCENT[1] * (1 - k))
        b = int(BRAND_BG[2] * k + BRAND_ACCENT[2] * (1 - k))
        px[0, y] = (r, g, b)
    overlay = overlay.resize((w, h), Image.BILINEAR)
    img.paste(overlay, (0, 0))
    # vignette
    vig = Image.new("L", size, 0)
    vdraw = ImageDraw.Draw(vig)
    margin = int(min(w, h) * 0.06)
    vdraw.rounded_rectangle(
        [margin, margin, w - margin, h - margin],
        radius=24, fill=255,
    )
    vig = vig.filter(ImageFilter.GaussianBlur(radius=120))
    dark = Image.new("RGB", size, (220, 207, 184))
    img = Image.composite(img, dark, vig)
    return img


# ---------------------------------------------------------------------------
# Logo / monogram
# ---------------------------------------------------------------------------

def paste_monogram(canvas: Image.Image, top_y: int, target_h: int):
    """Paste the brand monogram (master-logo-filled) center-top."""
    logo = Image.open(LOGO_PATH).convert("RGBA")
    ratio = target_h / logo.height
    logo = logo.resize((int(logo.width * ratio), target_h), Image.LANCZOS)
    x = (canvas.width - logo.width) // 2
    canvas.paste(logo, (x, top_y), logo)


def draw_wordmark(canvas: Image.Image, y: int, sub: str | None = None):
    """Cormorant-set TRESOR · COUTURE wordmark."""
    draw = ImageDraw.Draw(canvas)
    fnt = font("serif-semi", 64)
    text = "TRESOR  ·  COUTURE"
    w = draw.textlength(text, font=fnt)
    draw.text(((canvas.width - w) / 2, y), text, font=fnt, fill=BRAND_INK)
    if sub:
        sfnt = font("sans-medium", 22)
        sw = draw.textlength(sub, font=sfnt)
        draw.text(((canvas.width - sw) / 2, y + 80), sub, font=sfnt, fill=BRAND_GOLD)


# ---------------------------------------------------------------------------
# Frame builders
# ---------------------------------------------------------------------------

def build_video_hook_frame(spec: dict) -> Image.Image:
    """The thumb-stop frame.

    Optimised for IG Reels hook conversion: brand mark small and high so
    the hook copy occupies the central 1080×1080 zone (the part that
    survives every IG crop — feed, profile grid, explore tab). Hook
    text is BOLD italic (was light italic, which read weakly at
    phone-scroll size). Mark uses mark-master.png — the painted figure
    on the TC letters with no wordmark — same asset the homepage uses.
    """
    img = gradient_bg((VIDEO_W, VIDEO_H))
    draw = ImageDraw.Draw(img)

    # Mark sized down and pushed up so the headline owns the centre.
    paste_monogram(img, top_y=210, target_h=300)

    # tiny eyebrow category label, sat between mark and headline
    cat_fnt = font("sans-semi", 26)
    chars = list(spec["category"])
    widths = [draw.textlength(c, font=cat_fnt) for c in chars]
    track = 7
    total = sum(widths) + track * (len(chars) - 1)
    x = (VIDEO_W - total) / 2
    cy = 600
    for c, w in zip(chars, widths):
        draw.text((x, cy), c, font=cat_fnt, fill=BRAND_GOLD)
        x += w + track

    gold_rule(img, VIDEO_W // 2, 670, width=220)

    # THE HOOK — bold italic serif at a size meant to stop the thumb.
    # Cormorant-SemiBold renders thicker than -Italic at the same px
    # size and reads cleanly even on a 5" phone scrolled fast.
    hook_fnt = font("serif-bold", 110)
    lines = wrap_centered(draw, spec["hook"], hook_fnt, int(VIDEO_W * 0.86))
    draw_text_block(img, lines, hook_fnt, BRAND_INK, top=820, line_gap=1.05)

    # bottom handle
    h_fnt = font("sans-medium", 28)
    hw = draw.textlength(HANDLE, font=h_fnt)
    draw.text(((VIDEO_W - hw) / 2, VIDEO_H - 130), HANDLE, font=h_fnt, fill=BRAND_INK)

    return img


def build_video_body_frame(spec: dict) -> Image.Image:
    """2-5.5s: hook smaller at top, body lines as editorial copy."""
    img = gradient_bg((VIDEO_W, VIDEO_H))
    draw = ImageDraw.Draw(img)

    # category small at top
    cat_fnt = font("sans-semi", 22)
    chars = list(spec["category"])
    widths = [draw.textlength(c, font=cat_fnt) for c in chars]
    track = 6
    total = sum(widths) + track * (len(chars) - 1)
    x = (VIDEO_W - total) / 2
    cy = 240
    for c, w in zip(chars, widths):
        draw.text((x, cy), c, font=cat_fnt, fill=BRAND_GOLD)
        x += w + track

    gold_rule(img, VIDEO_W // 2, 320, width=180)

    # the hook as smaller header
    hook_fnt = font("serif-italic", 64)
    lines = wrap_centered(draw, spec["hook"], hook_fnt, int(VIDEO_W * 0.82))
    y = draw_text_block(img, lines, hook_fnt, BRAND_INK, top=380, line_gap=1.06)

    # decorative thin rule
    gold_rule(img, VIDEO_W // 2, y + 60, width=120)

    # body lines as editorial serif
    body_fnt = font("serif-regular", 50)
    body_text = "\n".join(spec["body"])
    blines = wrap_centered(draw, body_text, body_fnt, int(VIDEO_W * 0.78))
    draw_text_block(img, blines, body_fnt, BRAND_INK, top=y + 130, line_gap=1.25)

    # bottom handle
    h_fnt = font("sans-medium", 26)
    hw = draw.textlength(HANDLE, font=h_fnt)
    draw.text(((VIDEO_W - hw) / 2, VIDEO_H - 130), HANDLE, font=h_fnt, fill=BRAND_INK)

    return img


def build_video_end_frame(spec: dict) -> Image.Image:
    """The outro / sign-off frame.

    Cream sister-frame to the hook, using the SAME mark-master.png the
    homepage navbar uses (painted figure on the TC letters, no wordmark
    in the artwork). The wordmark is type-set in Cormorant beneath the
    mark for brand recognition. CTA pill + tagline + handle drive the
    follow conversion.

    Replaces the earlier painted-glow `endcard_image_1080x1920.png`
    artwork, which clashed with the bolder mark-master used elsewhere
    in the kit.
    """
    img = gradient_bg((VIDEO_W, VIDEO_H))
    draw = ImageDraw.Draw(img)

    # Mark — larger here than on the hook frame because this IS the
    # focal element of the outro.
    paste_monogram(img, top_y=320, target_h=520)

    # Wordmark — serif caps, tracked
    wm_fnt = font("serif-semi", 84)
    wm_text = "TRESOR  ·  COUTURE"
    wm_w = draw.textlength(wm_text, font=wm_fnt)
    draw.text(((VIDEO_W - wm_w) / 2, 900), wm_text, font=wm_fnt, fill=BRAND_INK)

    # Gold rule
    gold_rule(img, VIDEO_W // 2, 1030, width=240)

    # Tagline
    tg_fnt = font("sans-medium", 26)
    tg_text = "HAND-CUT IN INDIA  ·  SHIPPED WORLDWIDE"
    chars = list(tg_text)
    widths = [draw.textlength(c, font=tg_fnt) for c in chars]
    track = 5
    total = sum(widths) + track * (len(chars) - 1)
    x = (VIDEO_W - total) / 2
    cy = 1100
    for c, w in zip(chars, widths):
        draw.text((x, cy), c, font=tg_fnt, fill=BRAND_GOLD)
        x += w + track

    # CTA — ink-on-cream pill, prominent
    cta_fnt = font("sans-bold", 42)
    cta_text = spec["cta"]
    chars = list(cta_text)
    widths = [draw.textlength(c, font=cta_fnt) for c in chars]
    track = 7
    total = sum(widths) + track * (len(chars) - 1)
    pad_x, pad_y = 56, 28
    pill_w = int(total + pad_x * 2)
    pill_h = 42 + pad_y * 2
    pill_x = (VIDEO_W - pill_w) // 2
    pill_y = 1320
    draw.rounded_rectangle(
        [pill_x, pill_y, pill_x + pill_w, pill_y + pill_h],
        radius=pill_h // 2, fill=BRAND_INK,
    )
    cx_in = pill_x + pad_x
    cy_in = pill_y + pad_y - 6
    for c, w in zip(chars, widths):
        draw.text((cx_in, cy_in), c, font=cta_fnt, fill=(250, 235, 197))
        cx_in += w + track

    # Handle — large, sans-bold, anchors the bottom
    h_fnt = font("sans-bold", 40)
    handle_text = "@TRESOR.COUTURE"
    chars = list(handle_text)
    widths = [draw.textlength(c, font=h_fnt) for c in chars]
    track = 6
    total = sum(widths) + track * (len(chars) - 1)
    x = (VIDEO_W - total) / 2
    cy = VIDEO_H - 220
    for c, w in zip(chars, widths):
        draw.text((x, cy), c, font=h_fnt, fill=BRAND_INK)
        x += w + track

    # Site domain, smaller, beneath handle
    site_fnt = font("sans-medium", 22)
    site_text = "tresorcouture.in"
    sw = draw.textlength(site_text, font=site_fnt)
    draw.text(((VIDEO_W - sw) / 2, VIDEO_H - 145),
              site_text, font=site_fnt, fill=BRAND_GOLD_DEEP)

    return img


def build_post(spec: dict) -> Image.Image:
    """1080x1350 portrait static."""
    img = gradient_bg((POST_W, POST_H))
    draw = ImageDraw.Draw(img)

    # monogram, top
    paste_monogram(img, top_y=110, target_h=160)

    # category
    cat_fnt = font("sans-semi", 22)
    chars = list(spec["category"])
    widths = [draw.textlength(c, font=cat_fnt) for c in chars]
    track = 6
    total = sum(widths) + track * (len(chars) - 1)
    x = (POST_W - total) / 2
    cy = 310
    for c, w in zip(chars, widths):
        draw.text((x, cy), c, font=cat_fnt, fill=BRAND_GOLD)
        x += w + track

    gold_rule(img, POST_W // 2, 380, width=180)

    # hook
    hook_fnt = font("serif-italic", 72)
    lines = wrap_centered(draw, spec["hook"], hook_fnt, int(POST_W * 0.82))
    y = draw_text_block(img, lines, hook_fnt, BRAND_INK, top=440, line_gap=1.06)

    gold_rule(img, POST_W // 2, y + 50, width=110)

    # body
    body_fnt = font("serif-regular", 42)
    body_text = "\n".join(spec["body"])
    blines = wrap_centered(draw, body_text, body_fnt, int(POST_W * 0.78))
    y = draw_text_block(img, lines=blines, fnt=body_fnt, fill=BRAND_INK,
                       top=y + 110, line_gap=1.22)

    # CTA pill near bottom
    cta_fnt = font("sans-bold", 26)
    chars = list(spec["cta"])
    widths = [draw.textlength(c, font=cta_fnt) for c in chars]
    track = 6
    total = sum(widths) + track * (len(chars) - 1)
    pad_x, pad_y = 38, 18
    pill_w = total + pad_x * 2
    pill_h = 26 + pad_y * 2
    pill_x = (POST_W - pill_w) // 2
    pill_y = POST_H - 230
    draw.rounded_rectangle(
        [pill_x, pill_y, pill_x + pill_w, pill_y + pill_h],
        radius=pill_h // 2, fill=BRAND_INK,
    )
    cx_in = pill_x + pad_x
    cy_in = pill_y + pad_y - 4
    for c, w in zip(chars, widths):
        draw.text((cx_in, cy_in), c, font=cta_fnt, fill=BRAND_BG)
        cx_in += w + track

    # handle
    h_fnt = font("sans-medium", 24)
    hw = draw.textlength(HANDLE, font=h_fnt)
    draw.text(((POST_W - hw) / 2, POST_H - 100), HANDLE, font=h_fnt, fill=BRAND_INK)

    return img


# ---------------------------------------------------------------------------
# Video assembly via ffmpeg
# ---------------------------------------------------------------------------

def render_video(idx: int):
    spec = VIDEOS[idx]
    workdir = ROOT / "_frames" / f"v_{spec['id']}"
    workdir.mkdir(parents=True, exist_ok=True)

    hook = build_video_hook_frame(spec)
    body = build_video_body_frame(spec)
    end  = build_video_end_frame(spec)

    hook.save(workdir / "01.jpg", quality=92)
    body.save(workdir / "02.jpg", quality=92)
    end.save (workdir / "03.jpg", quality=92)

    out = OUT_V / f"TresorCouture_Reel_{spec['id']}_1080x1920.mp4"

    # 8s total: hook 0-2.5, xfade 0.5, body 2.5-5.5, xfade 0.5, end 5.5-8
    # We build it via concat with crossfades using ffmpeg's xfade filter.
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-loop", "1", "-t", "3.0", "-i", str(workdir / "01.jpg"),
        "-loop", "1", "-t", "3.5", "-i", str(workdir / "02.jpg"),
        "-loop", "1", "-t", "3.0", "-i", str(workdir / "03.jpg"),
        "-filter_complex",
        # crossfade hook->body at 2.5s (offset 2.5), body->end at 5.5s (offset 5.0 in concatenated)
        "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=2.5[v01];"
        "[v01][2:v]xfade=transition=fade:duration=0.5:offset=5.5[vout];"
        "[vout]fps=30,scale=1080:1920:flags=lanczos,format=yuv420p[v]",
        "-map", "[v]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-r", "30",
        "-an",
        str(out),
    ]
    subprocess.run(cmd, check=True)
    print(f"VIDEO ok: {out.name}")


def render_post(idx: int):
    spec = POSTS[idx]
    img = build_post(spec)
    out = OUT_P / f"TresorCouture_Post_{spec['id']}_1080x1350.jpg"
    img.save(out, quality=92, optimize=True)
    print(f"POST  ok: {out.name}")


# ---------------------------------------------------------------------------
# Entry
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        print("usage: render.py video|post|all [index]", file=sys.stderr)
        sys.exit(2)
    mode = sys.argv[1]
    if mode == "video":
        render_video(int(sys.argv[2]))
    elif mode == "post":
        render_post(int(sys.argv[2]))
    elif mode == "all":
        for i in range(len(VIDEOS)): render_video(i)
        for i in range(len(POSTS)):  render_post(i)
    else:
        print(f"unknown mode: {mode}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
