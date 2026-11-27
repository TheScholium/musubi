"""Procedural pixel art for Musubi's pixel themes. Every vista tiles horizontally (period W)."""
import numpy as np, random, math, json, base64, io, sys, os
os.makedirs("tools/out", exist_ok=True)  # run from the repository root: python3 tools/pixelart.py
from PIL import Image
W, H = 256, 48
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
def sky(c, y0, y1, cols, fade=(0, 10)):
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
    disc(c, 206, 8, 4, '#e8e4c4'); disc(c, 208, 7, 3.6, '#00000000' if False else '#0c1714')  # crescent
    for y in range(3, 14):
        for x in range(200, 214):
            if tuple(c.get(x, y)[:3]) == hx('#0c1714')[:3] and math.hypot(x - 206, y - 8) <= 4 and math.hypot(x - 208, y - 7) <= 3.6:
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
# ---------------- Torrens: a whitewater river through a gorge ----------------
def torrens():
    c = C(); sky(c, 0, 30, ['#1c3440', '#3b6268', '#79a8a0'], (0, 9))
    bank = ridge(21, 22, 5, [1, 2, 3, 6, 10])
    r = random.Random(22); x = 0
    while x < W:
        pine(c, x, int(bank[x]) + 2, r.randint(7, 13), '#0f2424'); x += r.randint(3, 6)
    fill_below(c, bank, '#0f2424')
    rock = ridge(23, 30, 2.5, [3, 5, 9, 17])
    fill_below(c, rock, '#36464e', '#56686f', 2)
    for _ in range(40):
        x = r.randrange(W); y = int(rock[x]) + r.randint(0, 3); c.px(x, y, '#6f8288')
    for y in range(33, H):
        for x in range(W):
            c.px(x, y, '#1c5a6b' if y < 40 else '#164a5a')
    # rocks in the stream with foam piled on the upstream side (flow left to right)
    rocks = [(r.randrange(W), r.randint(36, 45), r.randint(2, 4)) for _ in range(9)]
    for y in range(33, H):  # rapids: diagonal standing waves
        for x in range(W):
            w = math.sin(6.283 * (x * 6 / W) + y * .9) + .6 * math.sin(6.283 * (x * 15 / W) - y * 1.7) + .4 * math.sin(6.283 * x * 31 / W + y * 3.1)
            if w > 1.25: c.px(x, y, '#eaf7f6')
            elif w > .8: c.ditherpx(x, y, '#8fd4d6', .7)
    for rx, ry, rr in rocks:
        for y in range(ry - rr, ry + 2):
            for x in range(rx - rr - 3, rx + rr + 1):
                d = math.hypot((x - rx) / 1.4, (y - ry) * 1.2)
                if d <= rr: c.px(x, y, '#2a363c' if y > ry - rr + 1 else '#4a5a60')
                elif d <= rr + 1.6 and x <= rx: c.px(x, y, '#f4fbfb')
        for k in range(1, 7): c.ditherpx(rx + rr + k, ry, '#cdeeee', 1 - k / 7)
    for _ in range(18):
        x, y = r.randrange(W), r.randint(31, 34); c.px(x, y, '#cfeeee', 120)
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
    cx = 150
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
    disc(c, 58, 6, 1.6, '#c8b49a'); c.px(57, 7, '#8f7d68'); c.px(182, 4, '#d8c8b0')
    mesa = ridge(41, 26, 3, [1, 2]); mesa = [m - 6 * math.exp(-((x - 90) / 30) ** 2) for x, m in enumerate(mesa)]
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
    gx, gy = 70, 16  # the forge: violet halo, gold core
    for y in range(0, 34):
        for x in range(gx - 30, gx + 31):
            d = math.hypot(x - gx, (y - gy) * 1.4)
            if d < 20: c.ditherpx(x, y, '#2e1c48' if d > 11 else ('#6a3f84' if d > 5 else '#b07a6a'), .95 * (1 - d / 20) ** .8)
    for k in range(1, 9):
        a = .9 * (1 - k / 9)
        for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)): c.px(gx + dx, gy + dy, '#ffcf6b', int(255 * a))
    disc(c, gx, gy, 1.5, '#fff6dc')
    R, cx, cy = 300, 128, 48 + 288
    for x in range(W):
        top = cy - math.sqrt(max(0, R * R - (x - cx) ** 2))
        for y in range(max(0, int(top)), H):
            d = y - top
            c.px(x, y, '#ffcf6b' if d < 1 else ('#8a5a2a' if d < 2 else '#0d0a16'))
            if 2 <= d < 6: c.ditherpx(x, y, '#2a1c30', 1 - (d - 2) / 4)
    return c
# ---------------- Aion: pillars of a nebula, pink and teal gas ----------------
def aion():
    c = C(); stars(c, 50, (0, 46), ['#f3e8ff', '#ff9fd6', '#7fe3dc'], 81, .1)
    r = random.Random(82)
    for (bx, by, rad, col) in [(40, 14, 26, '#ff6eaa'), (130, 10, 30, '#46cec8'), (210, 18, 24, '#9a64ff'), (170, 26, 18, '#ff6eaa')]:
        for y in range(0, H):
            for x in range(bx - rad - 6, bx + rad + 7):
                d = math.hypot(x - bx, (y - by) * 1.6) / rad + .25 * math.sin(x * .4 + y * .7) * math.sin(x * .13)
                if d < 1: c.ditherpx(x, y, col if d < .6 else mix(col, '#0b0714', .55), .95 * (1 - d) ** .9)
    for px0, w0, h0 in [(30, 9, 30), (52, 6, 20), (150, 11, 34), (236, 7, 24)]:
        for y in range(H - h0, H):
            t = (y - (H - h0)) / h0; half = w0 * (.35 + .65 * t) + 1.2 * math.sin(y * .8)
            for x in range(int(px0 - half), int(px0 + half) + 1):
                edge = abs(x - px0) > half - 1.2 or y == H - h0
                c.px(x, y, '#ff9fd6' if edge and x < px0 else ('#2a1838' if not edge else '#5b2f5f'))
    return c
# ---------------- Chronos: Saturn over the ice plains of a moon ----------------
def chronos():
    c = C(); stars(c, 55, (0, 38), ['#e6f1ff', '#9fd8ff', '#ffd29a'], 91, .1)
    sx, sy, sr = 178, 17, 9
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
 'mars': ['#7b3a26', '#b45a35', '#d9844f', '#c8b49a'], 'ignis': ['#a82416', '#e0481c', '#ff8a2a', '#ffeab0'],
 'aurora': ['#22324a', '#9a7bff', '#58e0b0', '#dfe8f2'], 'kairos': ['#3a2357', '#7a4a8f', '#ffcf6b', '#fff6dc'],
 'aion': ['#2a1838', '#9a64ff', '#ff6eaa', '#46cec8'], 'chronos': ['#6f8eb0', '#a9c6e0', '#e8c27a', '#ffb85c'],
}
SCENES = dict(silva=silva, mons=mons, torrens=torrens, bibliotheca=bibliotheca, mars=mars, ignis=ignis, aurora=aurora, kairos=kairos, aion=aion, chronos=chronos)
out = {}
uri = lambda b: 'url("data:image/png;base64,' + base64.b64encode(b).decode() + '")'
sheet = Image.new('RGBA', (W * 3 + 40 + 60, (H * 3 + 12) * len(SCENES)), (20, 20, 24, 255))
for i, (k, f) in enumerate(SCENES.items()):
    v = f(); s = sigil(k); b = band(BANDS[k])
    out[k] = {'vista': uri(v.png()), 'sigil': uri(s.png()), 'band': uri(b.png())}
    y0 = i * (H * 3 + 12)
    bgc = Image.new('RGBA', (W * 3, H * 3), (13, 12, 16, 255)); bgc.alpha_composite(Image.fromarray(v.a).resize((W * 3, H * 3), Image.NEAREST)); sheet.paste(bgc, (0, y0))
    si = Image.fromarray(s.a).resize((s.w * 4, s.h * 4), Image.NEAREST); sheet.alpha_composite(si, (W * 3 + 10, y0 + 10))
    sheet.paste(Image.fromarray(b.a).resize((96, 8), Image.NEAREST), (W * 3 + 10, y0 + 70))
sheet.save('tools/out/sheet.png')
json.dump(out, open('tools/out/assets.json', 'w'))
print({k: len(v['vista']) for k, v in out.items()})
