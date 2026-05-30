"""Front-of-card in two orientations, using the cropped logo + brand fonts.
Output: PNG at 300 dpi with bleed (3.5x2 in standard card)."""
from PIL import Image, ImageDraw, ImageFont
import os

CREAM  = (245, 236, 220)   # #F5ECDC
INK    = (42, 31, 18)      # #2A1F12
GOLD   = (184, 137, 58)    # #B8893A
GOLDDP = (142, 101, 32)    # #8E6520
FDIR = 'branding/_fonts/'

def _on_cream(src):
    """Composite the emblem over the brand cream so its white studio
    background blends into the card (near-white -> cream, feathered)."""
    import numpy as np
    im = Image.open(src).convert('RGB')
    a = np.array(im).astype(np.int16)
    # distance from white; >=40 keeps the artwork fully opaque
    d = (255 - a).sum(axis=2)
    alpha = np.clip((d - 12) / 28.0, 0, 1)          # 0 at white, 1 on art
    out = a.copy()
    cream = np.array(CREAM)
    for c in range(3):
        out[:, :, c] = (a[:, :, c] * alpha + cream[c] * (1 - alpha))
    rgba = np.dstack([out.astype(np.uint8),
                      (alpha * 255).astype(np.uint8)])
    return Image.fromarray(rgba, 'RGBA')

LOGO = _on_cream('branding/master-logo-withoutbreaks.png')

def F(name, size): return ImageFont.truetype(FDIR + name, size)

def tracked(d, cx, y, text, font, fill, tr):
    ws = [d.textlength(c, font=font) for c in text]
    total = sum(ws) + tr * (len(text) - 1)
    x = cx - total / 2
    for c, w in zip(text, ws):
        d.text((x, y), c, font=font, fill=fill, anchor='lm')
        x += w + tr

def corners(d, x0, y0, x1, y1, ln=34, w=2):
    for cx, cy, sx, sy in [(x0,y0,1,1),(x1,y0,-1,1),(x0,y1,1,-1),(x1,y1,-1,-1)]:
        d.line([(cx, cy), (cx+ln*sx, cy)], fill=GOLD, width=w)
        d.line([(cx, cy), (cx, cy+ln*sy)], fill=GOLD, width=w)

def divider(d, cx, y, half):
    d.line([(cx-half-30, y), (cx-12, y)], fill=GOLD, width=2)
    d.line([(cx+12, y), (cx+half+30, y)], fill=GOLD, width=2)
    d.ellipse([cx-4, y-4, cx+4, y+4], fill=GOLD)

def logo(card, h, cx, cy):
    w0, h0 = LOGO.size
    nw = int(w0 * h / h0)
    card.alpha_composite(LOGO.resize((nw, h), Image.LANCZOS), (int(cx-nw/2), int(cy-h/2)))
    return nw

def horizontal():
    W, H = 1088, 638
    card = Image.new('RGBA', (W, H), CREAM+(255,))
    d = ImageDraw.Draw(card); corners(d, 88, 88, 1000, 550)
    lw = logo(card, 430, 300, H/2); d = ImageDraw.Draw(card)
    rx = (300 + lw/2 + 1000) / 2
    tracked(d, rx, 262, 'TRESOR', F('Cormorant-Light.ttf', 104), INK, 18)
    divider(d, rx, 312, 95)
    tracked(d, rx, 356, 'COUTURE', F('Inter-SemiBold.ttf', 26), INK, 18)
    tracked(d, rx, 430, 'HERITAGE INDIAN WEAVES', F('Inter-Medium.ttf', 16), GOLDDP, 6)
    p = 'branding/print/business-card-front-horizontal.png'
    card.convert('RGB').save(p); print('saved', p, card.size, os.path.getsize(p))

def vertical():
    W, H = 638, 1088
    card = Image.new('RGBA', (W, H), CREAM+(255,))
    d = ImageDraw.Draw(card); corners(d, 64, 64, 574, 1024)
    logo(card, 560, W/2, 400); d = ImageDraw.Draw(card); cx = W/2
    tracked(d, cx, 800, 'TRESOR', F('Cormorant-Light.ttf', 100), INK, 16)
    divider(d, cx, 848, 90)
    tracked(d, cx, 890, 'COUTURE', F('Inter-SemiBold.ttf', 24), INK, 16)
    tracked(d, cx, 958, 'HERITAGE INDIAN WEAVES', F('Inter-Medium.ttf', 15), GOLDDP, 6)
    p = 'branding/print/business-card-front-vertical.png'
    card.convert('RGB').save(p); print('saved', p, card.size, os.path.getsize(p))

horizontal(); vertical(); print('DONE')
