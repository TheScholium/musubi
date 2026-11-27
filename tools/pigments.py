"""Gives every theme its own palette for the 13 Istari pigments that note types use (gold, ochre, vermilion,
oxblood, rose, plum, slate, sky, verdigris, moss, parchment, bone, ash). Each pigment maps to the theme colour
with the same role; pigments that come out too close are pushed apart, so the 13 stay distinct in every theme.
Writes the section between the PIGMENTS markers in src/style.css. Run from the repository root."""
import re, colorsys
CSS = 'src/style.css'
s = open(CSS).read()
def blocks():
    out = {}
    for m in re.finditer(r'([^{}]*)\{([^{}]*)\}', s):
        sel, body = re.sub(r'/\*.*?\*/', '', m.group(1), flags=re.S).strip(), m.group(2)
        if sel.strip().startswith(':root, [data-theme="istari"]'): tid = 'istari'
        else:
            t = re.findall(r'\[data-theme="([a-z-]+)"\]', sel)
            if len(t) == 0 or len(set(t)) != 1 or ':not' in sel or ' ' in sel.replace(', ', ',').split(',')[-1].strip(): continue
            tid = t[0]
        vars_ = dict(re.findall(r'(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b', body))
        if '--ist-gold' in vars_ or tid == 'istari': out.setdefault(tid, {}).update(vars_)
    return out
B = blocks()
ROOT = B['istari']
ROLE = [('gold', '--ist-gold'), ('ochre', '--c-orange'), ('vermilion', '--c-red'), ('oxblood', '--ist-oxblood'), ('rose', '--c-pink'),
        ('plum', '--ist-plum'), ('slate', '--ist-slate'), ('sky', '--c-cyan'), ('verdigris', '--ist-verdigris'), ('moss', None),
        ('parchment', '--t-literature'), ('bone', '--ist-text-bright'), ('ash', '--ist-text-muted')]
ISTARI = {'gold': '#c4a24d', 'ochre': '#c7844f', 'vermilion': '#be6052', 'oxblood': '#9a4a3e', 'rose': '#b87884', 'plum': '#a07f98', 'slate': '#7f93b4',
          'sky': '#829eb6', 'verdigris': '#6d9a90', 'moss': '#8a9a62', 'parchment': '#c8b79a', 'bone': '#ebe1c8', 'ash': '#948b76'}
rgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
hexc = lambda c: '#%02x%02x%02x' % tuple(max(0, min(255, round(v))) for v in c)
mix = lambda a, b, t: hexc([x + (y - x) * t for x, y in zip(rgb(a), rgb(b))])
def lab(h):
    def f(c):
        c /= 255; return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
    r, g, b = (f(v) for v in rgb(h))
    X, Y, Z = (r * .4124 + g * .3576 + b * .1805) / .9505, r * .2126 + g * .7152 + b * .0722, (r * .0193 + g * .1192 + b * .9505) / 1.089
    g_ = lambda t: t ** (1 / 3) if t > .008856 else 7.787 * t + 16 / 116
    return 116 * g_(Y) - 16, 500 * (g_(X) - g_(Y)), 200 * (g_(Y) - g_(Z))
dE = lambda a, b: sum((x - y) ** 2 for x, y in zip(lab(a), lab(b))) ** .5
def shift_hue(h, deg):
    r, g, b = (v / 255 for v in rgb(h)); hh, l, s_ = colorsys.rgb_to_hls(r, g, b)
    return hexc([v * 255 for v in colorsys.hls_to_rgb((hh + deg / 360) % 1, l, s_)])
def palette(tid):
    if tid == 'istari': return dict(ISTARI)
    v = {**ROOT, **B[tid]}
    bg, text = v.get('--ist-bg-1', '#12100e'), v.get('--ist-text', '#d6ccb4')
    light = lab(bg)[0] > 50
    pal = {}
    for name, var in ROLE:
        if name == 'moss': c = mix(v['--ist-verdigris'], v['--ist-gold'], .5)
        elif name == 'oxblood' and dE(v.get(var, '#000000'), pal['vermilion']) < 14: c = mix(pal['vermilion'], '#000000' if light else bg, .32)
        else: c = v.get(var) or ISTARI[name]
        tries = 0
        while any(dE(c, o) < 14 for o in pal.values()) and tries < 8:  # too close to an earlier pigment: shift hue, then lightness
            tries += 1
            c = shift_hue(c, 22 if tries % 2 else -38) if tries < 5 else mix(c, text if tries % 2 else ('#000000' if light else bg), .22)
        pal[name] = c
    return pal
order = ['istari'] + [t for t in B if t != 'istari']
lines = ['/* PIGMENTS: the 13 Istari pigments of note types, mapped to each theme (written by tools/pigments.py) */']
for tid in order:
    sel = ':root, [data-theme="istari"]' if tid == 'istari' else f'[data-theme="{tid}"]'
    lines.append(sel + ' { ' + ' '.join(f'--pg-{k}: {c};' for k, c in palette(tid).items()) + ' }')
lines.append('/* END PIGMENTS */')
sec = '\n'.join(lines) + '\n'
if '/* PIGMENTS:' in s:
    a = s.index('/* PIGMENTS:'); b = s.index('/* END PIGMENTS */') + len('/* END PIGMENTS */\n')
    s = s[:a] + sec + s[b:]
else:
    s = s.rstrip('\n') + '\n\n' + sec
open(CSS, 'w').write(s)
print(len(order), 'themes:', ', '.join(order))
