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


# ---------------- a 3x5 pixel font for chalk equations and monitor read-outs ----------------
GLYPH = {
 'E': ['xxx', 'x..', 'xx.', 'x..', 'xxx'], '=': ['...', 'xxx', '...', 'xxx', '...'], 'm': ['...', 'xx.', 'xxx', 'x.x', 'x.x'],
 'c': ['...', 'xxx', 'x..', 'x..', 'xxx'], '2': ['xx.', '..x', '.x.', 'x..', 'xxx'], 'R': ['xx.', 'x.x', 'xx.', 'x.x', 'x.x'],
 '-': ['...', '...', 'xxx', '...', '...'], 'g': ['...', 'xxx', 'x.x', 'xxx', '..x'], '8': ['xxx', 'x.x', 'xxx', 'x.x', 'xxx'],
 'p': ['....', 'xxxx', '.x.x', '.x.x', '.x.x'], 'x': ['...', 'x.x', '.x.', 'x.x', 'x.x'], 'u': ['...', 'x.x', 'x.x', 'xxx', 'x..'], 'v': ['...', 'x.x', 'x.x', 'x.x', '.x.'], 'G': ['xxx', 'x..', 'x.x', 'x.x', 'xxx'], 'T': ['xxx', '.x.', '.x.', '.x.', '.x.'],
 '1': ['.x.', 'xx.', '.x.', '.x.', 'xxx'], '/': ['..x', '..x', '.x.', 'x..', 'x..'], '7': ['xxx', '..x', '.x.', '.x.', '.x.'],
 'B': ['xx.', 'x.x', 'xx.', 'x.x', 'xx.'], 'P': ['xx.', 'x.x', 'xx.', 'x..', 'x..'], 'M': ['x.x', 'xxx', 'xxx', 'x.x', 'x.x'],
 'd': ['..x', '..x', 'xxx', 'x.x', 'xxx'], 's': ['...', 'xxx', 'xx.', '..x', 'xxx'], 't': ['.x.', 'xxx', '.x.', '.x.', '.xx'],
 'h': ['x..', 'x..', 'xxx', 'x.x', 'x.x'],
 '+': ['...', '.x.', 'xxx', '.x.', '...'], '(': ['.x', 'x.', 'x.', 'x.', '.x'], ')': ['x.', '.x', '.x', '.x', 'x.'], ' ': ['..', '..', '..', '..', '..'],
}
def text(c, x, y, s, col, a=255, sub=False):
    for ch in s:
        g = GLYPH.get(ch, GLYPH[' '])
        for yy, row in enumerate(g):
            for xx, v in enumerate(row):
                if v == 'x': c.px(x + xx, y + yy + (2 if sub else 0), col, a)
        x += len(g[0]) + 1
    return x
def line(c, x0, y0, x1, y1, col, a=255):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for k in range(n + 1):
        t = k / max(1, n); c.px(round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t), col, a)
def circle(c, cx, cy, r, col, a=255, ry=None):
    ry = ry or r; n = int(6.3 * max(r, ry)) + 8
    for k in range(n): t = k / n * 6.283; c.px(round(cx + math.cos(t) * r), round(cy + math.sin(t) * ry), col, a)
def building(c, x0, w, top, base, col, win, lit=.5, seed=0, step=3):
    r = random.Random(seed)
    for x in range(x0, x0 + w):
        for y in range(top, base): c.px(x, y, col)
    for y in range(top + 2, base - 1, step):
        for x in range(x0 + 1, x0 + w - 1, 2):
            if r.random() < lit: c.px(x, y, r.choice(win))

# The scenes below follow Silva and Chronos: a smooth dusk or night sky, two or three silhouette layers,
# one focal object kept out of the title band (about x 80-230 at 3x), a soft glow, and few colours.
def halo(c, cx, cy, r, col, k=.6, sy=1.0):
    for y in range(int(cy - r * sy) - 1, int(cy + r * sy) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            d = math.hypot(x - cx, (y - cy) / sy) / r
            if d < 1: c.ditherpx(x, y, col, k * (1 - d) ** 1.6)
def blob(c, cx, cy, rx, ry, col):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1: c.px(x, y, col)
def moon(c, cx, cy, r, col, glow):
    halo(c, cx, cy, r * 3.2, glow, .45); disc(c, cx, cy, r, col)
    for k in range(4): c.px(cx - r // 2 + k, cy - 1 + (k % 2), mix(col, '#000000', .12))

# ---------------- Solarpunk: garden towers at dusk, a low sun, turbines on the far hills, lanterns ----------------
def solarpunk():
    c = C(); r = random.Random(301)
    sky(c, 0, 38, ['#0c1820', '#173038', '#3a5a50', '#a88850', '#e8b868'], (0, 12))
    stars(c, 10, (1, 9), ['#e8f0e0'], 302, 0)
    halo(c, 304, 30, 26, '#f4c870', .5, .6); disc(c, 304, 31, 6, '#ffe2a0')
    far = ridge(303, 33, 3, [1, 2, 3]); fill_below(c, far, '#2c4a44')
    for tx in (20, 52, 250, 336, 362):  # turbines on the far hills
        base = int(far[tx]); hy = base - 11
        for y in range(hy, base): c.px(tx, y, '#3e5e56')
        for k in range(3):
            a0 = .4 + k * 2.094
            for d in range(1, 6): c.px(round(tx + math.cos(a0) * d), round(hy + math.sin(a0) * d), '#3e5e56')
    def tower(x0, w, top, base, col, leaf, lit):
        for x in range(x0, x0 + w):
            for y in range(top, base): c.px(x, y, col)
        blob(c, x0 + w / 2, top - 1, w / 2 + 2, 3, leaf)
        for y in range(top + 5, base - 2, 6):
            blob(c, x0 - 1, y, 2.5, 1.6, leaf); blob(c, x0 + w, y + 2, 2.5, 1.6, leaf)
            for k in range(r.randint(1, 3)):
                vx = x0 + r.randrange(w)
                for vy in range(y, y + r.randint(2, 5)): c.px(vx, vy, leaf)
        for y in range(top + 3, base - 2, 3):
            for x in range(x0 + 2, x0 + w - 1, 3):
                if r.random() < lit: c.px(x, y, '#ffd890')
    for x0, w, top in ((8, 9, 18), (30, 7, 24), (236, 10, 14), (262, 8, 22), (340, 11, 17), (366, 7, 25)):
        tower(x0, w, top, 40, '#1e3634', '#24423a', .15)
    for x0, w, top in ((0, 12, 26), (60, 10, 30), (226, 13, 22), (284, 9, 28), (318, 12, 24), (372, 10, 31)):
        tower(x0, w, top, H, '#0f1c1c', '#13281e', .3)
    fill_below(c, [44 + math.sin(6.283 * 3 * i / W) for i in range(W)], '#0a1410')
    for x0 in range(5, W, 13): blob(c, x0, 43, 4, 3, '#0c1a12')
    for _ in range(14):
        x, y = r.randrange(W), r.randint(30, 44); glowdot(c, x, y, '#ffe08a', '#6a5a2a', 1)
    return c

# ---------------- Urbs: a city across a river at night, a tower with a red light, reflections ----------------
def urbs():
    c = C(); r = random.Random(311)
    sky(c, 0, 34, ['#05070e', '#0b1020', '#171c32', '#2c2840'], (0, 12))
    stars(c, 14, (1, 12), ['#d8dcf0'], 312, 0)
    moon(c, 344, 9, 4, '#efe8d6', '#4a4a64')
    lit = {}
    def skyline(seed, lo, hi, base, col, wincol, p, gap=(0, 2)):
        rr = random.Random(seed); x = 0
        while x < W:
            w = rr.randint(5, 13); top = rr.randint(lo, hi)
            for xx in range(x, min(W, x + w)):
                for y in range(top, base): c.px(xx, y, col)
            for y in range(top + 2, base - 1, 3):
                for xx in range(x + 1, min(W, x + w) - 1, 2):
                    if rr.random() < p: c.px(xx, y, wincol); lit[xx] = wincol
            x += w + rr.randint(*gap)
    skyline(313, 16, 26, 38, '#1a1f34', '#3e4668', .12)
    for x in range(W):  # haze at the foot of the far skyline
        for y in range(32, 38): c.ditherpx(x, y, '#2a2c44', .35 * (y - 31) / 6)
    skyline(314, 22, 32, 40, '#0d1122', '#d8a85a', .14)
    tx = 300  # the tower
    for x in range(tx - 4, tx + 5):
        for y in range(8, 40): c.px(x, y, '#0d1122')
    for y in range(2, 8): c.px(tx, y, '#0d1122')
    c.px(tx, 1, '#ff4a4a'); halo(c, tx, 1, 3, '#ff4a4a', .5)
    for y in range(11, 39, 3):
        for x in range(tx - 3, tx + 4, 2):
            if r.random() < .45: c.px(x, y, '#ffd890'); lit[x] = '#ffd890'
    for x in range(W): c.px(x, 40, '#05070e')
    for y in range(41, H):  # the river: still water with broken reflections
        for x in range(W):
            c.px(x, y, '#060914')
            if x in lit and (y + x) % 3 != 0 and r.random() < .6: c.px(x, y, mix(lit[x], '#060914', .35 + (y - 41) * .07))
            if abs(x - 344) < 2 and (y % 2 == 0): c.px(x, y, '#8a8678')
    return c

# ---------------- Flora: a night meadow, tall flower silhouettes, a dandelion against the moon, fireflies ----------------
def flora():
    c = C(); r = random.Random(321)
    sky(c, 0, 38, ['#08081a', '#16142e', '#2e2444', '#5a3a54'], (0, 12))
    stars(c, 20, (1, 18), ['#e8e0f4'], 322, 0)
    moon(c, 300, 15, 9, '#f2e8d2', '#5a4a6a')
    far = ridge(323, 34, 2, [1, 2, 3]); fill_below(c, far, '#1a1828')
    D = '#0b0a14'
    def stem(x, top, base, bend):
        for y in range(top, base + 1): c.px(round(x + bend * ((base - y) / max(1, base - top)) ** 2), y, D)
    x = 0
    while x < W:  # grasses
        h0 = r.randint(4, 12); b = r.choice([-2, -1, 1, 2]); stem(x, H - h0, H - 1, b); x += r.randint(1, 3)
    for fx in range(4, W, r.randint(9, 15)):
        kind = r.choice(['foxglove', 'lace', 'daisy', 'grass']); base = H - 1
        if 270 < fx < 330: continue
        if kind == 'foxglove':
            top = base - r.randint(18, 26); stem(fx, top, base, 0)
            for y in range(top + 2, top + 14, 2): c.px(fx - 1, y, D); c.px(fx + 1, y + 1, D); c.px(fx - 2, y + 1, D)
        elif kind == 'lace':
            top = base - r.randint(14, 22); stem(fx, top, base, r.choice([-2, 2]))
            for k in range(-4, 5): c.px(fx + k, top - (2 if abs(k) < 3 else 1), D)
            for k in range(-3, 4, 2): c.px(fx + k, top - 3, '#d8d0e0' if r.random() < .4 else D)
        elif kind == 'daisy':
            top = base - r.randint(10, 16); stem(fx, top, base, 1)
            for d in ((0, -1), (1, 0), (-1, 0), (0, 1)): c.px(fx + 1 + d[0], top - 1 + d[1], '#e8e0ee')
            c.px(fx + 1, top - 1, '#e8c060')
    dx, dtop = 300, 21  # the dandelion clock, in front of the moon
    stem(dx, dtop, H - 1, -3)
    for k in range(28):
        a = k / 28 * 6.283; rr = 5 + (k % 2)
        line(c, dx, dtop, dx + math.cos(a) * (rr - 2), dtop + math.sin(a) * (rr - 2), D)
        c.px(round(dx + math.cos(a) * rr), round(dtop + math.sin(a) * rr), D)
    for k in range(6): c.px(dx + 9 + k * 3, dtop - 6 - k * 2 + (k % 2), D)
    for _ in range(16):
        x, y = r.randrange(W), r.randint(22, 44); glowdot(c, x, y, '#eaf59a', '#4a5a22', 1)
    return c

# ---------------- Cortex: one large neuron, its dendrites, an axon carrying a spike, faint neurons beyond ----------------
def cortex():
    c = C(); r = random.Random(341)
    for _ in range(9):  # far neurons, small and dim
        nx, ny = r.randrange(W), r.randint(4, 44)
        if 80 < nx < 240: continue
        for k in range(4):
            a = r.random() * 6.283; x, y = nx, ny
            for s in range(r.randint(4, 8)):
                x += math.cos(a); y += math.sin(a); a += r.uniform(-.3, .3); c.px(round(x), round(y), '#1c2a48')
        c.px(nx, ny, '#2e4472')
    def branch(x, y, a, L, depth, col):
        for k in range(int(L)):
            x += math.cos(a); y += math.sin(a) * .9; a += r.uniform(-.18, .18)
            c.px(round(x), round(y), col)
        if depth > 0:
            for da in (-.5, .45): branch(x, y, a + da, L * .66, depth - 1, mix(col, '#05060c', .22))
    sx, sy = 304, 22
    halo(c, sx, sy, 34, '#1a4a6a', .5, .7)
    for k in range(7): branch(sx, sy, -1.9 + k * .62 + r.uniform(-.1, .1), r.randint(8, 12), 3, '#6ad8f0')
    ax = []  # the axon runs left, under the title band, with myelin and a node-to-node spike
    x, y = sx - 4, sy + 3
    while x > -40:
        y += .25 * math.sin(x * .05); x -= 1; ax.append((round(x), round(y)))
    for i, (x, y) in enumerate(ax):
        seg = (i // 7) % 2 == 0
        c.px(x, y, '#3a8ab0' if seg else '#1e4a64')
        if seg: c.px(x, y - 1, '#1e4a64'); c.px(x, y + 1, '#1e4a64')
    px0, py0 = ax[150]
    halo(c, px0, py0, 7, '#ff6ab4', .55); c.px(px0, py0, '#ffffff'); c.px(px0 + 1, py0, '#ffd0e8')
    disc(c, sx, sy, 3.2, '#9ae8ff', '#3a9ac0', (-1, -1)); c.px(sx - 1, sy - 1, '#ffffff')
    return c

# ---------------- Medicina: a DNA double helix in soft light, cells drifting beyond ----------------
def medicina():
    c = C(); r = random.Random(351)
    for _ in range(10):  # cells, far and dim
        x, y, rr = r.randrange(W), r.randint(4, 44), r.randint(3, 6)
        if 80 < x < 240: continue
        circle(c, x, y, rr, '#14303a'); c.px(x + 1, y, '#1e4650'); c.px(x, y + 1, '#1e4650')
    hx = 300
    halo(c, hx, 24, 30, '#164a4a', .5, .9)
    pairs = ['#e86a8a', '#f0c060', '#6ac8f0', '#a8e06a']
    for y in range(-2, H + 2):  # back strand first, then rungs, then the front strand
        t = y / 7.5
        x1 = hx + 9 * math.sin(t); x2 = hx + 9 * math.sin(t + math.pi)
        z1 = math.cos(t)
        back, front = ((x1, x2) if z1 < 0 else (x2, x1))
        c.px(round(back), y, '#1f5a60'); c.px(round(back) + 1, y, '#1f5a60')
        if y % 3 == 0:
            lo, hi = sorted((x1, x2)); col = pairs[(y // 3) % 4]
            for x in range(round(lo) + 2, round(hi) - 1): c.px(x, y, mix(col, '#05080a', .35 + .25 * abs(math.cos(t))))
        c.px(round(front), y, '#8af0e0'); c.px(round(front) + 1, y, '#5ac8c0')
    return c

# ---------------- Leonardo: Florence at dusk, the dome and the bell tower, a flying machine in the sky ----------------
def leonardo():
    c = C(); r = random.Random(361)
    sky(c, 0, 36, ['#140e18', '#2c1e28', '#6a4038', '#c8844e', '#e8b070'], (0, 12))
    stars(c, 8, (1, 8), ['#f2e6d4'], 362, 0)
    far = ridge(363, 30, 4, [1, 2, 3, 5]); fill_below(c, far, '#4a3034')
    mid = ridge(364, 35, 3, [1, 2, 4]); fill_below(c, mid, '#2e1e22')
    for cx0 in (24, 46, 66, 244, 360, 374):  # cypresses on the hills
        base = int(mid[cx0]) + 1; h0 = r.randint(9, 14)
        for k in range(h0):
            hw = round(1.6 * math.sin(math.pi * (k + 1) / (h0 + 1)))
            for d in range(-hw, hw + 1): c.px(cx0 + d, base - k, '#1a1014')
    city = '#1e1416'
    for x in range(250, 372):  # terracotta roofs
        top = 38 - (2 if (x // 6) % 3 == 0 else 0) - (1 if (x // 4) % 2 else 0)
        for y in range(top, 42): c.px(x, y, city)
    dx, dy = 306, 38  # the dome on its drum, with the lantern
    for x in range(dx - 9, dx + 10):
        for y in range(dy - 6, dy): c.px(x, y, city)
    for y in range(dy - 20, dy - 5):
        hw = 9 * math.sqrt(max(0, 1 - ((dy - 6 - y) / 14) ** 2))
        for x in range(round(dx - hw), round(dx + hw) + 1): c.px(x, y, city)
    for k in (-5, 0, 5): 
        for y in range(dy - 18, dy - 6): c.px(dx + round(k * (1 - (dy - 6 - y) / 16)), y, '#3a2626')
    for y in range(dy - 25, dy - 19): c.px(dx, y, city); c.px(dx - 1, y, city) if y > dy - 22 else None
    for x in range(326, 331):  # the bell tower
        for y in range(16, 42): c.px(x, y, city)
    for y in (20, 26): c.px(328, y, '#e8a050')
    for x in range(250, 372): c.px(x, 42, city)
    fill_below(c, [42 + math.sin(6.283 * 2 * i / W) for i in range(W)], '#140c0e')
    for k in range(r.randint(3, 4)): c.px(r.randint(252, 370), r.randint(38, 41), '#f0b060')
    fx, fy = 262, 11  # the ornithopter: a body and two ribbed wings
    for d in range(-2, 3): c.px(fx + d, fy, '#2a1a1c')
    for side in (-1, 1):
        for k in range(1, 12):
            y = fy - round(3 * math.sin(math.pi * k / 12)); c.px(fx + side * (2 + k), y, '#2a1a1c')
            if k % 3 == 0:
                for j in range(1, 3): c.px(fx + side * (2 + k), y + j, '#2a1a1c')
    return c

# ---------------- Newton: an orchard under a full moon, the apple tree, a falling apple, the manor ----------------
def newton():
    c = C(); r = random.Random(371)
    sky(c, 0, 36, ['#05070f', '#0b1022', '#16203a', '#22304a'], (0, 10))
    stars(c, 26, (1, 22), ['#e6eaf6', '#cfd8f0'], 372, .05)
    moon(c, 340, 11, 6, '#f4eedc', '#3a4462')
    far = ridge(373, 34, 2, [1, 2, 3]); fill_below(c, far, '#141c26')
    fill_below(c, [41 + math.sin(6.283 * 2 * i / W) for i in range(W)], '#0b1014')
    hx0 = 22  # the manor: a gabled house with chimneys and one lit window
    for x in range(hx0, hx0 + 30):
        for y in range(30, 42): c.px(x, y, '#0e1418')
    for i in range(7):
        for x in range(hx0 - 1 + i, hx0 + 31 - i): c.px(x, 29 - i, '#0e1418')
    for xc in (hx0 + 5, hx0 + 24):
        for y in range(20, 26): c.px(xc, y, '#0e1418'); c.px(xc + 1, y, '#0e1418')
    for wx in (hx0 + 6, hx0 + 22):
        c.px(wx, 34, '#ffd27a'); c.px(wx + 1, 34, '#ffd27a'); c.px(wx, 35, '#e8a850'); c.px(wx + 1, 35, '#e8a850')
    tx, tb = 290, 42  # the apple tree
    for y in range(tb - 13, tb + 1):
        c.px(tx, y, '#0a0f10'); c.px(tx + 1, y, '#0a0f10')
        if y > tb - 4: c.px(tx - 1, y, '#0a0f10'); c.px(tx + 2, y, '#0a0f10')
    for ox, oy, rr in ((0, -21, 11), (-9, -17, 8), (10, -17, 8), (-4, -25, 7), (6, -26, 6)):
        for y in range(tb + oy - rr, tb + oy + rr + 1):
            for x in range(tx + ox - rr - 3, tx + ox + rr + 4):
                d = math.hypot((x - tx - ox) / 1.25, y - tb - oy)
                if d <= rr - .5 or (d <= rr + .7 and B4[y % 4, x % 4] < .5): c.px(x, y, '#0d1416')
    for ax, ay in ((280, 21), (297, 18), (288, 26), (303, 24), (276, 16)):  # apples catch the moonlight
        c.px(ax, ay, '#b8302a'); c.px(ax + 1, ay, '#801c18'); c.px(ax, ay - 1, '#f07060')
    c.px(318, 33, '#c8382e'); c.px(318, 32, '#f07a68')  # one falls
    for k in (1, 3, 5): c.px(318, 32 - k, '#3a4462')
    return c

# ---------------- Einstein: an Einstein ring, a galaxy lensing the light behind it, over curved spacetime ----------------
def einstein():
    c = C(); r = random.Random(381)
    stars(c, 60, (0, 44), ['#e6eeff', '#cfe0ff', '#ffe8c8'], 382, .06)
    gx, gy = 300, 18
    for row in range(6):  # a faint grid in perspective, dipping under the lens
        y0 = 30 + row * 3
        for x in range(W):
            d = abs(x - gx); dip = 5 * math.exp(-(d / 30) ** 2) * (1 - row / 8)
            c.px(x, round(y0 + dip + row * .4), '#1e2a48' if row < 3 else '#16203a')
    for k in range(-24, 25, 6):
        for row in range(18):
            yy = 30 + row; xx = gx + k * (1 + row / 14)
            d = abs(xx - gx); dip = 5 * math.exp(-(d / 30) ** 2)
            c.px(round(xx), round(yy + dip * (1 - row / 18)), '#1a2440')
    halo(c, gx, gy, 20, '#2a3a6a', .5, .8)
    for k in range(220):  # the ring, brighter on two arcs
        a = k / 220 * 6.283; b = .55 + .45 * abs(math.sin(a * 1 + .6))
        x = gx + 11 * math.cos(a); y = gy + 9 * math.sin(a)
        c.px(round(x), round(y), mix('#3a5aa8', '#cfe2ff', b))
        if b > .8: c.px(round(x + math.cos(a)), round(y + math.sin(a)), '#7a9ad8', 180)
    halo(c, gx, gy, 6, '#f4dca0', .7); disc(c, gx, gy, 2, '#fff4d8'); c.px(gx, gy, '#ffffff')
    return c

# ---------------- colour sigils (one character per pixel) ----------------
SIG = {
 'silva': (['....g....', '...ggg...', '..gGggg..', '...ggg...', '..gGgggg.', '.ggggGgg.', '...ggg...', '.gggGgggg', 'ggggggGgg', '....t....', '....t....'], {'g': '#5f9e5a', 'G': '#9fd27a', 't': '#8a5a34'}),
 'mons': (['.....w.....', '....www....', '...wwsw....', '..wsmmmw...', '..mmmmmm.m.', '.mmmmmmmmmm', 'mmmMmmmmmmm', 'mmMMMmmmMmm'], {'w': '#f2f6ff', 's': '#c9d4ea', 'm': '#7c88aa', 'M': '#4a5578'}),
 'torrens': (['...ww......', '..wbbw.....', '.wbtbbw..w.', 'wbttttbwwbw', 'bttttttbbtb', 'tttttttttt.', 'TTTTTTTTTT.'], {'w': '#f2fbfb', 'b': '#9fe0e0', 't': '#3d9fb0', 'T': '#226878'}),
 'bibliotheca': (['.rr.gg.bb..', '.rr.gg.bb.o', '.yy.yy.yy.o', '.rr.gg.bb.o', '.rr.gg.bb.o', '.rr.gg.bb.o', '.yy.yy.yy.o', '.rr.gg.bb.o', 'wwwwwwwwwww'], {'r': '#9a2c2c', 'g': '#2f6a46', 'b': '#2f4a8a', 'y': '#e0b850', 'o': '#b08a46', 'w': '#8a5a34'}),
 'mars': (['...rrrr...', '..rRRrrr..', '.rRrrrrdr.', 'rrrrrddrrr', 'rrrdddrrrr', 'rrrrrrrrdr', '.rdrrrrrr.', '..rrrrdr..', '...rrrr...'], {'r': '#d4643a', 'R': '#f0a070', 'd': '#8f3a24'}),
 'aurora': (['p.......p..', 'pp....pp...', '.gp..gp...p', '.gg.gg...pp', '..ggg....g.', '..gg.g..gg.', '.g...gggg..', 'g.....gg...'], {'p': '#a487ff', 'g': '#5fe4b4'}),
 'kairos': (['...y...', '...y...', '..yYy..', 'yyYWYyy', '..yYy..', '...y...', '...y...'], {'y': '#ffcf6b', 'Y': '#ffe7a8', 'W': '#ffffff'}),
 'aion': (['...ppp...', '.pp...tt.', '.p.....t.', 'p.......t', 'p...w...t', 'p.......t', '.t.....p.', '.tt...pp.', '...ttt...'], {'p': '#ff8fd0', 't': '#5fd8d0', 'w': '#ffffff'}),
 'shire': (['...ggggg...', '..ggGGGgg..', '.ggbbbbbgg.', 'ggbyyyyybgg', 'ggbyyyyybgg', 'ggbyyyoybgg', 'ggbyyyyybgg', 'GGGGGGGGGGG'], {'g': '#5b9455', 'G': '#7cb468', 'b': '#b8a888', 'y': '#2f6a3a', 'o': '#f0d060'}),
 'earthrise': (['...bbb...', '..bwbbb..', '.bbbwgbb.', '.bbbbbbb.', '..bbwbb..', '...bbb...', '.........', 'ggggggggg', 'GGGGGGGGG'], {'b': '#3a6fc4', 'w': '#f4f6ff', 'g': '#c8c6be', 'G': '#7a7872'}),
 'palebluedot': (['o......t...', '.o......t..', '..o..b...t.', '...o.....t.', '....o.....t', '.....o.....', '......o....'], {'o': '#8a6a4a', 't': '#7a5a40', 'b': '#cfe2ff'}),
 'deepfield': (['....y....', '.y..y..y.', '..y.y.y..', '...yWy...', 'yyyWWWyyy', '...yWy...', '..y.y.y..', '.y..y..y.', '....y....'], {'y': '#ffe6a8', 'W': '#ffffff'}),
 'pluto': (['.bbbbbbbbb.', 'b.........b', '.lllllllll.', 'l.........l', 'dddd.d.dddd', 'ddddddddddd', 'ddddddddddd'], {'b': '#5a8ad0', 'l': '#9ac8ff', 'd': '#4a6aa8'}),
 'jupiter': (['...cccc...', '..tttttt..', '.cccccccc.', 'rrrrrrrrrr', 'cccccRRccc', 'tttttRRttt', '.cccccccc.', '..rrrrrr..', '...cccc...'], {'c': '#efe4cc', 't': '#d8b88e', 'r': '#b8805a', 'R': '#c0563a'}),
 'solarpunk': (['...y.y.y...', '....yyy....', '..yyYYYyy..', '....yyy....', '...y.y.y...', '.....g.....', '..ppppppp..', '..pPpPpPp..', '.....g.....', '....ggg....'], {'y': '#f4c840', 'Y': '#fff2b0', 'g': '#5aae5a', 'p': '#2f5aa8', 'P': '#6a9ae0'}),
 'urbs': (['....r......', '....b......', '...bbb.....', '..bwbwb.bb.', '..bbbbb.bwb', 'bb.bwbwbbbb', 'bwbbbbbbwbb', 'bbbwbwbbbbb', 'bwbbbbbwbwb'], {'b': '#2a3050', 'w': '#ffc860', 'r': '#ff4a4a'}),
 'flora': (['..p...p..', '.ppp.ppp.', '..ppypp..', '.ppyyypp.', '..ppypp..', '.ppp.ppp.', '..p.g.p..', '...lg....', '....gl...', '....g....'], {'p': '#f08ab0', 'y': '#f4c430', 'g': '#3d8a3a', 'l': '#5aa84a'}),
 'cortex': (['p...p...p..', '.p..p..p...', '..p.p.p....', '...pPp.....', 'pppPWPppp..', '...pPp.....', '..p...p....', '.p.....p...', 'p.......ccc'], {'p': '#ff5fb0', 'P': '#ffa0d0', 'W': '#ffffff', 'c': '#5fe8ff'}),
 'medicina': (['f.......b', '.frrrrrb.', '..f...b..', '...fyb...', '....f....', '...bgf...', '..b...f..', '.bggggff.', 'b.......f'], {'f': '#8af0e0', 'b': '#1f8a90', 'r': '#e86a8a', 'y': '#f0c060', 'g': '#6ac8f0'}),
 'leonardo': (['.....s.....', '.....s.....', '....sss....', '...sssss...', '..sssssss..', '..s.s.s.s..', '.sssssssss.', '.sssssssss.', 'ddddddddddd'], {'s': '#d07a50', 'd': '#6a3a28'}),
 'newton': (['....tl...', '...lt....', '.rrrtrr..', 'rRrrrrrr.', 'rRrrrrrrr', 'rrrrrrrrr', 'rrrrrrrrd', '.rrrrrrd.', '..rrrdd..'], {'t': '#5a3a24', 'l': '#5aae5a', 'r': '#d0382e', 'R': '#ff8a7a', 'd': '#8a1e18'}),
 'einstein': (['...bbbbb...', '.bb.....bb.', 'b.........b', 'B....y....B', 'B...yWy...B', 'B....y....B', 'b.........b', '.bb.....bb.', '...bbbbb...'], {'b': '#5a7ad0', 'B': '#cfe2ff', 'y': '#f4dca0', 'W': '#ffffff'}),
 'starrynight': (['..yyyyy..', '.yYYYYYy.', 'yYbbbbbYy', 'yYbWWWbYy', 'yYbWbWbYy', 'yYbWWbbYy', 'yYbbbbbYy', '.yYYYYYy.', '..yyyyy..'], {'y': '#c8b850', 'Y': '#f4e070', 'b': '#2a5aa8', 'W': '#fff6b0'}),
 'scream': (['yyyyyyyyyyy', 'ooooooooooo', 'rrrrrrrrrrr', 'yyyyyyyyyyy', 'ooooo.hhh.o', 'bbbbbbhkhbb', 'bbbbbbahabb', 'BBBBBBBbBBB'], {'y': '#f4b040', 'o': '#f08a2a', 'r': '#c83a2a', 'b': '#2a5a8a', 'B': '#1a3a7a', 'h': '#d8c890', 'k': '#2a2a1a', 'a': '#c8b880'}),
 'greatwave': (['...wwww....', '..wbbbbw...', '.wbb..bww..', 'wbb....w...', 'wbb........', 'wbbb....f..', '.bbbb..fff.', 'bbbbbbbbbbb'], {'w': '#f4f0e4', 'b': '#1a3a7a', 'f': '#f4f0e4'}),
 'waterlilies': (['....p.....', '...pyp....', '....p.....', '.gggggggg.', 'gggggg.ggg', 'GGGGG..GGG', '.GGGGGGGG.'], {'p': '#f0a0c0', 'y': '#f4e070', 'g': '#3a7a4a', 'G': '#2a5a3a'}),
 'klimt': (['ggggggggg', 'gkkgggkkg', 'gkWgggWkg', 'ggggsgggg', 'gggs.sggg', 'ggs.s.sgg', 'gggs.sggg', 'ggggsgggg', 'ggggggggg'], {'g': '#e0b850', 'k': '#1a1410', 'W': '#d8d0c0', 's': '#5a3a10'}),
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
 'solarpunk': ['#2f6a4a', '#5aae5a', '#2f5aa8', '#f4c840'], 'urbs': ['#1c2238', '#7ad8ff', '#ff5fa8', '#ffc860'],
 'flora': ['#2a4a34', '#9a7ad8', '#f08ab0', '#f4c430'],
 'cortex': ['#b48aff', '#ff5fb0', '#5fe8ff', '#7cf07a'], 'medicina': ['#0c2220', '#2a9a5a', '#6cffa8', '#ff4a5a'],
 'leonardo': ['#3a2a18', '#7a6040', '#d07a50', '#d8bc8c'], 'newton': ['#ff3a3a', '#ffe23a', '#5ad84a', '#5a4ad8'],
 'einstein': ['#1f2c26', '#9ac8f0', '#f4e27a', '#f2efe2'], 'starrynight': ['#0e1e4a', '#2a5aa8', '#9ac0e0', '#f4e070'],
 'scream': ['#1a3a7a', '#c83a2a', '#f08a2a', '#f4c860'], 'greatwave': ['#1a3a6a', '#2a5aa8', '#9ab4d0', '#f4f0e4'],
 'waterlilies': ['#2a3a6a', '#3a7a4a', '#f0a0c0', '#f4e070'], 'klimt': ['#5a3a10', '#a88030', '#e0b850', '#f0d070'],
 'shire': ['#4a7a54', '#7cb468', '#d8b040', '#f4d39a'],
 'earthrise': ['#5a5854', '#c8c6be', '#2f5fb0', '#f4f6ff'],
 'palebluedot': ['#3a2a24', '#6a4430', '#8a6a4a', '#cfe2ff'], 'deepfield': ['#8a5a9a', '#c86a3a', '#ffb070', '#fff4d8'],
 'pluto': ['#0a0c14', '#2a4a8a', '#5a8ad0', '#9ac8ff'], 'jupiter': ['#8a5a3c', '#b8805a', '#c0563a', '#efe4cc'],
 'aurora': ['#22324a', '#9a7bff', '#58e0b0', '#dfe8f2'], 'kairos': ['#3a2357', '#7a4a8f', '#ffcf6b', '#fff6dc'],
 'aion': ['#2a1838', '#9a64ff', '#ff6eaa', '#46cec8'], 'chronos': ['#6f8eb0', '#a9c6e0', '#e8c27a', '#ffb85c'],
}
SCENES = dict(silva=silva, mons=mons, torrens=torrens, bibliotheca=bibliotheca, mars=mars, aurora=aurora, kairos=kairos, aion=aion, chronos=chronos,
              shire=shire, earthrise=earthrise, palebluedot=palebluedot, deepfield=deepfield, pluto=pluto, jupiter=jupiter,
              solarpunk=solarpunk, urbs=urbs, flora=flora, cortex=cortex, medicina=medicina, leonardo=leonardo, newton=newton, einstein=einstein)
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
for k in ('starrynight', 'scream', 'greatwave', 'waterlilies', 'klimt'):  # painting themes: banners come from tools/paintings.py
    out[k] = {'sigil': uri(sigil(k).png()), 'band': uri(band(BANDS[k]).png())}
json.dump(out, open('tools/out/assets.json', 'w'))
print({k: len(v.get('vista', '')) for k, v in out.items()})
