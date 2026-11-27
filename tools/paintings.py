"""Turns the public-domain paintings in tools/paintings/ into pixel-art banners for the painting themes.
Run from the repository root after python3 tools/pixelart.py and before python3 tools/pixel-themes.py.
Each banner is a faithful crop: the only changes are the reduction to 240 x 46 pixels and 24 colours, and a
dithered fade on the sides and the lower edge. The banner spans the note; a scrim in the CSS keeps the title readable."""
import json, base64, io
import numpy as np
from PIL import Image
B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 + 1 / 32
PW, PH = 240, 46  # full-width banners, drawn at 5x (1200 x 230)
CROPS = {  # theme: (file, (x0, y0, x1) as fractions; the crop height follows from the 320:112 aspect)
    'starrynight': ('starry-night.jpg', (0, .02, 1)),
    'scream': ('the-scream.jpg', (0, .52, .72)),  # the face to the right of the title
    'greatwave': ('great-wave.jpg', (0, .08, .72)),  # the crest to the right of the title
    'waterlilies': ('water-lilies-1906.jpg', (0, .32, 1)),
    'klimt': ('tree-of-life.jpg', (0, 0, 1)),
}
def panel(path, box, colors=24, fade_x=6, fade_y=9):
    im = Image.open(path).convert('RGB'); w, h = im.size
    x0, y0, x1 = box; cw = (x1 - x0) * w; ch = cw * PH / PW
    top = min(y0 * h, h - ch)
    crop = im.crop((round(x0 * w), round(top), round(x1 * w), round(top + ch))).resize((PW, PH), Image.LANCZOS)
    a = np.array(crop.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA'))
    for y in range(PH):
        for x in range(PW):
            if min(1, x / fade_x, (PW - 1 - x) / fade_x) * min(1, (PH - 1 - y) / fade_y) <= B4[y % 4, x % 4]: a[y, x, 3] = 0
    return Image.fromarray(a)
assets = json.load(open('tools/out/assets.json'))
for k, (f, box) in CROPS.items():
    p = panel('tools/paintings/' + f, box)
    b = io.BytesIO(); p.save(b, 'PNG', optimize=True)
    assets.setdefault(k, {}).update({'vista': 'url("data:image/png;base64,' + base64.b64encode(b.getvalue()).decode() + '")', 'w': PW, 'h': PH})
    p.resize((PW * 5, PH * 5), Image.NEAREST).save(f'tools/out/{k}.png')
    print(k, len(b.getvalue()))
json.dump(assets, open('tools/out/assets.json', 'w'))
