#!/usr/bin/env python3
"""
Tresor Couture — 15 second motion pieces.

Two videos, IG reel resolution (1080 × 1920) @ 30 fps:
    1. TresorCouture_LaunchingSoon_15s.mp4
    2. TresorCouture_WeAreHiring_15s.mp4

Design language:
- Restrained, archival — no bombast. The brand voice is curated.
- Layered reveals with eased curves (no linear motion anywhere).
- Pseudo-3D depth via parallax + drop-shadows + soft warm glow that
  pulses gently behind the mark.
- Gold pip/ornament strokes draw in like ink on paper.
- Type cascades letter-by-letter so the headline lands as discovery,
  not as a slammed announcement.

Render strategy:
- Each frame is composited from cached static layers (background,
  chroma-keyed logo, pre-rendered text strikes) and a small handful of
  per-frame transforms. Avoids re-rasterising fonts 450 × times.
- Frames are written as PNG to a temp dir, then encoded with libx264
  (CRF 18, yuv420p) so the result plays natively on phones + sites.

Run from repo root:
    python3 branding/generate_motion.py
Outputs land in branding/motion/.
"""

from __future__ import annotations
from pathlib import Path
import math
import shutil
import subprocess
import tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
FONTS = ROOT / "_fonts"
OUT = ROOT / "motion"
OUT.mkdir(parents=True, exist_ok=True)

# Reel canvas + fps.
W, H = 1080, 1920
FPS = 30
DURATION_S = 15
TOTAL_FRAMES = FPS * DURATION_S  # 450

# Palette — matches the chroma-keyed reference.
CREAM       = (245, 231, 219)
CREAM_SOFT  = (250, 237, 224)
INK         = (42, 31, 18)
GOLD        = (184, 137, 58)
GOLD_SOFT   = (216, 185, 122)
GOLD_DEEP   = (142, 101, 32)


# ---------- easing ----------

def linear(t: float) -> float:          return t
def ease_out_cubic(t: float) -> float:  return 1 - (1 - t) ** 3
def ease_in_cubic(t: float) -> float:   return t ** 3
def ease_in_out_cubic(t: float) -> float:
    return 4 * t**3 if t < 0.5 else 1 - ((-2 * t + 2) ** 3) / 2
def ease_out_back(t: float, c: float = 1.70158) -> float:
    c3 = c + 1
    return 1 + c3 * (t - 1)**3 + c * (t - 1)**2
def ease_out_expo(t: float) -> float:
    return 1 if t >= 1 else 1 - 2 ** (-10 * t)


def remap(t: float, t0: float, t1: float, easing=linear) -> float:
    """Map time t (in seconds) within window [t0, t1] to [0, 1] under easing.
    Returns 0 before t0 and 1 after t1 — fan-out for reveals + holds."""
    if t <= t0: return 0.0
    if t >= t1: return 1.0
    return easing((t - t0) / (t1 - t0))


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


# ---------- fonts ----------

def cormorant(size: int, weight: str = "Regular") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / f"Cormorant-{weight}.ttf"), int(size))


def inter(size: int, weight: str = "Regular") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / f"Inter-{weight}.ttf"), int(size))


# ---------- compositing primitives ----------

def fade(img: Image.Image, alpha: float) -> Image.Image:
    """Apply uniform alpha multiplier to an RGBA image."""
    if alpha >= 0.999: return img
    if alpha <= 0.001: return Image.new("RGBA", img.size, (0, 0, 0, 0))
    arr = np.array(img)
    arr[:, :, 3] = (arr[:, :, 3].astype(np.float32) * alpha).clip(0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def scaled(img: Image.Image, scale: float) -> Image.Image:
    if abs(scale - 1.0) < 1e-3: return img
    nw, nh = max(1, int(img.width * scale)), max(1, int(img.height * scale))
    return img.resize((nw, nh), Image.LANCZOS)


def composite_centre(canvas: Image.Image, layer: Image.Image, cx: int, cy: int) -> None:
    """alpha_composite layer with its centre at (cx, cy)."""
    x = cx - layer.width // 2
    y = cy - layer.height // 2
    canvas.alpha_composite(layer, (x, y))


def composite_at(canvas: Image.Image, layer: Image.Image, x: int, y: int) -> None:
    canvas.alpha_composite(layer, (x, y))


# ---------- background ----------

_bg_cache: Image.Image | None = None


def background() -> Image.Image:
    """Solid cream — flat colour matched EXACTLY to the master logo's baked
    BG so the chroma-keyed logo composites with zero visible patch around
    it. Gradient + grain are tempting but they produced a visible 'pasted'
    halo because the logo's own BG noise didn't match the canvas's noise.
    Flat solid is the seamless answer."""
    global _bg_cache
    if _bg_cache is not None:
        return _bg_cache.copy()
    arr = np.full((H, W, 3), CREAM, dtype=np.uint8)
    _bg_cache = Image.fromarray(arr, "RGB").convert("RGBA")
    return _bg_cache.copy()


# ---------- master logo (chroma-keyed) ----------

_logo_cache: Image.Image | None = None


def master_logo() -> Image.Image:
    """User-supplied transparent master logo (3107×4096 RGBA with proper
    alpha at corners). No chroma-key needed — load and use directly."""
    global _logo_cache
    if _logo_cache is not None:
        return _logo_cache.copy()
    _logo_cache = Image.open(ROOT / "master-logo-transparent.png").convert("RGBA")
    return _logo_cache.copy()


def logo_with_glow(logo: Image.Image, glow_intensity: float) -> Image.Image:
    """Add a warm gold glow halo behind the logo. glow_intensity in [0..1]."""
    if glow_intensity <= 0.01:
        return logo
    pad = 80
    glow_canvas = Image.new("RGBA", (logo.width + pad * 2, logo.height + pad * 2),
                             (0, 0, 0, 0))
    glow_d = ImageDraw.Draw(glow_canvas)
    glow_d.ellipse([pad // 2, pad // 2,
                    glow_canvas.width - pad // 2, glow_canvas.height - pad // 2],
                   fill=GOLD_SOFT + (int(70 * glow_intensity),))
    glow_canvas = glow_canvas.filter(ImageFilter.GaussianBlur(60))
    out = Image.new("RGBA", glow_canvas.size, (0, 0, 0, 0))
    out.alpha_composite(glow_canvas)
    out.alpha_composite(logo, (pad, pad))
    return out


# ---------- text strikes (cached PIL renders) ----------

def render_text(text: str, font: ImageFont.FreeTypeFont, fill: tuple) -> Image.Image:
    """Render text into a tight RGBA image (with anti-aliased alpha)."""
    bbox = font.getbbox(text)
    pad = 4
    w = bbox[2] - bbox[0] + pad * 2
    h = bbox[3] - bbox[1] + pad * 2
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((-bbox[0] + pad, -bbox[1] + pad), text, font=font, fill=fill + (255,))
    return im


def render_spaced(text: str, font: ImageFont.FreeTypeFont, fill: tuple,
                  tracking_em: float = 0.4) -> Image.Image:
    """Letter-spaced caps rendered to a tight RGBA strip."""
    gap = int(font.size * tracking_em)
    glyphs = [render_text(c, font, fill) for c in text]
    widths = [g.width for g in glyphs]
    total = sum(widths) + gap * (len(text) - 1)
    h = max(g.height for g in glyphs)
    strip = Image.new("RGBA", (total, h), (0, 0, 0, 0))
    x = 0
    for g, w in zip(glyphs, widths):
        strip.alpha_composite(g, (x, 0))
        x += w + gap
    return strip


def gold_ornament_strip(span: int = 540) -> Image.Image:
    """Pre-rendered ornament: hairline + diamond pip + end dots."""
    pip = 12
    h = pip * 2 + 4
    im = Image.new("RGBA", (span, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = span // 2
    half = span // 2
    line_y = h // 2
    d.line([(0, line_y), (cx - 30, line_y)], fill=GOLD + (255,), width=3)
    d.line([(cx + 30, line_y), (span - 1, line_y)], fill=GOLD + (255,), width=3)
    d.polygon([(cx, line_y - pip), (cx + pip, line_y),
               (cx, line_y + pip), (cx - pip, line_y)], fill=GOLD + (255,))
    for cx_dot in (5, span - 6):
        d.ellipse([cx_dot - 5, line_y - 5, cx_dot + 5, line_y + 5], fill=GOLD + (255,))
    return im


def wipe_left_to_right(layer: Image.Image, progress: float) -> Image.Image:
    """Reveal `layer` from left to right. progress 0..1."""
    if progress >= 1.0: return layer
    if progress <= 0.0: return Image.new("RGBA", layer.size, (0, 0, 0, 0))
    arr = np.array(layer)
    cutoff = int(layer.width * progress)
    arr[:, cutoff:, 3] = 0
    return Image.fromarray(arr, "RGBA")


def slide_in(layer: Image.Image, x_target: int, y_target: int,
             progress: float, from_below: int = 80) -> tuple[int, int, Image.Image]:
    """Slide a layer up from `from_below` px below + fade in."""
    p = progress
    y = int(y_target + from_below * (1 - p))
    alpha = p
    return x_target, y, fade(layer, alpha)


def stamp_in(layer: Image.Image, progress: float,
             from_scale: float = 1.18) -> tuple[Image.Image, float]:
    """Stamp-in: starts slightly bigger + faded, settles to actual size."""
    p = progress
    s = lerp(from_scale, 1.0, p)
    alpha = p
    return scaled(layer, s), alpha


# ---------- video encoder ----------

def encode_video(frames_dir: Path, out_path: Path, fps: int = FPS) -> Path:
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-framerate", str(fps),
        "-i", str(frames_dir / "%04d.png"),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-crf", "18",
        "-preset", "medium",
        "-movflags", "+faststart",
        str(out_path),
    ]
    subprocess.run(cmd, check=True)
    return out_path


# ============================================================
#  LAUNCH VIDEO TIMELINE
# ============================================================

# Pre-rendered assets cached at module level so we don't re-render text
# for every frame.
class LaunchAssets:
    def __init__(self):
        self.logo = master_logo()
        # Scale the logo so it sits comfortably in the top half of a 1080×1920.
        target_h = 1080
        ratio = target_h / self.logo.height
        self.logo = self.logo.resize((int(self.logo.width * ratio), target_h),
                                      Image.LANCZOS)

        self.eyebrow  = render_spaced("AN ATELIER IN THE MAKING",
                                       inter(28, "Medium"), GOLD_DEEP, tracking_em=0.45)
        self.headline = render_text("Launching Soon",
                                     cormorant(140, "Italic"), INK)
        self.ornament = gold_ornament_strip(span=480)
        self.tagline  = render_spaced("DESIGNER PRET",
                                       inter(56, "Bold"), GOLD_DEEP, tracking_em=0.35)
        self.url      = render_spaced("TRESORCOUTURE.IN",
                                       inter(34, "SemiBold"), GOLD_DEEP, tracking_em=0.28)


def render_launch_frame(t: float, assets: LaunchAssets) -> Image.Image:
    canvas = background()

    # Layout y-positions (centres) — placed once, used by every reveal.
    logo_cy   = 480
    orn1_cy   = 1050
    eb_cy     = 1135
    head_cy   = 1280
    orn2_cy   = 1440
    tag_cy    = 1620
    url_cy    = 1810

    # ---- LOGO: 0.4-3.4s fade + slight scale-down (stamp-in) ----
    logo_p = remap(t, 0.4, 3.4, ease_out_cubic)
    if logo_p > 0:
        scale = lerp(1.18, 1.0, logo_p)
        # Gentle pulse that holds after entrance (3.4-15s) — breathing glow.
        breath = 0.5 + 0.5 * math.sin((t - 3.4) * math.pi / 2.4) if t > 3.4 else 0
        glow_p = lerp(0.3, 0.6, breath if t > 3.4 else logo_p)
        logo_layer = scaled(assets.logo, scale)
        logo_layer = logo_with_glow(logo_layer, glow_p)
        composite_centre(canvas, fade(logo_layer, logo_p), W // 2, logo_cy)

    # ---- ORNAMENT 1: 3.0-4.0s draws left-to-right ----
    orn1_p = remap(t, 3.0, 4.0, ease_out_cubic)
    if orn1_p > 0:
        composite_centre(canvas, wipe_left_to_right(assets.ornament, orn1_p),
                          W // 2, orn1_cy)

    # ---- EYEBROW: 4.0-5.0s slide up + fade ----
    eb_p = remap(t, 4.0, 5.0, ease_out_cubic)
    if eb_p > 0:
        x, y, im = slide_in(assets.eyebrow, (W - assets.eyebrow.width) // 2,
                             eb_cy - assets.eyebrow.height // 2, eb_p, from_below=40)
        composite_at(canvas, im, x, y)

    # ---- HEADLINE: 5.2-7.0s big stamp-in with ease-out-back ----
    head_p = remap(t, 5.2, 7.0, ease_out_back)
    if head_p > 0:
        # Shadow for depth (3D feel)
        shadow = fade(assets.headline.filter(ImageFilter.GaussianBlur(12)),
                       head_p * 0.18)
        composite_centre(canvas, shadow, W // 2 + 6, head_cy + 8)
        layer, _ = stamp_in(assets.headline, head_p, from_scale=1.12)
        composite_centre(canvas, fade(layer, head_p), W // 2, head_cy)

    # ---- ORNAMENT 2: 7.5-8.5s ----
    orn2_p = remap(t, 7.5, 8.5, ease_out_cubic)
    if orn2_p > 0:
        composite_centre(canvas, wipe_left_to_right(assets.ornament, orn2_p),
                          W // 2, orn2_cy)

    # ---- TAGLINE DESIGNER PRET: 9.0-10.5s letter cascade ----
    tag_p = remap(t, 9.0, 10.5, ease_out_cubic)
    if tag_p > 0:
        # Cascade — earlier letters more visible than later.
        n = len(assets.tagline.getbands())  # use simple linear cascade via alpha mask
        composite_centre(canvas,
                          fade(wipe_left_to_right(assets.tagline, tag_p), tag_p),
                          W // 2, tag_cy)

    # ---- URL: 11.0-12.0s fade in ----
    url_p = remap(t, 11.0, 12.0, ease_out_cubic)
    if url_p > 0:
        composite_centre(canvas, fade(assets.url, url_p), W // 2, url_cy)

    # ---- HOLD + subtle gold particles 12-15s ----
    # Tiny golden sparkles drifting upward — adds liveliness on the long hold.
    if t > 11.5:
        canvas = _draw_particles(canvas, t - 11.5, count=14, seed=42)

    return canvas


# ============================================================
#  HIRING VIDEO TIMELINE
# ============================================================

class HiringAssets:
    def __init__(self):
        self.logo = master_logo()
        target_h = 870
        ratio = target_h / self.logo.height
        self.logo = self.logo.resize((int(self.logo.width * ratio), target_h),
                                      Image.LANCZOS)

        self.eyebrow_l = render_spaced("3 POSITIONS OPEN",
                                        inter(26, "Medium"), GOLD_DEEP, tracking_em=0.45)
        self.eyebrow_r = render_spaced("AT THE ATELIER",
                                        inter(26, "Medium"), GOLD_DEEP, tracking_em=0.45)
        self.headline = render_text("We Are Hiring",
                                     cormorant(130, "Italic"), INK)
        self.role1 = render_text("Master / Tailor",
                                  cormorant(86, "Regular"), GOLD_DEEP)
        self.role2 = render_text("Sales Person",
                                  cormorant(86, "Regular"), GOLD_DEEP)
        self.ornament = gold_ornament_strip(span=420)
        self.phone = render_text("6304211922",
                                  inter(150, "Bold"), INK)
        self.url = render_spaced("TRESORCOUTURE.IN",
                                  inter(30, "SemiBold"), GOLD_DEEP, tracking_em=0.28)


def render_hiring_frame(t: float, assets: HiringAssets) -> Image.Image:
    canvas = background()

    logo_cy = 460
    orn1_cy = 935
    eb_cy   = 1010
    head_cy = 1160
    role1_cy = 1320
    role2_cy = 1420
    orn2_cy = 1520
    phone_cy = 1700
    url_cy = 1840

    # ---- LOGO: 0.4-3.0s elastic drop-in ----
    logo_p = remap(t, 0.4, 3.0, ease_out_back)
    if logo_p > 0:
        # Drops from above (3D parallax feel)
        offset_y = int((1 - logo_p) * -80)
        scale = lerp(1.08, 1.0, logo_p)
        glow_p = lerp(0.0, 0.4, logo_p)
        # subtle continued glow pulse after entrance
        if t > 3.0:
            glow_p = 0.4 + 0.15 * math.sin((t - 3.0) * math.pi / 2.0)
        logo_layer = scaled(assets.logo, scale)
        logo_layer = logo_with_glow(logo_layer, glow_p)
        composite_centre(canvas, fade(logo_layer, logo_p), W // 2, logo_cy + offset_y)

    # ---- ORNAMENT 1: 3.2-4.0s ----
    orn1_p = remap(t, 3.2, 4.0, ease_out_cubic)
    if orn1_p > 0:
        composite_centre(canvas, wipe_left_to_right(assets.ornament, orn1_p),
                          W // 2, orn1_cy)

    # ---- EYEBROW: 4.0-5.0s slide in (two halves around the centre pip) ----
    eb_p = remap(t, 4.0, 5.0, ease_out_cubic)
    if eb_p > 0:
        # Compute eyebrow placement with the gold pip at W//2.
        pip_r = 4
        sep_pad = 26
        # Left half: ends at (W//2 - pip_r - sep_pad)
        lx = W // 2 - pip_r - sep_pad - assets.eyebrow_l.width
        ly = eb_cy - assets.eyebrow_l.height // 2
        # Slide from left
        sx = lx - int(40 * (1 - eb_p))
        composite_at(canvas, fade(assets.eyebrow_l, eb_p), sx, ly)
        # Pip
        d = ImageDraw.Draw(canvas)
        d.ellipse([W // 2 - pip_r, eb_cy - pip_r,
                   W // 2 + pip_r, eb_cy + pip_r],
                  fill=GOLD + (int(255 * eb_p),))
        # Right half: starts at (W//2 + pip_r + sep_pad), slide from right
        rx = W // 2 + pip_r + sep_pad
        sxr = rx + int(40 * (1 - eb_p))
        ry = eb_cy - assets.eyebrow_r.height // 2
        composite_at(canvas, fade(assets.eyebrow_r, eb_p), sxr, ry)

    # ---- HEADLINE: 5.2-6.8s stamp + shadow ----
    head_p = remap(t, 5.2, 6.8, ease_out_back)
    if head_p > 0:
        shadow = fade(assets.headline.filter(ImageFilter.GaussianBlur(10)),
                       head_p * 0.16)
        composite_centre(canvas, shadow, W // 2 + 5, head_cy + 7)
        layer, _ = stamp_in(assets.headline, head_p, from_scale=1.10)
        composite_centre(canvas, fade(layer, head_p), W // 2, head_cy)

    # ---- ROLE 1: 7.0-7.8s fade-up ----
    r1_p = remap(t, 7.0, 7.8, ease_out_cubic)
    if r1_p > 0:
        x, y, im = slide_in(assets.role1, (W - assets.role1.width) // 2,
                             role1_cy - assets.role1.height // 2, r1_p, from_below=30)
        composite_at(canvas, im, x, y)

    # ---- ROLE 2: 7.8-8.6s fade-up (staggered after role1) ----
    r2_p = remap(t, 7.8, 8.6, ease_out_cubic)
    if r2_p > 0:
        x, y, im = slide_in(assets.role2, (W - assets.role2.width) // 2,
                             role2_cy - assets.role2.height // 2, r2_p, from_below=30)
        composite_at(canvas, im, x, y)

    # ---- ORNAMENT 2: 8.8-9.6s ----
    orn2_p = remap(t, 8.8, 9.6, ease_out_cubic)
    if orn2_p > 0:
        composite_centre(canvas, wipe_left_to_right(assets.ornament, orn2_p),
                          W // 2, orn2_cy)

    # ---- PHONE: 9.8-11.4s — the BIG impact. Zooms in from 0.45 → 1.0 with
    #      a soft elastic ease + extra shadow for depth. The visual climax.
    ph_p = remap(t, 9.8, 11.4, ease_out_back)
    if ph_p > 0:
        scale = lerp(0.45, 1.0, ph_p)
        layer = scaled(assets.phone, scale)
        # Strong depth shadow on the phone
        shadow = fade(layer.filter(ImageFilter.GaussianBlur(14)), ph_p * 0.22)
        composite_centre(canvas, shadow, W // 2 + 6, phone_cy + 9)
        composite_centre(canvas, fade(layer, ph_p), W // 2, phone_cy)

    # ---- URL: 11.6-12.6s fade in ----
    url_p = remap(t, 11.6, 12.6, ease_out_cubic)
    if url_p > 0:
        composite_centre(canvas, fade(assets.url, url_p), W // 2, url_cy)

    # ---- Subtle gold particles in the final hold 12-15s ----
    if t > 12.5:
        canvas = _draw_particles(canvas, t - 12.5, count=10, seed=99)

    return canvas


# ---------- particle effect ----------

def _draw_particles(canvas: Image.Image, t: float, count: int, seed: int) -> Image.Image:
    """Tiny gold sparkles drifting upward across the canvas — adds life on
    the long hold tail without competing with the type."""
    rng = np.random.default_rng(seed)
    d = ImageDraw.Draw(canvas)
    for i in range(count):
        # Per-particle phase offset so they don't all move in sync
        phase = (t + rng.uniform(0, 5)) % 4.0
        progress = phase / 4.0
        x = int(rng.uniform(0.08, 0.92) * W)
        y_start = H + 50
        y_end = -30
        y = int(lerp(y_start, y_end, ease_out_expo(progress)))
        alpha = int(160 * math.sin(progress * math.pi))  # fade in + out
        if alpha <= 0: continue
        r = rng.integers(2, 5)
        d.ellipse([x - r, y - r, x + r, y + r], fill=GOLD_SOFT + (alpha,))
    return canvas


# ---------- main render pipeline ----------

def render_video(name: str, frame_fn, assets_cls):
    print(f"\n▸ {name}")
    assets = assets_cls()
    with tempfile.TemporaryDirectory(prefix=f"tresor-{name.lower()}-") as tmpdir:
        tmp = Path(tmpdir)
        for i in range(TOTAL_FRAMES):
            t = i / FPS
            frame = frame_fn(t, assets).convert("RGB")
            frame.save(tmp / f"{i:04d}.png", "PNG", compress_level=1)
            if (i + 1) % 60 == 0 or i == TOTAL_FRAMES - 1:
                print(f"  ▸ frame {i+1}/{TOTAL_FRAMES}")
        out = OUT / f"TresorCouture_{name}_15s.mp4"
        encode_video(tmp, out)
        size_mb = out.stat().st_size / (1024 * 1024)
        print(f"  ✓ {out.relative_to(ROOT.parent)}  ({size_mb:.1f} MB)")
        return out


def main():
    print(f"▸ Resolution: {W} × {H}  ·  {FPS} fps  ·  {DURATION_S} s  ·  {TOTAL_FRAMES} frames each")
    render_video("LaunchingSoon", render_launch_frame, LaunchAssets)
    render_video("WeAreHiring", render_hiring_frame, HiringAssets)


if __name__ == "__main__":
    main()
