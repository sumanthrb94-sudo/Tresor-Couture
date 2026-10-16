# Regenerate: python3 branding/posters/signboard_pdf.py  (run from the repo root)
import sys
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from PIL import Image

IN = 72.0
W, H = 180 * IN, 48 * IN            # 15 ft x 4 ft
out = sys.argv[1] if len(sys.argv) > 1 else 'branding/posters/tresor-couture-signboard-15x4ft.pdf'
emblem = 'branding/posters/emblem-print.png'
pdfmetrics.registerFont(TTFont('Cormorant-Bold', 'branding/_fonts/Cormorant-Bold.ttf'))
FONT = 'Cormorant-Bold'
CREAM, GOLD = HexColor('#F5ECDC'), HexColor('#B8893A')

c = canvas.Canvas(out, pagesize=(W, H), initialFontName=FONT, initialFontSize=12)
c.setTitle('Tresor Couture signboard 15ft x 4ft'); c.setAuthor('Tresor Couture')

# Panel and frame: flat fills, no gradients or glow.
c.setFillColor(CREAM); c.rect(0, 0, W, H, stroke=0, fill=1)
c.setStrokeColor(GOLD)
c.setLineWidth(0.6 * IN); m = 1.5 * IN
c.rect(m, m, W - 2 * m, H - 2 * m, stroke=1, fill=0)
c.setLineWidth(0.08 * IN); m2 = 2.6 * IN
c.rect(m2, m2, W - 2 * m2, H - 2 * m2, stroke=1, fill=0)

# Emblem: the brand-kit master, placed at its native pixels (no upscaling).
im = Image.open(emblem); ew, eh = im.size
eh_in = 38.0; ew_in = eh_in * ew / eh
ex, ey = 9.0 * IN, (H - eh_in * IN) / 2
c.drawImage(emblem, ex, ey, width=ew_in * IN, height=eh_in * IN, mask='auto')
print(f'emblem {ew}x{eh}px at {ew_in:.1f}x{eh_in:.1f} in -> {eh/eh_in:.0f} dpi')

# Text block: centred in the space right of the emblem.
left, right = ex + ew_in * IN + 6 * IN, W - 8 * IN
cx = (left + right) / 2
def line(txt, size, track, baseline_in, maxw):
    def width(s, t): return pdfmetrics.stringWidth(txt, FONT, s) + t * s * (len(txt) - 1)
    while width(size, track) > maxw: size *= 0.98
    w = width(size, track)
    t = c.beginText(); t.setFont(FONT, size); t.setCharSpace(track * size)
    t.setFillColor(GOLD); t.setTextOrigin(cx - w / 2, baseline_in * IN); t.textLine(txt); c.drawText(t)
    print(f'{txt!r}: {size/IN:.2f} in type, {w/IN:.1f} in wide')
maxw = right - left
line('TRESOR',  17.8 * IN, 0.035, 23.0, maxw)
line('COUTURE', 10.8 * IN, 0.14, 12.8, maxw * 0.92)
line('by JSM',   4.6 * IN, 0.03,  6.4, maxw)
c.showPage(); c.save()
