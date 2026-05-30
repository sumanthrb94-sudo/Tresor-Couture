"""Crop branding/master-logo.png to the woman + gold TC emblem only, removing
ALL baked-in text (TRESOR and COUTURE). Output: master-logo-withoutbreaks.png."""
from PIL import Image
import numpy as np, os

im = Image.open('branding/master-logo.png').convert('RGBA')
a = np.array(im)
H, W = a.shape[:2]
bg = a[2, 2, :3].astype(int)
dist = np.abs(a[:, :, :3].astype(int) - bg).sum(axis=2)
mask = dist > 45
cov = mask.sum(axis=1) / W

# Walk down from the vertical middle; the emblem is one solid content block.
# Find the first sustained gap (>=18 near-empty rows) after it -> that's the
# space above the 'TRESOR' wordmark.
empty = cov < 0.005
cut = None
run = 0
for y in range(int(H * 0.45), H):
    if empty[y]:
        run += 1
        if run >= 18:
            cut = y - run + 1          # first empty row of the gap
            break
    else:
        run = 0
if cut is None:
    cut = int(H * 0.70)

region = mask[:cut]
ys, xs = np.where(region)
top, bottom, left, right = ys.min(), ys.max(), xs.min(), xs.max()
mx = int((right - left) * 0.05)
my = int((bottom - top) * 0.04)
box = (max(0, left - mx), max(0, top - my),
       min(W, right + mx + 1), min(cut, bottom + my + 1))
out = im.crop(box).convert('RGB')

for dst in ('branding/master-logo-withoutbreaks.png',
            'public/branding/master-logo-withoutbreaks.png'):
    out.save(dst)
    print('saved', dst, out.size, os.path.getsize(dst), 'bytes')
print('cut row', cut, 'box', box)
