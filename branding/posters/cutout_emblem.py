# Cut the master TC emblem out of its black background:
#   python3 branding/posters/cutout_emblem.py branding/master-tc-emblem-v2-source.jpg branding/master-tc-emblem-v2.png
import sys
from PIL import Image
import numpy as np
from scipy import ndimage as nd
src, out = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
mx = a.max(2)
lab, n = nd.label(mx <= 10)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(edge))
lab2, n2 = nd.label((mx <= 40) & ~bg)
edge2 = set(np.unique(np.concatenate([lab2[0], lab2[-1], lab2[:, 0], lab2[:, -1]]))) - {0}
for i in range(1, n2 + 1):
    if i in edge2: continue
    reg = lab2 == i
    if reg.sum() >= 300 and mx[reg].mean() < 8: bg |= reg
# Edge: only a 2px ring, and only near-black pixels fade (10..30). Shaded gold,
# skin and hair stay fully opaque — no see-through, no brightening.
ring = nd.binary_dilation(bg, iterations=2) & ~bg
alpha = np.where(bg, 0.0, 1.0)
alpha[ring] = np.clip((mx[ring] - 10) / 20.0, 0, 1)
im = Image.fromarray(np.dstack([a, alpha * 255]).astype(np.uint8), 'RGBA')
bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
im.crop(bb).save(out); print('saved', im.crop(bb).size, 'offset', bb[:2])
# Report anything visible in the original that is not fully opaque now.
weak = (~bg) & (alpha < 0.99) & (mx > 30)
print('visible pixels not fully opaque:', int(weak.sum()))
