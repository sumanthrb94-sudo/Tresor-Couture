"""Build the video watermark from the brand kit.

    python3 tools/reels/make_watermark.py

Writes `branding/video/watermark-{light,dark}.png` — a lockup of the TC mark
over the wordmark, sized for a 1080-wide frame.

It is generated rather than drawn once and committed as a blob because the
inputs are the brand kit's own files: change the mark or the palette and the
watermark follows. That also makes the sizing decisions below readable, which
matters more than it sounds — a watermark that is 4px too big is the kind of
thing nobody can argue about from a PNG.

Two things a video watermark has to survive that a print logo does not:

* **Any background.** Footage moves from a white shop wall to a night street
  inside one clip, so the mark cannot rely on contrast with what is behind it.
  Every element is drawn over a soft dark shadow, which is invisible on dark
  footage and is what holds the gold together on a bright wall.
* **Compression.** Instagram re-encodes everything. Thin strokes and tight
  letterspacing turn to mush, so the wordmark is set larger and looser than a
  print lockup would be, and the whole thing is rendered at 3x and downsampled
  so the edges land on real pixels instead of being invented by the encoder.
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
BRANDING = ROOT / 'branding'
OUT_DIR = BRANDING / 'video'

# Rendered at 3x, then downsampled. Numbers below are FINAL pixels on a
# 1080-wide frame; the supersample is an implementation detail.
SS = 3
TOTAL_W = 208             # the lockup's width on a 1080 frame — 19%, which is
                          # big enough to read at arm's length and small enough
                          # that it is a signature rather than a sticker.
MARK_H = 124              # the TC mark's height
GAP = 12                  # mark to wordmark
TRACKING = 0.26           # em, and deliberately wide: letterspacing is what
                          # reads as "couture" at a glance, and it survives
                          # compression better than a thinner, tighter setting.
PAD = 9                   # room for the shadow, so it is not clipped

GOLD = (216, 185, 122)    # brand-gold-soft — brighter than print gold, because
                          # a video watermark sits at 85% opacity over moving
                          # footage and the deep gold disappears into it.
CREAM = (250, 245, 236)


def _load_palette() -> dict:
    return json.loads((BRANDING / 'palette.json').read_text())['tokens']


def _hex(token: str) -> tuple:
    raw = _load_palette()[token]['value'].lstrip('#')
    return tuple(int(raw[i:i + 2], 16) for i in (0, 2, 4))


def _shadow(layer: Image.Image, blur: int, alpha: int, offset: tuple) -> Image.Image:
    """A soft dark copy of `layer`, for it to sit on.

    Taken from the layer's own alpha, so it follows the artwork exactly rather
    than being a rectangle behind it.
    """
    a = layer.split()[3].filter(ImageFilter.GaussianBlur(blur))
    a = a.point(lambda v: int(v * alpha / 255))
    shadow = Image.new('RGBA', layer.size, (0, 0, 0, 0))
    shadow.putalpha(a)
    out = Image.new('RGBA', layer.size, (0, 0, 0, 0))
    out.alpha_composite(shadow, offset)
    return out


def build(color: tuple, name: str) -> Path:
    mark_src = Image.open(BRANDING / 'tc-master-mark-4k.png').convert('RGBA')
    mark_h = MARK_H * SS
    mark_w = round(mark_src.width * mark_h / mark_src.height)
    mark = mark_src.resize((mark_w, mark_h), Image.LANCZOS)

    text = 'TRESOR COUTURE'
    face = str(BRANDING / '_fonts' / 'Cormorant-Bold.ttf')

    # The wordmark is sized to the lockup's width rather than set in points:
    # the target here is a fraction of the FRAME, and solving for it beats
    # hand-tuning a point size every time the mark or the text changes.
    # Bold, not SemiBold — at this size Instagram's encoder eats the thin
    # strokes of a lighter weight and the wordmark goes muddy.
    def measure(pt: int):
        f = ImageFont.truetype(face, pt)
        tr = TRACKING * pt
        ws = [f.getlength(c) for c in text]
        return f, tr, ws, sum(ws) + tr * (len(text) - 1)

    target = (TOTAL_W - PAD * 2) * SS
    pt = 4
    while measure(pt + 1)[3] <= target:
        pt += 1
    font, track, widths, word_w = measure(pt)
    word_w = int(word_w)
    ascent, descent = font.getmetrics()
    word_h = ascent + descent

    w = max(mark_w, word_w) + PAD * 2 * SS
    h = mark_h + GAP * SS + word_h + PAD * 2 * SS
    art = Image.new('RGBA', (w, h), (0, 0, 0, 0))

    art.alpha_composite(mark, ((w - mark_w) // 2, PAD * SS))

    word = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(word)
    x = (w - word_w) / 2
    y = PAD * SS + mark_h + GAP * SS
    for ch, adv in zip(text, widths):
        d.text((x, y), ch, font=font, fill=color + (255,))
        x += adv + track
    art.alpha_composite(word)

    # Shadow under everything, then the artwork over it.
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.alpha_composite(_shadow(art, blur=5 * SS, alpha=150, offset=(0, 2 * SS)))
    out.alpha_composite(_shadow(art, blur=2 * SS, alpha=110, offset=(0, 1 * SS)))
    out.alpha_composite(art)

    out = out.resize((w // SS, h // SS), Image.LANCZOS)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    out.save(path)
    return path


def main() -> None:
    for path, size in [
        (build(GOLD, 'watermark-gold.png'), None),
        (build(CREAM, 'watermark-cream.png'), None),
    ]:
        im = Image.open(path)
        print(f'  {path.relative_to(ROOT)}  {im.width}x{im.height}')
    print('\nGold is the default. Cream is for footage that is mostly warm gold '
          'already — a shop window at night, brass, marigolds — where gold on '
          'gold stops being a watermark and starts being texture.')


if __name__ == '__main__':
    main()
