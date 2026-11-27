"""Writes the colour blocks of the pixel themes into src/style.css from tools/out/assets.json.
Run from the repository root after python3 tools/pixelart.py. The shared pixel rules are kept by hand in style.css."""
import json, re
A = json.load(open('tools/out/assets.json'))
def rgb(h): h = h.lstrip('#'); return f'{int(h[0:2],16)}, {int(h[2:4],16)}, {int(h[4:6],16)}'
T = {}
# name: (comment, spec)
T['kairos'] = ('Kairos, the right moment (after the Kairos focus timer): deep space, starlight cream, stellar gold, mint.', dict(
  bg=['#040308', '#07060c', '#06050b', '#12101c'], rule='#221f2e', bh='#383349', text='#e6dfcc', bright='#f6f0e0', muted='#a39cb3', faint='#7a7390',
  acc='#ffcf6b', dim='#b8913f', on='#120e06', ahov='#ffdd8f', link='#ffd47a', lhov='#ffe3a6', verd='#8fe3c8', slate='#a9c8ff', plum='#c9a6ff',
  red='#ff6d4d', orange='#ffa65e', cyan='#7fd4ff', pink='#ff96c0', warn='#ff9b82', err='#ff7a5c', lit='#ffe2a8', statb='#8fe3c8', hi='#ffcf6b',
  code=['#c9bfd8', '#ffcf6b', '#a39cb3', '#8fe3c8'], gl='#2b2740', gt='#c9c2d8', gp='#463f5e', glows=['rgba(150, 90, 200, .09) 50% 0', 'rgba(255, 207, 107, .045) 92% 100%'], ink='invert(.92) sepia(.25) saturate(1.2) brightness(1.05)'))
T['aion'] = ('Aion, the age of the cosmos: a violet void, nebula pink, hydrogen teal.', dict(
  bg=['#07040d', '#0b0714', '#090611', '#170f25'], rule='#271c3a', bh='#3e2e58', text='#e9e0f5', bright='#f8f2ff', muted='#a798c2', faint='#7e6f9b',
  acc='#ff8fd0', dim='#b35c92', on='#16061a', ahov='#ffb0de', link='#ff9ad5', lhov='#ffbfe5', verd='#5fd8d0', slate='#8fa6ff', plum='#c79cff',
  red='#ff5f7e', orange='#ffad73', cyan='#5fd8d0', pink='#ff8fd0', warn='#ff9db0', err='#ff6f8c', lit='#ffd9a8', statb='#5fd8d0', hi='#5fd8d0',
  code=['#cbbfe0', '#ff8fd0', '#a798c2', '#5fd8d0'], gl='#2e2245', gt='#cdc1e2', gp='#4b3a6a', glows=['rgba(255, 110, 170, .08) 18% 0', 'rgba(70, 206, 200, .055) 88% 10%'], ink='invert(.92) sepia(.4) hue-rotate(250deg) saturate(1.4)'))
T['chronos'] = ('Chronos, counted time, the planet Saturn: an ice-blue night, cold light, amber rings.', dict(
  bg=['#03060b', '#060a11', '#05080e', '#0e1622'], rule='#18243a', bh='#283a58', text='#dce7f2', bright='#f0f6fc', muted='#8fa1b7', faint='#687c95',
  acc='#86dcff', dim='#3f8db3', on='#031018', ahov='#ade8ff', link='#93e0ff', lhov='#bdeeff', verd='#6fe0b4', slate='#9db4ff', plum='#b9a3ff',
  red='#ff7062', orange='#ffb85c', cyan='#86dcff', pink='#ff9ac2', warn='#ffab9b', err='#ff7c6e', lit='#ffd9a3', statb='#ffb85c', hi='#ffb85c',
  code=['#b9c8d9', '#86dcff', '#8fa1b7', '#ffc78a'], gl='#1d2b44', gt='#bccbdc', gp='#34486a', glows=['rgba(134, 220, 255, .06) 50% 0', 'rgba(255, 184, 92, .05) 85% 100%'], ink='invert(.92) sepia(.3) hue-rotate(170deg) saturate(1.3)'))
T['silva'] = ('Silva, the forest: pine-dark green, moonlit text, fern and firefly light.', dict(
  bg=['#070c0a', '#0b120f', '#09100d', '#14201a'], rule='#1f2e26', bh='#2f4539', text='#d7e0d2', bright='#eef4e8', muted='#8fa293', faint='#6c8072',
  acc='#a8d878', dim='#5f8a45', on='#0a1206', ahov='#c2e89a', link='#b4de88', lhov='#cfecaa', verd='#6fc0a0', slate='#8fb0c8', plum='#b49ac0',
  red='#e07058', orange='#e0a560', cyan='#7ec2c8', pink='#d998a8', warn='#eaa890', err='#e47a62', lit='#e2f58a', statb='#6fc0a0', hi='#e2f58a',
  code=['#b5c4b4', '#a8d878', '#8fa293', '#e2d6a0'], gl='#22342a', gt='#c2cfc0', gp='#3a5244', glows=['rgba(168, 216, 120, .05) 50% 0', 'rgba(226, 245, 138, .03) 20% 100%'], ink='invert(.9) sepia(.35) hue-rotate(50deg) saturate(.9)'))
T['mons'] = ('Mons, the mountains at dawn: slate blue ranges, snow-white text, alpenglow rose and gold.', dict(
  bg=['#090a12', '#0e1019', '#0b0d16', '#171a28'], rule='#232739', bh='#353b55', text='#dcdeea', bright='#f2f4fb', muted='#959ab2', faint='#73789a',
  acc='#f2b48a', dim='#a87458', on='#170c06', ahov='#f8caa6', link='#f5bf98', lhov='#fad4b8', verd='#7fb8b0', slate='#9aaee0', plum='#c49ab8',
  red='#e07068', orange='#e8a070', cyan='#88b8d8', pink='#e098a8', warn='#f0aa9a', err='#e8786c', lit='#eef2fa', statb='#9aaee0', hi='#d99a76',
  code=['#bfc3d6', '#f2b48a', '#959ab2', '#c9d4ea'], gl='#272c40', gt='#c5c9db', gp='#3e4562', glows=['rgba(217, 154, 118, .06) 50% 0', 'rgba(154, 174, 224, .04) 85% 100%'], ink='invert(.9) sepia(.2) hue-rotate(200deg) saturate(.8)'))
T['torrens'] = ('Torrens, the whitewater river: gorge-dark teal, spray-white text, glacial cyan.', dict(
  bg=['#050c0e', '#081215', '#071012', '#112024'], rule='#1a2e33', bh='#29454c', text='#d6e6e8', bright='#eef9fa', muted='#8aa6aa', faint='#678488',
  acc='#7fe0e0', dim='#3a9aa2', on='#031214', ahov='#a6ecec', link='#8ce4e4', lhov='#b6f0f0', verd='#6fd8b0', slate='#8fb4e0', plum='#b0a0d8',
  red='#f07a6a', orange='#f0b070', cyan='#7fe0e0', pink='#e8a0b8', warn='#f4b0a0', err='#f08070', lit='#eaf7f6', statb='#f0b070', hi='#8fd4d6',
  code=['#b4cbce', '#7fe0e0', '#8aa6aa', '#c8e8d8'], gl='#1d3439', gt='#bfd2d4', gp='#33545b', glows=['rgba(127, 224, 224, .05) 50% 0', 'rgba(234, 247, 246, .03) 80% 100%'], ink='invert(.9) sepia(.3) hue-rotate(140deg) saturate(1.1)'))
T['bibliotheca'] = ('Bibliotheca, the library at night: walnut dark, candlelit vellum text, gilt, oxblood, bottle green.', dict(
  bg=['#0b0705', '#110b08', '#0e0906', '#1d1410'], rule='#2e2119', bh='#463326', text='#e2d6bf', bright='#f4ead4', muted='#a8957a', faint='#84735c',
  acc='#d9ae55', dim='#93723a', on='#140d04', ahov='#e8c477', link='#e0b866', lhov='#ecd08f', verd='#6f9e7a', slate='#8a9cc0', plum='#b08aa0',
  red='#c8584a', orange='#d48c4e', cyan='#88aab0', pink='#c88a94', warn='#e0a08a', err='#d0604e', lit='#cdb98e', statb='#c8584a', hi='#d9ae55',
  code=['#c3b49c', '#d9ae55', '#a8957a', '#b8c49a'], gl='#33251b', gt='#cbbda4', gp='#4e3a2b', glows=['rgba(255, 179, 64, .055) 50% 0', 'rgba(200, 88, 74, .035) 10% 100%'], ink='invert(.9) sepia(.5) saturate(.9) brightness(1.02)'))
T['mars'] = ('Mars: rust and umber ground, dust-pale text, butterscotch sky, the blue of a Martian sunset.', dict(
  bg=['#0d0605', '#140a08', '#110807', '#22130f'], rule='#331d17', bh='#4d2c22', text='#ead8cc', bright='#f8ece2', muted='#b0907e', faint='#8a6e5e',
  acc='#f08a54', dim='#a85a34', on='#180904', ahov='#f6a678', link='#f4986a', lhov='#f8b896', verd='#88b0a0', slate='#8fb4e0', plum='#b894b0',
  red='#e8604a', orange='#f0a860', cyan='#8fb4e0', pink='#e09a9a', warn='#f4ae96', err='#ee6e58', lit='#e8c8a0', statb='#8fb4e0', hi='#d9844f',
  code=['#cdb4a6', '#f08a54', '#b0907e', '#e8c8a0'], gl='#3a2219', gt='#d4bcae', gp='#5a3528', glows=['rgba(201, 139, 92, .06) 50% 0', 'rgba(143, 180, 224, .035) 85% 100%'], ink='invert(.9) sepia(.5) hue-rotate(-15deg) saturate(1.2)'))
T['ignis'] = ('Ignis, fire: charcoal ground, ash-warm text, flame orange, ember gold.', dict(
  bg=['#0b0605', '#110907', '#0e0706', '#1e110d'], rule='#311b15', bh='#4c2a20', text='#efdccc', bright='#fbefe4', muted='#b29482', faint='#8c7060',
  acc='#ff8a3a', dim='#b0521f', on='#1a0803', ahov='#ffa868', link='#ff9a52', lhov='#ffbb88', verd='#9cc08a', slate='#9ab0d8', plum='#c49ab4',
  red='#ff5a3a', orange='#ffc046', cyan='#8ab8c8', pink='#f09aa0', warn='#ffb09a', err='#ff6a4a', lit='#ffe0a0', statb='#ffc046', hi='#ffc046',
  code=['#d0b8a8', '#ff8a3a', '#b29482', '#ffd890'], gl='#38201a', gt='#d8c0b0', gp='#58322a', glows=['rgba(255, 138, 58, .07) 50% 100%', 'rgba(255, 192, 70, .035) 50% 0'], ink='invert(.9) sepia(.6) hue-rotate(-20deg) saturate(1.5)'))
T['aurora'] = ('Aurora, the northern lights: polar navy, snow text, aurora green with violet.', dict(
  bg=['#04070f', '#070b16', '#060912', '#0f1626'], rule='#18223a', bh='#283656', text='#dde6f2', bright='#f2f6fc', muted='#8f9eb8', faint='#6b7b98',
  acc='#6ff2b8', dim='#2f9a74', on='#03140c', ahov='#9cf6cf', link='#7ef4c0', lhov='#aaf8d6', verd='#6ff2b8', slate='#9aa8f0', plum='#b49aff',
  red='#f07080', orange='#f0b878', cyan='#88d0f0', pink='#e8a0d0', warn='#f4aab4', err='#f07888', lit='#dfe8f2', statb='#b49aff', hi='#b49aff',
  code=['#b8c6da', '#6ff2b8', '#8f9eb8', '#c8b8ff'], gl='#1c2842', gt='#c0cce0', gp='#33456a', glows=['rgba(111, 242, 184, .05) 50% 0', 'rgba(180, 154, 255, .045) 85% 0'], ink='invert(.92) sepia(.3) hue-rotate(110deg) saturate(1.2)'))
ORDER = ['kairos', 'aion', 'chronos', 'silva', 'mons', 'torrens', 'bibliotheca', 'mars', 'ignis', 'aurora']
def block(k):
    note, s = T[k]; a = rgb(s['acc']); w = rgb(s['warn']); t = rgb(s['text']); bg0 = rgb(s['bg'][0])
    g = ',\n             '.join(f'radial-gradient(ellipse 60% 300px at {pos}, {col}, transparent 70%)' for col, pos in (x.rsplit(' ', 2)[0] and (x[:x.index(')') + 1], x[x.index(')') + 2:]) for x in s['glows']))
    v = f'''/* {note} */
[data-theme="{k}"] {{
  color-scheme: dark;
  --ist-bg-0: {s['bg'][0]}; --ist-bg-1: {s['bg'][1]}; --ist-bg-2: {s['bg'][2]}; --ist-bg-3: {s['bg'][3]};
  --ist-rule: {s['rule']}; --border-hover: {s['bh']};
  --ist-text: {s['text']}; --ist-text-bright: {s['bright']}; --ist-text-muted: {s['muted']}; --ist-text-faint: {s['faint']};
  --ist-gold: {s['acc']}; --ist-gold-dim: {s['dim']}; --ist-verdigris: {s['verd']}; --ist-slate: {s['slate']}; --ist-plum: {s['plum']};
  --ist-oxblood: {s['red']}; --ist-warn: {s['warn']}; --text-on-accent: {s['on']}; --text-accent-hover: {s['ahov']};
  --link-color: {s['link']}; --link-color-hover: {s['lhov']}; --link-underline: rgba({rgb(s['link'])}, .48);
  --text-error: {s['err']}; --accent-rgb: {a}; --warn-rgb: {w}; --ink-rgb: {bg0};
  --selection: rgba({a}, .24); --text-selection: rgba({a}, .2);
  --highlight-background: rgba({rgb(s['hi'])}, .2); --hover: rgba({t}, .045); --active-item: rgba({a}, .08);
  --menu-hover: rgba({a}, .1); --tag-border: rgba({a}, .34); --candle-glow: rgba({a}, .05);
  --cover: rgba({bg0}, .86);
  --code-normal: {s['code'][0]}; --code-keyword: {s['code'][1]}; --code-operator: {s['code'][2]}; --code-string: {s['code'][3]};
  --c-red: {s['red']}; --c-orange: {s['orange']}; --c-cyan: {s['cyan']}; --c-pink: {s['pink']};
  --graph-line: {s['gl']}; --graph-text: {s['gt']}; --graph-edge: {s['gl']}; --graph-plain: {s['gp']}; --lg-plain: {s['gp']};
  --shadow-popover: 0 12px 40px rgba(0, 0, 0, .7); --shadow-notice: 0 6px 22px rgba(0, 0, 0, .7);
  --shadow-tooltip: 0 0 0 1px {s['rule']}, 0 6px 22px rgba(0, 0, 0, .7);
  --t-concept: {s['muted']}; --t-question: {s['orange']}; --t-literature: {s['lit']}; --t-person: {s['pink']}; --t-structure: {s['bright']};
  --t-definition: {s['verd']}; --t-theorem: {s['acc']}; --t-proof: {s['muted']}; --t-example: {s['lit']};
  --t-law: {s['slate']}; --t-derivation: {s['orange']};
  --t-argument: {s['plum']}; --t-objection: {s['red']}; --t-position: {s['verd']};
  --rel-pro: {s['verd']}; --rel-con: {s['red']}; --rel-struct: {s['slate']}; --rel-seq: {s['muted']};
  --stat-a: {s['acc']}; --stat-b: {s['statb']};
  --scroll-thumb: {s['rule']}; --scroll-thumb-hover: {s['bh']}; --math-src-bg: rgba({bg0}, .7); --pdf-dark-page: {s['bg'][3]};
  --ink-filter: {s['ink']};
  --ambient: {g};
  --vista: {A[k]['vista']};
  --sigil: {A[k]['sigil']};
  --band: {A[k]['band']};
}}
'''
    return v
SHARED = '''
/* ---------- shared rules of the pixel themes ----------
   Text keeps the Istari type. Pixel art lives only where there is no text: a landscape at the foot of
   the sidebar, along the foot of the graph and on each picker card; a colour sigil before each heading
   and as the section break; a pixel colour band under each top heading; notched pixel frames. */
:root[data-pixel] {
  --notch: polygon(2px 0, calc(100% - 2px) 0, calc(100% - 2px) 1px, calc(100% - 1px) 1px, calc(100% - 1px) 2px, 100% 2px, 100% calc(100% - 2px), calc(100% - 1px) calc(100% - 2px), calc(100% - 1px) calc(100% - 1px), calc(100% - 2px) calc(100% - 1px), calc(100% - 2px) 100%, 2px 100%, 2px calc(100% - 1px), 1px calc(100% - 1px), 1px calc(100% - 2px), 0 calc(100% - 2px), 0 2px, 1px 2px, 1px 1px, 2px 1px);
}
/* the landscape at the foot of the sidebar (256 x 48 pixels, drawn at 2x); the list fades out above it */
:root[data-pixel] .sb-listwrap::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 96px; z-index: 1; pointer-events: none;
  background: var(--vista) left bottom / 512px 96px repeat-x; image-rendering: pixelated; }
:root[data-pixel] .side-body { padding-bottom: 116px; -webkit-mask-image: linear-gradient(#000 calc(100% - 120px), transparent calc(100% - 52px)); mask-image: linear-gradient(#000 calc(100% - 120px), transparent calc(100% - 52px)); }
/* the landscape along the foot of the graph, drawn at 3x */
:root[data-pixel] .graph-wrap { isolation: isolate; }
:root[data-pixel] .graph-wrap::before { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 144px; z-index: -1; pointer-events: none; opacity: .85;
  background: var(--vista) left bottom / 768px 144px repeat-x; image-rendering: pixelated; }
/* a colour sigil before each heading of the second level, and as the section break */
:root[data-pixel] :is(.cm-h2, .prose h2)::before { width: .7em; height: .7em; margin-right: .5em; vertical-align: -.02em; background: var(--sigil) center / contain no-repeat; -webkit-mask: none; mask: none; image-rendering: pixelated; }
:root[data-pixel] :is(.prose hr, .cm-lp-hr)::after { width: 34px; height: 22px; top: -11px; border: 0; transform: translateX(-50%);
  background: var(--sigil) center / 22px 22px no-repeat, var(--ist-bg-1); image-rendering: pixelated; }
/* a pixel colour band under each heading of the first level and under the note title */
:root[data-pixel] :is(.prose h1, .cm-h1)::after { width: 96px; height: 4px; background: var(--band) left / 96px 4px no-repeat; image-rendering: pixelated; }
:root[data-pixel] .props { position: relative; }
:root[data-pixel] .props::after { content: ''; position: absolute; left: 0; bottom: -1px; width: 96px; height: 4px; background: var(--band) left / 96px 4px no-repeat; image-rendering: pixelated; pointer-events: none; }
/* notched pixel frames: a 1-pixel border with the corner pixel left out */
:root[data-pixel] .btn { --pxb: var(--ist-gold-dim); border-color: transparent; border-radius: 0; box-shadow: 0 -1px 0 var(--pxb), 0 1px 0 var(--pxb), -1px 0 0 var(--pxb), 1px 0 0 var(--pxb); }
:root[data-pixel] .btn-danger { --pxb: rgba(var(--warn-rgb), .5); }
:root[data-pixel] :is(.btn-cta, .btn-primary) { box-shadow: 0 -1px 0 var(--pxb), 0 1px 0 var(--pxb), -1px 0 0 var(--pxb), 1px 0 0 var(--pxb), inset 0 -3px 0 rgba(0, 0, 0, .25); }
:root[data-pixel] :is(.btn-cta, .btn-primary):hover { --pxb: var(--ist-gold); box-shadow: 0 -1px 0 var(--pxb), 0 1px 0 var(--pxb), -1px 0 0 var(--pxb), 1px 0 0 var(--pxb), inset 0 -3px 0 rgba(0, 0, 0, .25), 0 0 14px rgba(var(--accent-rgb), .3); }
:root[data-pixel] .btn:active { transform: translateY(1px); }
:root[data-pixel] :is(kbd, .prose a.tag, .mn-ctx a.tag) { border-color: transparent; border-radius: 0; box-shadow: 0 -1px 0 var(--pxb, var(--ist-rule)), 0 1px 0 var(--pxb, var(--ist-rule)), -1px 0 0 var(--pxb, var(--ist-rule)), 1px 0 0 var(--pxb, var(--ist-rule)); }
:root[data-pixel] :is(.prose a.tag, .mn-ctx a.tag) { --pxb: var(--tag-border); margin: 0 1px; }
:root[data-pixel] :is(.toast, .menu, .badge, .tp-card, .hover-card) { border-radius: 0; clip-path: var(--notch); }
/* a soft glow on the active pigment */
:root[data-pixel] .side-item.on { box-shadow: inset 3px 0 0 var(--ist-gold); }
:root[data-pixel] .sb-tab.on { border-bottom: 2px solid var(--ist-gold); }
:root[data-pixel] .tab.on::after { background: var(--ist-gold); border-radius: 0; }
:root[data-pixel] .badge { box-shadow: 0 0 8px rgba(var(--accent-rgb), .5); }
:root[data-pixel] .cm-cursor { border-left: 2px solid var(--ist-gold) !important; }
@media (prefers-reduced-motion: reduce) { :root[data-pixel] .btn:active { transform: none; } }
@media print { :root[data-pixel] :is(.cm-h2, .prose h2)::before, :root[data-pixel] .props::after { display: none; } }
'''
HEAD = '''
/* ---------- the pixel themes ----------
   Kairos, Aion and Chronos are named for the three Greek words for time; Silva, Mons, Torrens,
   Bibliotheca, Mars, Ignis and Aurora are landscapes, with Latin names. Each has its own pixel-art
   landscape, colour sigil and colour band. The text stays in the Istari type. */
'''
css = HEAD + ''.join(block(k) for k in ORDER) + '\n'
p = 'src/style.css'; s = open(p).read()
a = s.index('\n/* ---------- the pixel themes ----------'); b = s.index('/* ---------- shared rules of the pixel themes')
s = s[:a] + css + s[b:]
open(p, 'w').write(s)
print(len(css))
