# CorelDRAW pack for the 15 ft x 4 ft signboard.
#   python3 branding/posters/signboard_svg.py   (run from the repo root)
#
# Writes, into branding/posters/coreldraw/:
#   *-curves.svg    text converted to outlines: opens identically on any machine
#   *-livetext.svg  editable text (install the Cormorant Garamond Bold font first)
#   *.eps           the print PDF as EPS (via cairo: stays vector, font embedded)
#   emblem.png      the master emblem, for re-linking
# Geometry is computed exactly as in signboard_pdf.py, so all files line up.
import base64, os, shutil, subprocess
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont as RLFont
from PIL import Image

IN = 72.0
W, H = 180 * IN, 48 * IN
FONT_FILE = 'branding/_fonts/Cormorant-Bold.ttf'
EMBLEM = 'branding/posters/emblem-print.png'
OUT = 'branding/posters/coreldraw'
NAME = 'tresor-couture-signboard-15x4ft'
CREAM, GOLD = '#F5ECDC', '#B8893A'
os.makedirs(OUT, exist_ok=True)

pdfmetrics.registerFont(RLFont('CB', FONT_FILE))
font = TTFont(FONT_FILE)
gs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font['head'].unitsPerEm

# ---- layout (same rules as signboard_pdf.py) --------------------------------
ew, eh = Image.open(EMBLEM).size
eh_in = 38.0; ew_in = eh_in * ew / eh
ex, ey = 9.0 * IN, (H - eh_in * IN) / 2          # PDF coords (origin bottom-left)
left, right = ex + ew_in * IN + 6 * IN, W - 8 * IN
cx, maxw = (left + right) / 2, right - left

def fit(txt, size, track, limit):
    def width(s): return pdfmetrics.stringWidth(txt, 'CB', s) + track * s * (len(txt) - 1)
    while width(size) > limit: size *= 0.98
    return size, width(size)

LINES = []
for txt, size, track, base_in, lim in [('TRESOR', 17.8 * IN, 0.035, 23.0, maxw),
                                        ('COUTURE', 10.8 * IN, 0.14, 12.8, maxw * 0.92),
                                        ('by JSM', 4.6 * IN, 0.03, 6.4, maxw)]:
    s, w = fit(txt, size, track, lim)
    LINES.append(dict(txt=txt, size=s, track=track, x=cx - w / 2, y=base_in * IN))

def outline(line):
    """Glyph outlines as SVG path data, in SVG coordinates (y down)."""
    d, x = [], line['x']
    k = line['size'] / upm
    for ch in line['txt']:
        g = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        # font units -> points, flipped into SVG space at the baseline
        gs[g].draw(TransformPen(pen, (k, 0, 0, -k, x, H - line['y'])))
        d.append(pen.getCommands())
        x += gs[g].width * k + line['track'] * line['size']
    return ' '.join(p for p in d if p)

def frame():
    m, m2 = 1.5 * IN, 2.6 * IN
    return (f'<g id="frame" fill="none" stroke="{GOLD}">'
            f'<rect x="{m}" y="{m}" width="{W-2*m}" height="{H-2*m}" stroke-width="{0.6*IN}"/>'
            f'<rect x="{m2}" y="{m2}" width="{W-2*m2}" height="{H-2*m2}" stroke-width="{0.08*IN}"/></g>')

b64 = base64.b64encode(open(EMBLEM, 'rb').read()).decode()
emblem = (f'<image id="emblem" x="{ex}" y="{H - ey - eh_in*IN}" width="{ew_in*IN}" height="{eh_in*IN}" '
          f'preserveAspectRatio="none" xlink:href="data:image/png;base64,{b64}"/>')

def svg(body):
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'width="180in" height="48in" viewBox="0 0 {W:.0f} {H:.0f}">\n'
            f'<title>Tresor Couture signboard 15 ft x 4 ft</title>\n'
            f'<rect id="panel" x="0" y="0" width="{W:.0f}" height="{H:.0f}" fill="{CREAM}"/>\n'
            f'{frame()}\n{emblem}\n{body}\n</svg>\n')

curves = '\n'.join(f'<path id="{l["txt"].replace(" ", "_")}" fill="{GOLD}" d="{outline(l)}"/>' for l in LINES)
open(f'{OUT}/{NAME}-curves.svg', 'w').write(svg(f'<g id="lettering">\n{curves}\n</g>'))

live = '\n'.join(
    f'<text x="{l["x"]:.2f}" y="{H - l["y"]:.2f}" font-family="Cormorant Garamond" font-weight="bold" '
    f'font-size="{l["size"]:.2f}" letter-spacing="{l["track"]*l["size"]:.2f}" fill="{GOLD}">{l["txt"]}</text>'
    for l in LINES)
open(f'{OUT}/{NAME}-livetext.svg', 'w').write(svg(f'<g id="lettering">\n{live}\n</g>'))

subprocess.run(['pdftocairo', '-eps', f'branding/posters/{NAME}.pdf', f'{OUT}/{NAME}.eps'], check=True)
shutil.copy(EMBLEM, f'{OUT}/emblem.png')
shutil.copy(FONT_FILE, f'{OUT}/CormorantGaramond-Bold.ttf')
for l in LINES: print(f"{l['txt']!r}: {l['size']/IN:.2f} in at x={l['x']/IN:.2f} in, baseline {l['y']/IN:.2f} in")
print('written to', OUT)
