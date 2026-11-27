"""Procedural pixel art for Musubi's pixel themes. Every vista tiles horizontally (period W)."""
import numpy as np, random, math, json, base64, io, sys, os
os.makedirs("tools/out", exist_ok=True)  # run from the repository root: python3 tools/pixelart.py
from PIL import Image
W, H = 384, 48  # every landscape tiles at 384 pixels: at 3x a banner covers a normal pane without a repeat
B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 + 1 / 32
def hx(c, a=255):
    c = c.lstrip('#'); return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), a)
def mix(a, b, t):
    a, b = hx(a), hx(b); return '#%02x%02x%02x' % tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
class C:
    def __init__(s, w=W, h=H): s.w, s.h = w, h; s.a = np.zeros((h, w, 4), np.uint8)
    def px(s, x, y, c, a=255):
        x %= s.w
        if 0 <= y < s.h: s.a[y, x] = hx(c, a)
    def get(s, x, y): return s.a[y, x % s.w]
    def ditherpx(s, x, y, c, t):  # draw with probability t, ordered
        if t > B4[y % 4, x % 4]: s.px(x, y, c)
    def png(s, scale=1):
        im = Image.fromarray(s.a, 'RGBA')
        b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return b.getvalue()
def ridge(seed, base, amp, ks, w=W):
    r = random.Random(seed); terms = [(k, r.random() * 6.283, r.random() ** 1.5 / k ** .6) for k in ks]
    tot = sum(t[2] for t in terms)
    return [base - amp * sum(a * math.sin(6.283 * k * x / w + p) for k, p, a in terms) / tot for x in range(w)]
def sky(c, y0, y1, cols, fade=(0, 10)):  # noqa
    """gradient from cols[0] at y0 to cols[-1] at y1, dithered; alpha fades in over rows fade[0]..fade[1]"""
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0 - 1); seg = t * (len(cols) - 1); i = min(int(seg), len(cols) - 2); f = seg - i
        al = 1 if y >= fade[1] else max(0, (y - fade[0]) / max(1, fade[1] - fade[0]))
        for x in range(c.w):
            if al <= B4[y % 4, x % 4]: continue
            c.px(x, y, cols[i + 1] if f > B4[(y + 2) % 4, (x + 1) % 4] else cols[i])
def fill_below(c, hs, col, col2=None, band=0):
    for x in range(c.w):
        top = int(round(hs[x]))
        for y in range(max(0, top), c.h):
            if col2 and y - top < band and (y - top) / band < B4[y % 4, x % 4] * 1.0: c.px(x, y, col2)
            else: c.px(x, y, col)
def pine(c, x, base, h, col, trunk=None):
    for i in range(h):
        y = base - i; half = max(0, int((h - i) * 0.32 + (1 if (h - i) % 4 < 2 else 0) * .8))
        if i < 2 and trunk: c.px(x, y, trunk); continue
        for dx in range(-half, half + 1): c.px(x + dx, y, col)
def stars(c, n, rows, cols, seed, big=0.08):
    r = random.Random(seed)
    for _ in range(n):
        x, y = r.randrange(c.w), r.randrange(*rows); col = r.choice(cols)
        if r.random() < big:
            c.px(x, y, col); 
            for d in ((1, 0), (-1, 0), (0, 1), (0, -1)): c.px(x + d[0], y + d[1], mix(col, '#000000', .55))
        else: c.px(x, y, col, r.choice([255, 200, 150]))
def disc(c, cx, cy, r, col, shade=None, light=(-1, -1)):
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            d = math.hypot(x - cx, y - cy)
            if d <= r:
                col2 = col
                if shade:
                    t = ((x - cx) * -light[0] + (y - cy) * -light[1]) / (r * 1.4) + .35
                    if t > B4[y % 4, x % 4] + .2: col2 = shade
                c.px(x, y, col2)

V = {}
# ---------------- Silva: a pine forest at night, mist, fireflies, a crescent moon ----------------
def silva():
    c = C(); sky(c, 0, 34, ['#0c1714', '#13241d', '#1d3329'], (2, 16))
    disc(c, 290, 8, 4, '#e8e4c4'); disc(c, 292, 7, 3.6, '#0c1714')  # crescent
    for y in range(3, 14):
        for x in range(284, 298):
            if tuple(c.get(x, y)[:3]) == hx('#0c1714')[:3] and math.hypot(x - 290, y - 8) <= 4 and math.hypot(x - 292, y - 7) <= 3.6:
                c.a[y, x] = (0, 0, 0, 0)
    stars(c, 26, (2, 20), ['#cfe3c8', '#e8e4c4'], 3, 0)
    r = random.Random(5)
    for y in range(26, 33):  # mist
        for x in range(W):
            if (math.sin(x / 9 + y) + 1) / 2 * .55 > B4[y % 4, x % 4]: c.px(x, y, '#2b4237')
    for layer, (base, hmin, hmax, col, gap) in enumerate([(38, 10, 17, '#1b3127', 5), (43, 13, 22, '#13261d', 7), (48, 18, 30, '#0a1610', 13)]):
        x = r.randrange(gap)
        while x < W + 10:
            pine(c, x, base, r.randint(hmin, hmax), col); x += r.randint(gap - 2, gap + 3)
        fill_below(c, [base - 1 + .6 * math.sin(6.283 * 2 * i / W) for i in range(W)], col)
    for _ in range(14):
        x, y = r.randrange(W), r.randint(24, 44); c.px(x, y, '#e2f58a')
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)): c.px(x + d[0], y + d[1], '#5f7a30', 180)
    return c
# ---------------- Mons: alpine ranges at dawn, snow caps ----------------
def mons():
    c = C(); sky(c, 0, 30, ['#1a1830', '#3b2c4a', '#8a5466', '#d99a76'], (0, 14))
    stars(c, 14, (1, 9), ['#e8e4f2'], 9, 0)
    far = ridge(11, 22, 13, [1, 2, 3, 5, 8, 13]); mid = ridge(12, 31, 9, [1, 2, 4, 7, 11]); near = ridge(13, 40, 4, [2, 3, 6, 9])
    fill_below(c, far, '#6f7896')
    for x in range(W):  # snow on the far range, below each high point
        top = int(far[x])
        if top < 19:
            depth = int((19 - top) * .7) + 1
            for y in range(top, top + depth): c.ditherpx(x, y, '#eef2fa', 1.15 - (y - top) / depth)
        # sunlit west faces
        if far[(x + 1) % W] < far[x]: c.px(x, top, '#f2c9a6')
    fill_below(c, mid, '#3d4562')
    for x in range(W):
        top = int(mid[x])
        if top < 26:
            for y in range(top, top + 3): c.ditherpx(x, y, '#c9d2e6', .9 - (y - top) * .3)
    fill_below(c, near, '#212739')
    r = random.Random(14)
    x = 0
    while x < W:
        pine(c, x, int(near[x % W]) + 3, r.randint(4, 8), '#151a28'); x += r.randint(2, 6)
    fill_below(c, [45 + math.sin(6.283 * i / W * 3) for i in range(W)], '#11151f')
    return c
# ---------------- Bibliotheca: candlelit shelves, tooled gilt spines ----------------
def bibliotheca():
    c = C(); sky(c, 0, 8, ['#1c120d', '#24170f'], (0, 7))
    for y in range(8, H): 
        for x in range(W): c.px(x, y, '#1a110c')
    r = random.Random(31)
    spines = ['#6b1d22', '#7d2a24', '#23402e', '#1f3a2a', '#1f2a48', '#2a2347', '#7f5a22', '#4a2d1e', '#5a2a3c', '#3c2416', '#a88d62']
    for top, board in ((8, 26), (29, 46)):
        x = 0
        while x < W:
            w = r.choice([2, 3, 3, 4, 4, 5]); h = r.randint(board - top - 7, board - top - 1); col = r.choice(spines)
            if r.random() < .06: x += r.randint(2, 4); continue
            if x + w > W: w = W - x
            for xx in range(x, x + w):
                for y in range(board - h, board):
                    cc = col
                    if xx == x: cc = mix(col, '#ffffff', .18)
                    elif xx == x + w - 1: cc = mix(col, '#000000', .35)
                    c.px(xx, y, cc)
            if w >= 3 and r.random() < .75:
                for gy in (board - h + 2, board - 3): 
                    for xx in range(x + 1, x + w - 1): c.px(xx, gy, '#c9a24c')
                if h > 12 and r.random() < .5: c.px(x + w // 2, board - h + 5, '#e0c070')
            x += w
        for xx in range(W):
            c.px(xx, board, '#6b4428'); c.px(xx, board + 1, '#3f2716')
    # a candle on the upper shelf, with its glow
    cx = 230
    for y in range(18, 26):
        for x in range(cx - 1, cx + 2): c.px(x, y, '#e9dcc0' if x < cx + 1 else '#bfae90')
    c.px(cx, 17, '#3a2a1a'); c.px(cx, 16, '#ffb340'); c.px(cx, 15, '#ffe08a'); c.px(cx, 14, '#fff3c4')
    for y in range(6, 28):
        for x in range(cx - 14, cx + 15):
            d = math.hypot(x - cx, (y - 15) * 1.2)
            if 2 < d < 13 and tuple(c.get(x, y)[:3]) == hx('#1a110c')[:3]: c.ditherpx(x, y, '#3a2614', .55 * (1 - d / 13))
    return c
# ---------------- Mars: dust dunes under a butterscotch sky, Phobos and Deimos ----------------
def mars():
    c = C(); sky(c, 0, 28, ['#1d0f0d', '#4a2418', '#9a5a38', '#c98b5c'], (0, 14))
    disc(c, 250, 6, 1.6, '#c8b49a'); c.px(249, 7, '#8f7d68'); c.px(318, 4, '#d8c8b0')
    mesa = ridge(41, 26, 3, [1, 2]); mesa = [m - 6 * math.exp(-((x - 120) / 40) ** 2) for x, m in enumerate(mesa)]
    fill_below(c, mesa, '#7b3a26')
    d1 = ridge(42, 33, 3.5, [2, 3, 5, 8]); fill_below(c, d1, '#9c4a2c', '#c26a3e', 3)
    d2 = ridge(43, 40, 3, [3, 4, 7, 11]); fill_below(c, d2, '#b45a35', '#d9844f', 2)
    r = random.Random(44)
    for _ in range(4):  # craters
        cx, cy = r.randrange(W), r.randint(43, 46); rw = r.randint(4, 7)
        for x in range(cx - rw, cx + rw + 1):
            c.px(x, cy - 1, '#e39a62'); c.px(x, cy, '#6b2c1c' if abs(x - cx) < rw - 1 else '#8a3a24'); c.px(x, cy + 1, '#8a3a24')
    for _ in range(26):
        x, y = r.randrange(W), r.randint(41, 47)
        c.px(x, y, '#5a2618'); c.px(x, y - 1, '#a5502f')
    return c
# ---------------- Ignis: flames, glowing logs, embers rising ----------------
def ignis():
    c = C(); r = random.Random(51)
    layers = [('#5e130f', 25, .8), ('#a82416', 28, .75), ('#e0481c', 31, .66), ('#ff8a2a', 34, .56), ('#ffc046', 37, .44), ('#ffeab0', 40, .3)]
    for i, (col, base, amp) in enumerate(layers):
        hs = []
        for x in range(W):
            v = sum(abs(math.sin(6.283 * k * x / W + p)) ** 3 * a for k, p, a in [(7, i * 1.3, 1), (13, i * 2.1, .7), (23, i * .7, .5), (41, i * 3.3, .3)])
            hs.append(base - amp * v * 9 + (i * 1.5))
        fill_below(c, hs, col, mix(col, layers[max(0, i - 1)][0], .5), 2)
    for y in range(42, H):  # logs
        for x in range(W):
            band = (x // 37 + (y > 44)) % 2
            c.px(x, y, '#2a1712' if band else '#1f110d')
            if (math.sin(x * .9 + y * 2.3) + math.sin(x * .27)) > 1.55: c.px(x, y, '#ff6a2a')
    for _ in range(70):
        y = int(r.random() ** 1.3 * 26); x = r.randrange(W)
        c.px(x, y, r.choice(['#ff8a3d', '#ffd36b', '#ff5a2a']), 255 if y > 12 else 190)
    return c
# ---------------- Aurora: curtains of the northern lights over snow and pines ----------------
def aurora():
    c = C(); sky(c, 0, 34, ['#070d1c', '#0b1528', '#13213a'], (0, 10))
    stars(c, 30, (1, 26), ['#e6eeff', '#cfe0ff'], 61, .1)
    for x in range(W):
        f = .5 + .5 * math.sin(6.283 * 3 * x / W + 1.3) * math.sin(6.283 * 5 * x / W + .4)
        top = 4 + 8 * (1 - f) + 3 * math.sin(6.283 * 11 * x / W); bot = 22 + 4 * math.sin(6.283 * 2 * x / W + 2)
        streak = .55 + .45 * math.sin(x * 1.7) * math.sin(x * .31)
        for y in range(int(top), int(bot)):
            t = max(0.0, (y - top) / max(1, bot - top))
            col = '#9a7bff' if t < .3 else ('#58e0b0' if t < .8 else '#b8ffd8')
            c.ditherpx(x, y, col, min(1, (t ** 1.1) * (.35 + f) * streak * 1.9))
    hills = ridge(62, 34, 3, [1, 2, 4]); fill_below(c, hills, '#22324a')
    r = random.Random(63); x = 0
    while x < W:
        pine(c, x, int(hills[x]) + 6, r.randint(6, 12), '#0c1424'); x += r.randint(3, 9)
    snow = [41 + math.sin(6.283 * 2 * i / W) for i in range(W)]
    fill_below(c, snow, '#dfe8f2', '#9fb2c8', 0)
    for x in range(W):
        for y in range(int(snow[x]) + 2, H): c.ditherpx(x, y, '#a9bbd1', .3 + .3 * math.sin(x / 7))
    return c
# ---------------- Kairos: a protostar over a dark world with a gold rim ----------------
def kairos():
    c = C(); stars(c, 60, (0, 40), ['#f1ead8', '#ffe2a8', '#a9c8ff'], 71, .1)
    gx, gy = 280, 16  # the forge: violet halo, gold core
    for y in range(0, 34):
        for x in range(gx - 30, gx + 31):
            d = math.hypot(x - gx, (y - gy) * 1.4)
            if d < 20: c.ditherpx(x, y, '#2e1c48' if d > 11 else ('#6a3f84' if d > 5 else '#b07a6a'), .95 * (1 - d / 20) ** .8)
    for k in range(1, 9):
        a = .9 * (1 - k / 9)
        for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)): c.px(gx + dx, gy + dy, '#ffcf6b', int(255 * a))
    disc(c, gx, gy, 1.5, '#fff6dc')
    R, cx, cy = 300, W // 2, 48 + 288
    for x in range(W):
        top = cy - math.sqrt(max(0, R * R - (x - cx) ** 2))
        for y in range(max(0, int(top)), H):
            d = y - top
            c.px(x, y, '#ffcf6b' if d < 1 else ('#8a5a2a' if d < 2 else '#0d0a16'))
            if 2 <= d < 6: c.ditherpx(x, y, '#2a1c30', 1 - (d - 2) / 4)
    return c
# ---------------- Chronos: Saturn over the ice plains of a moon ----------------
def chronos():
    c = C(); stars(c, 55, (0, 38), ['#e6f1ff', '#9fd8ff', '#ffd29a'], 91, .1)
    sx, sy, sr = 272, 17, 9
    ring = lambda x, y: (((x - sx) * math.cos(-.32) + (y - sy) * math.sin(-.32)) / 19, (-(x - sx) * math.sin(-.32) + (y - sy) * math.cos(-.32)) / 4.6)
    for y in range(0, 36):  # back half of the ring
        for x in range(sx - 22, sx + 23):
            u, v = ring(x, y); e = u * u + v * v
            if .55 < e < 1 and v < 0: c.px(x, y, '#c98a3e' if e < .8 else '#f0b860')
    disc(c, sx, sy, sr, '#e8c27a', '#a8803e', (-1, -1))
    for y in range(sy - sr, sy + sr):  # bands
        for x in range(sx - sr, sx + sr + 1):
            if math.hypot(x - sx, y - sy) <= sr and (y - sy) in (-4, 2, 5): c.px(x, y, '#c99a52')
    for y in range(0, 36):  # front half of the ring
        for x in range(sx - 22, sx + 23):
            u, v = ring(x, y); e = u * u + v * v
            if .55 < e < 1 and v >= 0: c.px(x, y, '#d89a48' if e < .8 else '#ffcf7a')
    ice = ridge(92, 40, 2.5, [1, 3, 5, 9]); fill_below(c, ice, '#a9c6e0', '#e6f2ff', 2)
    for x in range(W):
        for y in range(int(ice[x]) + 3, H): c.ditherpx(x, y, '#6f8eb0', .35 + .25 * math.sin(x / 5 + y))
    r = random.Random(93)
    for _ in range(5):
        cx, cy, rw = r.randrange(W), r.randint(43, 46), r.randint(3, 5)
        for x in range(cx - rw, cx + rw + 1): c.px(x, cy, '#5a7898'); c.px(x, cy - 1, '#f2f8ff')
    return c


W2 = 384
def ridge2(c, seed, base, amp, ks): return ridge(seed, base, amp, ks, c.w)
def ellipse(c, cx, cy, rx, ry, col, a=255):
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1: c.px(x, y, col, a)
def glowdot(c, x, y, col, halo, r=2):
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            d = math.hypot(dx, dy)
            if 0 < d <= r: c.ditherpx(x + dx, y + dy, halo, .6 * (1 - d / (r + .5)))
    c.px(x, y, col)

# ---------------- Torrens (redrawn): a gorge, calm runs, three rapids round boulders, a red kayak ----------------
def torrens():
    c = C(W2); sky(c, 0, 24, ['#102228', '#24474e', '#5a8a84'], (4, 14))
    r = random.Random(121)
    far = ridge2(c, 122, 20, 3, [1, 2, 3, 5]); far = [round(v / 2) * 2 for v in far]
    fill_below(c, far, '#28474a')
    x = 0
    while x < c.w:
        pine(c, x, int(far[x]) + 1, r.randint(6, 10), '#1f3a3c'); x += r.randint(4, 7)
    near = ridge2(c, 123, 25, 3, [2, 3, 4, 7, 12]); near = [round(v / 3) * 3 for v in near]
    fill_below(c, near, '#16282a')
    x = 0
    while x < c.w:
        pine(c, x, int(near[x]) + 1, r.randint(7, 12), '#0f1e20'); x += r.randint(3, 7)
    for y in range(30, H):  # calm water, with faint flow lines
        for x in range(c.w):
            col = '#2a7480' if y < 32 else ('#1d5f6c' if y < 38 else '#174f5b')
            c.px(x, y, col)
            if math.sin(x * .31 + y * 2.1) + math.sin(x * .07 - y) > 1.7: c.px(x, y, '#3b8c96')
    for y in range(29, 31):
        for x in range(c.w): c.ditherpx(x, y, '#a8d0cc', .14 * (.5 + .5 * math.sin(x / 13)))
    def rapid(cx, cy, span):
        rocks = [(cx + dx, cy + dy, rr) for dx, dy, rr in ((-span // 2, 1, 2), (0, -1, 3), (span // 3, 2, 2))]
        for x in range(cx - span - 6, cx + span + 14):  # the white tongue and haystacks downstream
            k = 1 - abs(x - cx - 4) / (span + 10)
            if k <= 0: continue
            for y in range(cy - 4, cy + 6):
                hump = math.sin(x * .9) * 1.2 + math.sin(x * .37 + y) * .8
                if abs(y - cy - .5) < 3.2 * k + .5 and hump + k * 2.2 > 1.1: c.px(x, y, '#f4fcfb' if hump + k * 2 > 2 else '#bfe8e6')
        for rx, ry, rr in rocks:
            for y in range(ry - rr, ry + 2):
                for x in range(rx - rr - 2, rx + rr + 1):
                    d = math.hypot((x - rx) / 1.5, (y - ry) * 1.1)
                    if d <= rr: c.px(x, y, '#4a585e' if y < ry - rr + 2 and x < rx else '#262f33')
                    elif d <= rr + 1.4 and x <= rx: c.px(x, y, '#ffffff')
    for cx, cy, span in ((70, 39, 10), (200, 35, 7), (318, 42, 12)): rapid(cx, cy, span)
    kx, ky = 236, 44  # the kayak, a paddler and the paddle
    for dx in range(-6, 7):
        c.px(kx + dx, ky, '#e04030'); 
        if abs(dx) < 5: c.px(kx + dx, ky + 1, '#a8281e')
    c.px(kx - 7, ky + 1, '#e04030'); c.px(kx + 7, ky - 1, '#e04030')
    for y in (ky - 1, ky - 2): c.px(kx, y, '#2a3a8a'); c.px(kx + 1, y, '#2a3a8a')
    c.px(kx, ky - 3, '#ffd23a'); c.px(kx + 1, ky - 3, '#ffd23a'); c.px(kx, ky - 4, '#ffd23a')
    for k in range(-4, 5): c.px(kx + k, ky - 2 - round(k * .5), '#2a2a2a' if abs(k) < 4 else '#ffd23a')
    for k in range(1, 7): c.ditherpx(kx - 7 - k, ky, '#d8f2f0', 1 - k / 7)
    for (b0, b1) in ((0, 44), (128, 156), (338, W2)):  # the near bank: dark rock shelves with pines on them
        for x in range(b0 - 3, b1 + 3):
            edge = min(x - b0 + 3, b1 + 3 - x)
            top = 45 - min(3, edge // 2)
            for y in range(top, H): c.px(x, y, '#0b1415')
            if top < 45: c.px(x, top, '#1a2a2c')
        for x0 in range(b0 + 4, b1 - 2, 9): pine(c, x0, 44, r.randint(12, 19), '#081011')
    return c

# ---------------- Aion (redrawn): nebula gas, dust lanes, a young cluster; no pillars ----------------
def aion():
    c = C(W2); stars(c, 70, (0, 48), ['#f3e8ff', '#ffc9ea', '#b8f0ec'], 181, .08)
    clouds = [(70, 22, 46, 14, '#ff6eaa'), (150, 18, 54, 16, '#46cec8'), (230, 26, 50, 13, '#9a64ff'), (310, 20, 52, 15, '#ff8a6e'), (380, 24, 40, 12, '#46cec8')]
    for cx, cy, rx, ry, col in clouds:
        for y in range(H):
            for x in range(cx - rx - 4, cx + rx + 5):
                d = math.hypot((x - cx) / rx, (y - cy) / ry) + .18 * math.sin(x * .21 + y * .5) * math.sin(x * .07 - y * .3)
                if d < 1:
                    t = 1 - d
                    shade = mix(col, '#0b0714', .62) if t < .3 else (mix(col, '#0b0714', .3) if t < .6 else col)
                    c.ditherpx(x, y, shade, min(1, .35 + t * 1.1))
    for x in range(c.w):  # a dark dust lane, winding through the gas
        yc = 24 + 6 * math.sin(6.283 * 2 * x / c.w + .7) + 2 * math.sin(6.283 * 7 * x / c.w)
        for y in range(int(yc - 2), int(yc + 3)):
            if abs(y - yc) < 1.6: c.px(x, y, '#120a1c')
            else: c.ditherpx(x, y, '#1c1029', .7)
    for (x, y) in [(192, 20), (196, 24), (189, 25), (199, 19), (194, 28), (186, 21)]:
        glowdot(c, x, y, '#ffffff', '#c8e4ff', 2)
    for k in range(1, 6):
        for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)): c.px(193 + dx, 23 + dy, '#e0f0ff', int(220 * (1 - k / 6)))
    return c

# ---------------- Castellum: a castle on its hill at dusk, pennants, lit windows, a village below ----------------
def castellum():
    c = C(W2); sky(c, 0, 34, ['#1c1430', '#3c2448', '#8a4a50', '#e09a5a'], (0, 12))
    stars(c, 18, (1, 12), ['#f2e6d8'], 141, 0); disc(c, 320, 7, 3, '#f6ecd0')
    far = ridge2(c, 142, 33, 4, [1, 2, 3, 6]); fill_below(c, far, '#3a2c4a')
    hill = [40 - 12 * math.exp(-((x - 170) / 46) ** 2) + 1.2 * math.sin(6.283 * 3 * x / c.w) for x in range(c.w)]
    fill_below(c, hill, '#241a30')
    stone, shade, roof = '#7a7088', '#544c66', '#3a3050'
    def tower(x0, w, top, cone=True, flag='#d0442f'):
        base = int(hill[x0 + w // 2]) + 2
        for x in range(x0, x0 + w):
            for y in range(top, base): c.px(x, y, stone if x < x0 + w // 2 else shade)
        if cone:
            for i in range(w // 2 + 3):
                for x in range(x0 - 1 + i, x0 + w + 1 - i): c.px(x, top - 1 - i, '#8a3a40' if x < x0 + w // 2 else '#5e2630')
            pt = top - (w // 2 + 3)
            for y in range(pt - 5, pt): c.px(x0 + w // 2, y, '#2a2030')
            for y in range(pt - 5, pt - 3):
                for x in range(x0 + w // 2 + 1, x0 + w // 2 + 5 - (y - pt + 5)): c.px(x, y, flag)
        else:
            for x in range(x0 - 1, x0 + w + 1):
                if (x - x0) % 2 == 0: c.px(x, top - 1, stone)
        for y in range(top + 3, base - 3, 6): c.px(x0 + w // 2 - 1, y, '#ffcf6b'); c.px(x0 + w // 2 - 1, y + 1, '#e8a040')
    wall_top = 25
    for x in range(132, 210):
        for y in range(wall_top, int(hill[x]) + 2): c.px(x, y, stone if (x // 9) % 2 else '#6e6680')
        if x % 3 != 2: c.px(x, wall_top - 1, stone)
        if x % 3 == 0: c.px(x, wall_top - 2, stone)
    for x in range(164, 176):  # gate
        for y in range(31, int(hill[x]) + 2):
            if (x - 170) ** 2 / 36 + max(0, 33 - y) ** 2 / 4 <= 1 or y >= 33: c.px(x, y, '#140e1a')
    for x in range(165, 176, 2):
        for y in range(32, int(hill[x]) + 2): c.px(x, y, '#3a3044')
    tower(126, 8, 15); tower(204, 8, 15); tower(150, 7, 18, False); tower(180, 7, 18, False); tower(163, 13, 8)
    for x in range(140, 205, 7): c.px(x, 28, '#ffcf6b')
    r = random.Random(143)
    for hx0 in (40, 58, 74, 250, 268, 290, 350):  # cottages
        base = int(hill[hx0 % c.w]) + 1 if 100 < hx0 < 240 else 41
        for x in range(hx0, hx0 + 9):
            for y in range(base - 4, base + 1): c.px(x, y, '#3a2e3a')
        for i in range(5):
            for x in range(hx0 - 1 + i, hx0 + 10 - i): c.px(x, base - 5 - i, '#5a2e2e')
        c.px(hx0 + 3, base - 2, '#ffcf6b')
        for k in range(6): c.ditherpx(hx0 + 7 + k // 3, base - 11 - k, '#8a7a8a', .6 - k * .08)
    fill_below(c, [43 + math.sin(6.283 * 2 * i / c.w) for i in range(c.w)], '#16101e')
    for x in range(0, c.w, 5):
        for y in range(41, 44): c.px(x, y, '#2a2030')
    for x in range(c.w): c.px(x, 42, '#2a2030')
    return c

# ---------------- Shire: round doors in green hills, chimney smoke, a great tree, golden hour ----------------
def shire():
    c = C(W2); sky(c, 0, 30, ['#1a2a44', '#4a6a8a', '#d8a870', '#f4d39a'], (0, 12))
    for (cx, cy) in ((96, 10), (262, 8)):  # lobed clouds with flat bases
        for ox, oy, rx, ry in ((-8, 0, 7, 2.5), (0, -2, 7, 4), (8, -1, 6, 3), (14, 1, 5, 2)):
            for y in range(int(cy + oy - ry), cy + 2):
                for x in range(int(cx + ox - rx), int(cx + ox + rx) + 1):
                    if ((x - cx - ox) / rx) ** 2 + ((y - cy - oy) / ry) ** 2 <= 1: c.px(x, y, '#fbeed6' if y < cy + oy - ry / 3 else '#e8c8a4')
    far = ridge2(c, 151, 30, 3, [1, 2, 3, 5]); fill_below(c, far, '#4a7a54')
    mid = ridge2(c, 152, 35, 4, [1, 2, 3]); fill_below(c, mid, '#5b9455', '#7cb468', 2)
    near = ridge2(c, 153, 40, 3.5, [2, 3, 5]); fill_below(c, near, '#6aa85a', '#9cd078', 2)
    # the great tree
    tx = 300; tb = int(mid[tx]) + 1
    for y in range(tb - 9, tb + 1): c.px(tx, y, '#5a3a24'); c.px(tx + 1, y, '#3e2818')
    for (ox, oy, rr) in ((0, -14, 8), (-6, -11, 6), (7, -11, 6), (-3, -18, 5), (4, -17, 5)):
        for y in range(tb + oy - rr, tb + oy + rr + 1):
            for x in range(tx + ox - rr - 2, tx + ox + rr + 3):
                d = math.hypot((x - tx - ox) / 1.25, y - tb - oy)
                if d <= rr: c.px(x, y, '#2f6a34' if (x - tx - ox) + (y - tb - oy) > 1 else '#4a8a40')
    def door(dx, hs, col):
        base = int(hs[dx]) + 6
        for y in range(base - 7, base + 1):
            for x in range(dx - 5, dx + 6):
                d = math.hypot(x - dx, (y - base) * 1.0)
                if d <= 5.2: c.px(x, y, '#b8a888' if d > 4.1 else col)
        c.px(dx + 2, base - 2, '#f0d060')
        for wx in (dx - 9, dx + 9):  # round windows
            for y in range(base - 5, base - 2):
                for x in range(wx - 1, wx + 2):
                    c.px(x, y, '#ffd880' if (x, y) != (wx, base - 4) else '#c88a40')
        cy = int(hs[dx + 4]) - 1
        for y in range(cy - 3, cy + 1): c.px(dx + 4, y, '#6a5040')
        for k in range(10): c.ditherpx(dx + 4 + k // 3, cy - 4 - k, '#e8e0d4', .75 - k * .07)
    door(60, near, '#2f6a3a'); door(150, near, '#d8b040'); door(222, mid, '#9a3a2a'); door(350, near, '#2f5a8a')
    for x in range(c.w):  # path and fence
        y = int(44 + 1.5 * math.sin(6.283 * 3 * x / c.w))
        c.px(x, y, '#b08a58'); c.px(x, y + 1, '#8a6a40')
        if x % 6 == 0:
            for k in range(3): c.px(x, y - 1 - k, '#6a4a30')
        if x % 6 != 5: c.px(x, y - 3, '#8a6a48')
    r = random.Random(154)
    for _ in range(40):
        x = r.randrange(c.w); y = int(near[x]) + r.randint(2, 7)
        if y < 43: c.px(x, y, r.choice(['#f4d040', '#e85a5a', '#f8f0e0', '#c87ad8']))
    return c

# ---------------- Spelunca: a cave, stalactites, glowworms, crystals, a still pool ----------------
def spelunca():
    c = C(W2); r = random.Random(161)
    ceil = ridge2(c, 162, 5, 2, [2, 3, 5, 9])
    for x in range(c.w):
        for y in range(0, int(ceil[x]) + 1): c.px(x, y, '#2a2434' if y < ceil[x] - 1 else '#3c3448')
    x = 0
    while x < c.w:  # stalactites
        L = r.choice([3, 4, 5, 7, 9, 12, 15]); w = 1 + L // 5; top = int(ceil[x])
        for i in range(L):
            hw = max(0, round(w * (1 - i / L)))
            for dx in range(-hw, hw + 1): c.px(x + dx, top + i, '#3c3448' if dx < 0 else '#2a2434')
        c.px(x, top + L, '#7fe8ff', 160)
        x += r.randint(3, 9)
    for _ in range(70):  # glowworms on the ceiling
        x = r.randrange(c.w); y = r.randint(int(ceil[x % c.w]) + 1, 20)
        c.px(x, y, '#9ff0ff', r.choice([255, 200, 140]))
        if r.random() < .3: c.px(x, y + 1, '#2f7a90', 140); c.px(x, y + 2, '#2f7a90', 90)
    floor = ridge2(c, 163, 40, 2, [2, 3, 7])
    fill_below(c, floor, '#221c2c', '#342c40', 1)
    x = 2
    while x < c.w:  # stalagmites
        L = r.choice([3, 4, 6, 8, 11]); w = 1 + L // 4; base = int(floor[x])
        for i in range(L):
            hw = max(0, round(w * (1 - i / L)))
            for dx in range(-hw, hw + 1): c.px(x + dx, base - i, '#3c3448' if dx < 0 else '#262030')
        x += r.randint(6, 16)
    for cx, col, hi in ((96, '#b48aff', '#e6d6ff'), (210, '#7ff0ff', '#e0fcff'), (330, '#b48aff', '#e6d6ff')):  # crystals
        base = int(floor[cx]) + 1
        for ox, h0 in ((-4, 5), (-1, 9), (2, 7), (5, 4)):
            for i in range(h0):
                for dx in (0, 1): c.px(cx + ox + dx, base - i, hi if dx == 0 else col)
            c.px(cx + ox, base - h0, hi)
        for y in range(base - 16, base + 2):
            for x2 in range(cx - 14, cx + 15):
                d = math.hypot(x2 - cx, (y - base + 4) * 1.3)
                if 5 < d < 14 and c.get(x2, y)[3] == 0: c.ditherpx(x2, y, mix(col, '#000000', .6), .4 * (1 - d / 14))
    for y in range(43, H):  # the pool, with reflections of the glowworms
        for x in range(c.w):
            c.px(x, y, '#0d2230' if y > 43 else '#1d4a58')
            if r.random() < .03: c.px(x, y, '#5fc8e0', 150)
    return c

# ---------------- Earthrise (Apollo 8, 1968): the half-lit Earth above the grey lunar horizon ----------------
def earthrise():
    c = C(W2); r = random.Random(171)
    stars(c, 10, (0, 20), ['#d8dce8'], 172, 0)
    ex, ey, er = 238, 12, 10
    for y in range(ey - er - 1, ey + er + 2):
        for x in range(ex - er - 1, ex + er + 2):
            d = math.hypot(x - ex, y - ey)
            if d > er: continue
            if (x - ex) + (y - ey) * -.25 < -2: continue  # the Sun lights a little more than half
            n = math.sin(x * 1.1 + y * .8) + math.sin(x * .45 - y * 1.7) + .7 * math.sin(x * 2.1 + y * .3)
            col = '#f4f6ff' if n > .9 else ('#8a7a50' if n < -1.7 else '#2f62b8')
            if d > er - 1.1: col = mix(col, '#9ac0ff', .4)
            c.px(x, y, col)
    R, cx, cy = 1400, 192, 30 + 1400
    for x in range(c.w):
        top = cy - math.sqrt(max(0, R * R - (x - cx) ** 2)) + 1.2 * math.sin(6.283 * 5 * x / c.w) + .8 * math.sin(6.283 * 13 * x / c.w)
        for y in range(max(0, int(top)), H):
            d = y - top
            col = '#d2d0c8' if d < 1 else ('#a6a49c' if d < 3 else ('#86847e' if d < 7 else '#64625e'))
            c.px(x, y, col)
            if 2 < d < 10: c.ditherpx(x, y, '#64625e', (d - 2) / 10)
    for _ in range(16):
        x0, y0, rw = r.randrange(c.w), r.randint(34, 46), r.randint(2, 6)
        for x in range(x0 - rw, x0 + rw + 1):
            c.px(x, y0, '#3e3c3a'); c.px(x, y0 - 1, '#e2e0d8' if x > x0 else '#54524e')
    return c

# ---------------- Pale Blue Dot (Voyager 1, 1990): bands of scattered sunlight, one pale blue pixel ----------------
def palebluedot():
    c = C(W2)
    bands = [(60, 14, '#6a4430'), (130, 9, '#8a6a4a'), (200, 18, '#7a5a40'), (262, 7, '#5a6a8a'), (318, 12, '#6a4a36')]
    for y in range(H):
        for x in range(c.w):
            t = 0
            for bx, bw, col in bands:
                d = abs(((x - bx - y * .32) + c.w / 2) % c.w - c.w / 2)
                if d < bw:
                    k = (1 - d / bw) ** 1.4
                    if k * .8 > B4[y % 4, x % 4]: c.px(x, y, col if k < .6 else mix(col, '#e8c8a0', .35))
            if (x * 7 + y * 13) % 97 == 0: c.px(x, y, '#3a2a24')
    # the dot sits in the bluish band
    dx, dy = 262 + int(20 * .32), 20
    c.px(dx, dy, '#cfe2ff')
    for d in ((1, 0), (-1, 0), (0, 1), (0, -1)): c.px(dx + d[0], dy + d[1], '#7a96c8', 170)
    return c

# ---------------- Deep Field (JWST, 2022): lensed arcs, galaxies, stars with eight-point spikes ----------------
def deepfield():
    c = C(W2); r = random.Random(191)
    for _ in range(170):  # faint distant galaxies
        x, y = r.randrange(c.w), r.randrange(H)
        c.px(x, y, r.choice(['#c86a3a', '#e0a050', '#8a5a9a', '#d0b090', '#ff8a4a']), r.choice([255, 190, 130]))
    for _ in range(26):  # ellipticals
        x, y = r.randrange(c.w), r.randrange(4, H - 4); rx, ry = r.choice([(2, 1), (3, 2), (4, 2), (2, 2)])
        ellipse(c, x, y, rx, ry, '#c8904a'); c.px(x, y, '#ffe6b0')
    for _ in range(14):  # small spirals
        x, y = r.randrange(c.w), r.randrange(5, H - 5); a = r.random() * 3
        for k in range(18):
            t = k / 18 * 6.283; rr = 1 + k / 5
            for s in (0, math.pi): c.px(int(x + math.cos(t + s + a) * rr), int(y + math.sin(t + s + a) * rr * .5), '#9ab8f0', 200)
        c.px(x, y, '#f0f4ff')
    cx, cy = 180, 26  # the cluster and its lensed arcs
    for y in range(cy - 10, cy + 11):
        for x in range(cx - 18, cx + 19):
            d = math.hypot((x - cx) / 1.6, y - cy)
            if d < 9: c.ditherpx(x, y, '#e8c890', .7 * (1 - d / 9))
    ellipse(c, cx, cy, 4, 2.4, '#f4dca8'); c.px(cx, cy, '#ffffff')
    for rad, a0, a1, col in ((15, 3.6, 4.6, '#ff9a5a'), (19, .2, 1.1, '#ffb070'), (13, 1.8, 2.6, '#e8784a'), (22, 4.9, 5.6, '#ffa060')):
        for k in range(60):
            t = a0 + (a1 - a0) * k / 59
            c.px(int(cx + math.cos(t) * rad * 1.6), int(cy + math.sin(t) * rad * .9), col)
    for sx, sy, L in ((70, 14, 8), (300, 30, 10), (352, 9, 6), (118, 38, 5)):  # stars, JWST spikes
        for k in range(1, L + 1):
            a = int(255 * (1 - k / (L + 1)))
            for dx, dy in ((0, -1), (0, 1), (1, -.58), (-1, -.58), (1, .58), (-1, .58)): c.px(int(sx + dx * k), int(sy + dy * k), '#fff4d8', a)
            if k <= L // 2: c.px(sx + k, sy, '#fff4d8', a // 2); c.px(sx - k, sy, '#fff4d8', a // 2)
        c.px(sx, sy, '#ffffff'); c.px(sx + 1, sy, '#ffffff'); c.px(sx, sy + 1, '#ffffff'); c.px(sx + 1, sy + 1, '#fff0c8')
    return c

# ---------------- Pluto (New Horizons, 2015): backlit mountains, layers of blue haze ----------------
def pluto():
    c = C(W2); stars(c, 40, (0, 22), ['#e6eeff', '#cfe0ff'], 201, .05)
    R, cx, cy = 1300, 192, 40 + 1300
    horizon = [cy - math.sqrt(R * R - (x - cx) ** 2) for x in range(c.w)]
    for x in range(c.w):  # haze layers, concentric with the horizon
        for y in range(0, int(horizon[x])):
            hgt = horizon[x] - y
            layer = (math.sin(hgt * 1.25) + 1) / 2
            k = math.exp(-hgt / 7) * (.55 + .45 * layer)
            if k > .08: c.ditherpx(x, y, '#9ac8ff' if k > .55 else ('#5a8ad0' if k > .3 else '#2a4a8a'), min(1, k * 1.5))
    mtn = [horizon[x] - max(0, 7 * math.sin(6.283 * x / 64) ** 9) - 3 * max(0, math.sin(6.283 * x / 23 + 1)) ** 4 - 2 * abs(math.sin(x * .7)) * (math.sin(6.283 * x / 64) > .6) for x in range(c.w)]
    for x in range(c.w):
        top = int(mtn[x])
        for y in range(top, H): c.px(x, y, '#0a0c14' if y > top else '#4a6aa8')
    for x in range(c.w):  # plains: a faint sheen
        for y in range(int(horizon[x]) + 3, H): c.ditherpx(x, y, '#141a2c', .25)
    return c

# ---------------- Jupiter (Juno): the limb of the planet, belts and zones, the Great Red Spot ----------------
def jupiter():
    c = C(W2); stars(c, 30, (0, 16), ['#f0ece4'], 211, 0)
    R, cx, cy = 820, 192, 20 + 820
    zones = ['#efe4cc', '#d8b88e', '#f2e8d4', '#b8805a', '#e6d0aa', '#8a5a3c', '#f0e2c4', '#c89a6a', '#e8d8b8']
    for x in range(c.w):
        top = cy - math.sqrt(R * R - (x - cx) ** 2)
        for y in range(max(0, int(top)), H):
            depth = y - top
            band = (y + 1.6 * math.sin(x * .19 + y * .9) + .8 * math.sin(x * .53 - y)) / 3.4
            col = zones[int(band) % len(zones)]
            if depth < 1.5: col = mix(col, '#2a1e18', .45)
            c.px(x, y, col)
    gx, gy = 236, 37
    for y in range(gy - 5, gy + 6):
        for x in range(gx - 10, gx + 11):
            d = math.hypot((x - gx) / 10, (y - gy) / 5)
            if d <= 1: c.px(x, y, '#e8b090' if d > .78 else ('#c0563a' if d > .35 else '#a8402a'))
    for k in range(20): c.px(gx + 11 + k, gy + int(1.5 * math.sin(k * .6)), '#f6ecd8')
    for k, x in enumerate(range(90, 170, 16)): ellipse(c, x, 43, 2, 1, '#fbf6ea')
    return c

# ---------------- colour sigils (one character per pixel) ----------------
SIG = {
 'silva': (['....g....', '...ggg...', '..gGggg..', '...ggg...', '..gGgggg.', '.ggggGgg.', '...ggg...', '.gggGgggg', 'ggggggGgg', '....t....', '....t....'], {'g': '#5f9e5a', 'G': '#9fd27a', 't': '#8a5a34'}),
 'mons': (['.....w.....', '....www....', '...wwsw....', '..wsmmmw...', '..mmmmmm.m.', '.mmmmmmmmmm', 'mmmMmmmmmmm', 'mmMMMmmmMmm'], {'w': '#f2f6ff', 's': '#c9d4ea', 'm': '#7c88aa', 'M': '#4a5578'}),
 'torrens': (['...ww......', '..wbbw.....', '.wbtbbw..w.', 'wbttttbwwbw', 'bttttttbbtb', 'tttttttttt.', 'TTTTTTTTTT.'], {'w': '#f2fbfb', 'b': '#9fe0e0', 't': '#3d9fb0', 'T': '#226878'}),
 'bibliotheca': (['.rr.gg.bb..', '.rr.gg.bb.o', '.yy.yy.yy.o', '.rr.gg.bb.o', '.rr.gg.bb.o', '.rr.gg.bb.o', '.yy.yy.yy.o', '.rr.gg.bb.o', 'wwwwwwwwwww'], {'r': '#9a2c2c', 'g': '#2f6a46', 'b': '#2f4a8a', 'y': '#e0b850', 'o': '#b08a46', 'w': '#8a5a34'}),
 'mars': (['...rrrr...', '..rRRrrr..', '.rRrrrrdr.', 'rrrrrddrrr', 'rrrdddrrrr', 'rrrrrrrrdr', '.rdrrrrrr.', '..rrrrdr..', '...rrrr...'], {'r': '#d4643a', 'R': '#f0a070', 'd': '#8f3a24'}),
 'ignis': (['....r.....', '....rr....', '...rrr.r..', '..rroor.r.', '..roooorr.', '.rooyyoor.', '.royyyyor.', '.royywyor.', '..rooooor.', '...rrrrr..'], {'r': '#d0381c', 'o': '#ff8a2a', 'y': '#ffc846', 'w': '#fff2c0'}),
 'aurora': (['p.......p..', 'pp....pp...', '.gp..gp...p', '.gg.gg...pp', '..ggg....g.', '..gg.g..gg.', '.g...gggg..', 'g.....gg...'], {'p': '#a487ff', 'g': '#5fe4b4'}),
 'kairos': (['...y...', '...y...', '..yYy..', 'yyYWYyy', '..yYy..', '...y...', '...y...'], {'y': '#ffcf6b', 'Y': '#ffe7a8', 'W': '#ffffff'}),
 'aion': (['...ppp...', '.pp...tt.', '.p.....t.', 'p.......t', 'p...w...t', 'p.......t', '.t.....p.', '.tt...pp.', '...ttt...'], {'p': '#ff8fd0', 't': '#5fd8d0', 'w': '#ffffff'}),
 'castellum': (['f....f....f', 'ff...ff...ff', 'f....f....f', 's.s.sss.s.s', 'sssssssssss', 'sssywsssyws', 'sssssssssss', 'sssss.sssss', 'ssss...ssss'], {'f': '#d0442f', 's': '#8a8098', 'y': '#ffcf6b', 'w': '#544c66'}),
 'shire': (['...ggggg...', '..ggGGGgg..', '.ggbbbbbgg.', 'ggbyyyyybgg', 'ggbyyyyybgg', 'ggbyyyoybgg', 'ggbyyyyybgg', 'GGGGGGGGGGG'], {'g': '#5b9455', 'G': '#7cb468', 'b': '#b8a888', 'y': '#2f6a3a', 'o': '#f0d060'}),
 'spelunca': (['sssssssssss', '.sss.ss.ss.', '.ss...s..s.', '..s......s.', '.....c.....', '....ccC....', '...cccCC...', 'gggggggggggg'], {'s': '#4a4058', 'c': '#7ff0ff', 'C': '#e0fcff', 'g': '#342c40'}),
 'earthrise': (['...bbb...', '..bwbbb..', '.bbbwgbb.', '.bbbbbbb.', '..bbwbb..', '...bbb...', '.........', 'ggggggggg', 'GGGGGGGGG'], {'b': '#3a6fc4', 'w': '#f4f6ff', 'g': '#c8c6be', 'G': '#7a7872'}),
 'palebluedot': (['o......t...', '.o......t..', '..o..b...t.', '...o.....t.', '....o.....t', '.....o.....', '......o....'], {'o': '#8a6a4a', 't': '#7a5a40', 'b': '#cfe2ff'}),
 'deepfield': (['....y....', '.y..y..y.', '..y.y.y..', '...yWy...', 'yyyWWWyyy', '...yWy...', '..y.y.y..', '.y..y..y.', '....y....'], {'y': '#ffe6a8', 'W': '#ffffff'}),
 'pluto': (['.bbbbbbbbb.', 'b.........b', '.lllllllll.', 'l.........l', 'dddd.d.dddd', 'ddddddddddd', 'ddddddddddd'], {'b': '#5a8ad0', 'l': '#9ac8ff', 'd': '#4a6aa8'}),
 'jupiter': (['...cccc...', '..tttttt..', '.cccccccc.', 'rrrrrrrrrr', 'cccccRRccc', 'tttttRRttt', '.cccccccc.', '..rrrrrr..', '...cccc...'], {'c': '#efe4cc', 't': '#d8b88e', 'r': '#b8805a', 'R': '#c0563a'}),
 'chronos': (['.....ccccc.....', '...ccCCCCCcc...', 'aa.cCCCCCCCc.aa', '.aaa.......aaa.', '..aaaAAAAAaaa..', '...c.......c...', '....ccccccc....', '......ccc......'], {'c': '#e8c27a', 'C': '#f4dca0', 'a': '#ffb85c', 'A': '#ffd892'}),
}
def sigil(name):
    rows, key = SIG[name]; w = max(map(len, rows)); c = C(w, len(rows))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in key: c.a[y, x] = hx(key[ch])
    return c
def band(cols):
    """a 48x2 strip: blocks of each colour with dithered seams"""
    c = C(48, 2); n = len(cols)
    for x in range(48):
        t = x / 47 * (n - 1); i = min(int(t), n - 2); f = t - i
        for y in range(2): c.a[y, x] = hx(cols[i + 1] if f > B4[y % 4, x % 4] else cols[i])
    return c
BANDS = {
 'silva': ['#1b3127', '#3e6b45', '#7fb26a', '#e2f58a'], 'mons': ['#3d4562', '#8a5466', '#d99a76', '#eef2fa'],
 'torrens': ['#164a5a', '#3d9fb0', '#8fd4d6', '#eaf7f6'], 'bibliotheca': ['#6b1d22', '#23402e', '#1f2a48', '#c9a24c'],
 'mars': ['#7b3a26', '#b45a35', '#d9844f', '#c8b49a'],
 'castellum': ['#3a2c4a', '#8a3a40', '#e09a5a', '#ffcf6b'], 'shire': ['#4a7a54', '#7cb468', '#d8b040', '#f4d39a'],
 'spelunca': ['#342c40', '#b48aff', '#7ff0ff', '#e0fcff'], 'earthrise': ['#5a5854', '#c8c6be', '#2f5fb0', '#f4f6ff'],
 'palebluedot': ['#3a2a24', '#6a4430', '#8a6a4a', '#cfe2ff'], 'deepfield': ['#8a5a9a', '#c86a3a', '#ffb070', '#fff4d8'],
 'pluto': ['#0a0c14', '#2a4a8a', '#5a8ad0', '#9ac8ff'], 'jupiter': ['#8a5a3c', '#b8805a', '#c0563a', '#efe4cc'], 'ignis': ['#a82416', '#e0481c', '#ff8a2a', '#ffeab0'],
 'aurora': ['#22324a', '#9a7bff', '#58e0b0', '#dfe8f2'], 'kairos': ['#3a2357', '#7a4a8f', '#ffcf6b', '#fff6dc'],
 'aion': ['#2a1838', '#9a64ff', '#ff6eaa', '#46cec8'], 'chronos': ['#6f8eb0', '#a9c6e0', '#e8c27a', '#ffb85c'],
}
SCENES = dict(silva=silva, mons=mons, torrens=torrens, bibliotheca=bibliotheca, mars=mars, ignis=ignis, aurora=aurora, kairos=kairos, aion=aion, chronos=chronos,
              castellum=castellum, shire=shire, spelunca=spelunca, earthrise=earthrise, palebluedot=palebluedot, deepfield=deepfield, pluto=pluto, jupiter=jupiter)
out = {}
uri = lambda b: 'url("data:image/png;base64,' + base64.b64encode(b).decode() + '")'
sheet = Image.new('RGBA', (W2 * 2 + 40 + 60, (H * 2 + 8) * len(SCENES)), (20, 20, 24, 255))
for i, (k, f) in enumerate(SCENES.items()):
    v = f(); s = sigil(k); b = band(BANDS[k])
    out[k] = {'vista': uri(v.png()), 'sigil': uri(s.png()), 'band': uri(b.png()), 'w': v.w}
    y0 = i * (H * 2 + 8)
    bgc = Image.new('RGBA', (v.w * 2, H * 2), (13, 12, 16, 255)); bgc.alpha_composite(Image.fromarray(v.a).resize((v.w * 2, H * 2), Image.NEAREST)); sheet.paste(bgc, (0, y0))
    si = Image.fromarray(s.a).resize((s.w * 4, s.h * 4), Image.NEAREST); sheet.alpha_composite(si, (W2 * 2 + 10, y0 + 6))
    sheet.paste(Image.fromarray(b.a).resize((96, 8), Image.NEAREST), (W2 * 2 + 10, y0 + 56))
sheet.save('tools/out/sheet.png')
json.dump(out, open('tools/out/assets.json', 'w'))
print({k: len(v['vista']) for k, v in out.items()})
