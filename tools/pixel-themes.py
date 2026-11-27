"""Writes the colour blocks of the pixel themes into src/style.css from tools/out/assets.json.
Run from the repository root after python3 tools/pixelart.py. The shared pixel rules are kept by hand in style.css."""
import json, re
def mix(a, b, t):
    a, b = a.lstrip('#'), b.lstrip('#'); A = [int(a[i:i + 2], 16) for i in (0, 2, 4)]; B = [int(b[i:i + 2], 16) for i in (0, 2, 4)]
    return '#%02x%02x%02x' % tuple(round(A[i] + (B[i] - A[i]) * t) for i in range(3))
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
T['aurora'] = ('Aurora, the northern lights: polar navy, snow text, aurora green with violet.', dict(
  bg=['#04070f', '#070b16', '#060912', '#0f1626'], rule='#18223a', bh='#283656', text='#dde6f2', bright='#f2f6fc', muted='#8f9eb8', faint='#6b7b98',
  acc='#6ff2b8', dim='#2f9a74', on='#03140c', ahov='#9cf6cf', link='#7ef4c0', lhov='#aaf8d6', verd='#6ff2b8', slate='#9aa8f0', plum='#b49aff',
  red='#f07080', orange='#f0b878', cyan='#88d0f0', pink='#e8a0d0', warn='#f4aab4', err='#f07888', lit='#dfe8f2', statb='#b49aff', hi='#b49aff',
  code=['#b8c6da', '#6ff2b8', '#8f9eb8', '#c8b8ff'], gl='#1c2842', gt='#c0cce0', gp='#33456a', glows=['rgba(111, 242, 184, .05) 50% 0', 'rgba(180, 154, 255, .045) 85% 0'], ink='invert(.92) sepia(.3) hue-rotate(110deg) saturate(1.2)'))

def spec(bg, rule, bh, text, bright, muted, faint, acc, dim, on, ahov, link, lhov, verd, slate, plum, red, orange, cyan, pink, warn, err, lit, statb, hi, code, gl, gt, gp, glows, ink, bold=None):
    return dict(bg=bg, rule=rule, bh=bh, text=text, bright=bright, muted=muted, faint=faint, acc=acc, dim=dim, on=on, ahov=ahov, link=link, lhov=lhov, verd=verd, slate=slate, plum=plum,
                red=red, orange=orange, cyan=cyan, pink=pink, warn=warn, err=err, lit=lit, statb=statb, hi=hi, code=code, gl=gl, gt=gt, gp=gp, glows=glows, ink=ink, bold=bold)
T['shire'] = ('Shire, round doors in green hills: hedge-dark ground, cream text, golden-hour gold, grass green.', spec(
  ['#0a0d08', '#10140d', '#0d110a', '#1b2216'], '#26301e', '#3a4a2e', '#e6e2cc', '#f6f2de', '#a4a48a', '#7e8068', '#e6c25a', '#9a8238', '#141004', '#f0d480', '#ecc86a', '#f4dc94',
  '#8cc66a', '#8aaad0', '#b494b8', '#d0603c', '#e8a05a', '#88c0c8', '#e09aa0', '#eeaa90', '#d86a4e', '#f4d39a', '#8cc66a', '#8cc66a',
  ['#c4c4ac', '#e6c25a', '#a4a48a', '#b8d890'], '#2a3622', '#cfd0b8', '#44563a', ['rgba(244, 211, 154, .06) 50% 0', 'rgba(140, 198, 106, .035) 20% 100%'], 'invert(.9) sepia(.4) hue-rotate(20deg) saturate(.9)', '#8cc66a'))
T['earthrise'] = ('Earthrise, after Apollo 8 (1968): lunar grey and black, the blue of the rising Earth.', spec(
  ['#050506', '#09090b', '#070708', '#141417'], '#232327', '#36363c', '#e2e2e0', '#f6f6f4', '#a2a29c', '#7c7c78', '#6a9aff', '#3a62b8', '#040a18', '#94b8ff', '#80aaff', '#a8c4ff',
  '#7ab890', '#9ab4ff', '#b8a0e0', '#e8705a', '#e8b070', '#8ac8f0', '#e8a0b8', '#f0aa9a', '#e8786a', '#d2d0c8', '#d2d0c8', '#f4f6ff',
  ['#c2c2be', '#6a9aff', '#a2a29c', '#b8d0a0'], '#26262b', '#cacac6', '#3e3e44', ['rgba(106, 154, 255, .05) 60% 0', 'rgba(210, 208, 200, .03) 50% 100%'], 'invert(.92) grayscale(1) brightness(1.04)', '#d2d0c8'))
T['palebluedot'] = ('Pale Blue Dot, after Voyager 1 (1990): umber dark, the warm bands of scattered sunlight, one pale blue.', spec(
  ['#070504', '#0c0907', '#0a0705', '#18120e'], '#2a2019', '#403126', '#e4d8cc', '#f4ece2', '#a8968a', '#83736a', '#a8c8ff', '#5a78a8', '#060c18', '#c4daff', '#b4d0ff', '#d0e2ff',
  '#88b8a8', '#a8c8ff', '#b8a0c8', '#d87050', '#d8a070', '#a8c8ff', '#d8a0a8', '#e8b0a0', '#e07a60', '#e8c8a0', '#d8a070', '#d8a070',
  ['#c8bcb0', '#a8c8ff', '#a8968a', '#e8c8a0'], '#2e231b', '#d0c4b8', '#4a3a2e', ['rgba(216, 160, 112, .055) 40% 0', 'rgba(168, 200, 255, .035) 75% 0'], 'invert(.9) sepia(.5) saturate(.8)', '#e8c8a0'))
T['deepfield'] = ('Deep Field, after the first JWST image (2022): the black between galaxies, lensed-arc orange, starlight.', spec(
  ['#040408', '#08070e', '#06060b', '#121019'], '#211d2c', '#342e44', '#e6e0d8', '#f8f2ea', '#a49cac', '#7e7688', '#ffb070', '#b06a3a', '#180c04', '#ffc898', '#ffbc84', '#ffd4ac',
  '#88c8b0', '#9ab8f0', '#b48ac8', '#ff7a5a', '#ffc070', '#9ab8f0', '#e89ac0', '#ffb09a', '#ff7a60', '#fff4d8', '#9ab8f0', '#9ab8f0',
  ['#c6c0cc', '#ffb070', '#a49cac', '#9ab8f0'], '#25202f', '#cec8d4', '#3e3650', ['rgba(255, 176, 112, .05) 45% 0', 'rgba(154, 184, 240, .04) 85% 0'], 'invert(.92) sepia(.3) saturate(1.1)', '#9ab8f0'))
T['pluto'] = ('Pluto, after New Horizons (2015): night-blue ground, haze-blue light, the beige of the heart.', spec(
  ['#04060b', '#070a12', '#05080f', '#0f1524'], '#19223a', '#293758', '#dce4f2', '#f0f4fc', '#8e9ab6', '#6a7696', '#9ac8ff', '#4a7ab8', '#04101e', '#bcdcff', '#a8d0ff', '#c8e2ff',
  '#7ad0c0', '#9ac8ff', '#b4a4f0', '#f07a7a', '#f0c080', '#9ac8ff', '#e8a8c8', '#f4b0b0', '#f08080', '#e8dcc8', '#f0c080', '#f0c080',
  ['#b8c4da', '#9ac8ff', '#8e9ab6', '#e8dcc8'], '#1c2640', '#c0cadf', '#33426a', ['rgba(154, 200, 255, .065) 50% 0', 'rgba(232, 220, 200, .025) 80% 100%'], 'invert(.92) sepia(.3) hue-rotate(180deg) saturate(1.2)', '#e8dcc8'))
T['jupiter'] = ('Jupiter, after Juno: umber dark, cream zones, rust belts, the Great Red Spot.', spec(
  ['#0a0705', '#100b08', '#0d0906', '#1e1610'], '#30241a', '#4a3828', '#efe4d0', '#fbf4e6', '#b4a08a', '#8c7a66', '#e89a6a', '#a85a3a', '#180a04', '#f0b890', '#eea878', '#f4c4a0',
  '#a0b890', '#9ab0d0', '#c0a0b0', '#d0563a', '#e8b878', '#9ac0d0', '#e0a0a0', '#f0b09a', '#d86048', '#efe4cc', '#d8b88e', '#d8b88e',
  ['#d0c0aa', '#e89a6a', '#b4a08a', '#efe4cc'], '#34281d', '#d6c8b2', '#544030', ['rgba(232, 154, 106, .055) 50% 0', 'rgba(216, 184, 142, .035) 20% 100%'], 'invert(.9) sepia(.55) saturate(1.1)', '#efd8a8'))

def quick(note, bg, text, muted, acc, dim, link, verd, slate, plum, red, orange, cyan, pink, lit, hi, bold, glows, ink):
    """a colour set from a few key colours; the rest is derived"""
    t = text; m = muted
    return (note, spec([bg[0], bg[1], bg[2], bg[3]], mix(bg[3], t, .1), mix(bg[3], t, .2), t, mix(t, '#ffffff', .45), m, mix(m, bg[1], .3), acc, dim, mix(bg[0], '#000000', .4),
        mix(acc, '#ffffff', .25), link, mix(link, '#ffffff', .3), verd, slate, plum, red, orange, cyan, pink, mix(red, '#ffffff', .4), red, lit, hi, hi,
        [mix(t, m, .4), acc, m, lit], mix(bg[3], t, .12), mix(t, bg[1], .1), mix(bg[3], t, .25), glows, ink, bold))
T['solarpunk'] = quick('Solarpunk: deep garden green, warm cream text, sun gold, leaf green, panel blue.', ['#06100c', '#0a1712', '#08130f', '#132620'], '#e2e8d8', '#97a894', '#f4c840', '#a8862c', '#f6d466',
  '#6cc46a', '#7aa8e0', '#b49ad0', '#e0704e', '#f0a050', '#6ac8c8', '#e898b0', '#f4dc8a', '#6cc46a', '#7cd47a', ['rgba(244, 200, 64, .06) 75% 0', 'rgba(108, 196, 106, .04) 20% 100%'], 'invert(.9) sepia(.35) hue-rotate(40deg) saturate(1.1)')
T['urbs'] = quick('Urbs, a city at night: tower-dark navy, window-light text, sodium amber, neon pink and cyan.', ['#05060c', '#090b14', '#070910', '#12162a'], '#dcdfea', '#8e94b0', '#ffb04a', '#b07428', '#ffbe68',
  '#6ae0c0', '#7ad8ff', '#c49aff', '#ff5f7a', '#ffb04a', '#7ad8ff', '#ff5fa8', '#ffe0a0', '#ff5fa8', '#ff6ab4', ['rgba(255, 176, 74, .05) 50% 0', 'rgba(255, 95, 168, .04) 85% 100%'], 'invert(.92) sepia(.3) hue-rotate(190deg) saturate(1.1)')
T['flora'] = quick('Flora, a garden at dusk: dark leaf, petal-white text, rose, lavender, sunflower.', ['#0b0810', '#110c16', '#0e0a13', '#1e1626'], '#ece0ea', '#a898aa', '#f08ab0', '#a85a7a', '#f49cbe',
  '#7cc46a', '#9aaee8', '#b49aee', '#e8504a', '#f4a03a', '#7ad0d8', '#f08ab0', '#f4e070', '#f4c430', '#f4c430', ['rgba(240, 138, 176, .06) 50% 0', 'rgba(124, 196, 106, .035) 20% 100%'], 'invert(.9) sepia(.4) hue-rotate(280deg) saturate(1.1)')
T['cortex'] = quick('Cortex, neurons in Brainbow colours: tissue-dark navy, pale text, fluorescent green, magenta, cyan.', ['#04050a', '#070910', '#05070d', '#10131f'], '#dfe4ee', '#8e98ae', '#7cf07a', '#3a9a44', '#90f48e',
  '#5fe8ff', '#9ab0ff', '#b48aff', '#ff5f8a', '#ffd84a', '#5fe8ff', '#ff5fb0', '#e8f0d8', '#ff5fb0', '#ff7ac0', ['rgba(124, 240, 122, .045) 30% 0', 'rgba(255, 95, 176, .045) 75% 0'], 'invert(.92) sepia(.3) hue-rotate(80deg) saturate(1.2)')
T['medicina'] = quick('Medicina, a patient monitor: screen-dark teal, clinical white text, trace green, heart red.', ['#030807', '#060d0c', '#050b0a', '#0d1b19'], '#dfeae6', '#8aa49c', '#6cffa8', '#2a9a5a', '#7effb4',
  '#6cffa8', '#88c0f0', '#b8a0e0', '#ff4a5a', '#ffc070', '#7ae0e8', '#ff8aa0', '#e8fff0', '#ff4a5a', '#ff6a78', ['rgba(108, 255, 168, .04) 50% 0', 'rgba(255, 74, 90, .03) 90% 0'], 'invert(.92) sepia(.3) hue-rotate(100deg) saturate(1.2)')
T['leonardo'] = quick("Leonardo, his notebooks: dark vellum, sepia text, red chalk, walnut ink.", ['#0c0806', '#120d09', '#0f0a07', '#20170f'], '#e8dcc6', '#a8957a', '#d07a50', '#8a4a2a', '#d8885e',
  '#9ab08a', '#9aa8c0', '#b090a0', '#c8504a', '#d8a060', '#8ab0b0', '#c88a90', '#d8bc8c', '#d8bc8c', '#e0c494', ['rgba(208, 122, 80, .05) 50% 0', 'rgba(216, 188, 140, .035) 20% 100%'], 'invert(.9) sepia(.6) saturate(.9)')
T['newton'] = quick("Newton, Opticks and the Principia: a darkened room, candle-white text, sunbeam gold, the colours of the spectrum.", ['#07060a', '#0b0a10', '#09080d', '#16141e'], '#e8e4da', '#a29cac', '#ffd86a', '#a8882e', '#ffe08a',
  '#5ad84a', '#3a8aff', '#9a4ae0', '#ff3a3a', '#ff8a2a', '#6ac8f0', '#e88ab0', '#fff8e0', '#ff3a3a', '#ff6a5a', ['rgba(255, 216, 106, .05) 40% 0', 'rgba(154, 74, 224, .04) 85% 100%'], 'invert(.92) sepia(.25) saturate(1.1)')
T['einstein'] = quick("Einstein, an Einstein ring: deep space, starlight text, the ring's blue, the lensing galaxy's gold.", ['#04050b', '#070912', '#05070e', '#10141f'], '#e2e6f2', '#8e96ae', '#8ab0ff', '#3a5aa8', '#9abcff',
  '#8ad8b8', '#8ab0ff', '#b8a8f0', '#f08070', '#f0c080', '#9ac8f0', '#e8a8c8', '#cfe2ff', '#f4dca0', '#f4dca0', ['rgba(138, 176, 255, .05) 75% 0', 'rgba(244, 220, 160, .03) 85% 0'], 'invert(.92) sepia(.3) hue-rotate(190deg) saturate(1.1)')
T['starrynight'] = quick('Starry Night, after van Gogh (1889): night blue, moon-pale text, star yellow, cypress green.', ['#050814', '#08101f', '#060c1a', '#101c34'], '#e0e6f2', '#8e9cba', '#f4d640', '#a89030', '#f8e06a',
  '#7ab890', '#7aa8f0', '#a89ae0', '#f07a5a', '#f4b040', '#9ac0e0', '#e8a0b0', '#fff6b0', '#9ac0e0', '#9ac0e0', ['rgba(244, 214, 64, .055) 85% 0', 'rgba(90, 138, 200, .06) 40% 0'], 'invert(.92) sepia(.3) hue-rotate(190deg) saturate(1.3)')
T['scream'] = quick('The Scream, after Munch (1893): fjord-dark blue, pale text, the burning orange of the sky, red.', ['#060812', '#0a0e1c', '#080b17', '#141a30'], '#e8e2dc', '#9e9aac', '#f4a040', '#b06a24', '#f6b05e',
  '#8ab890', '#6a98d8', '#b49ac8', '#e04a3a', '#f4a040', '#88b8d0', '#e8a098', '#f4c860', '#e05a2a', '#f07a4a', ['rgba(240, 138, 42, .065) 50% 0', 'rgba(26, 58, 122, .08) 50% 100%'], 'invert(.9) sepia(.45) hue-rotate(-10deg) saturate(1.3)')
T['greatwave'] = quick('Great Wave, after Hokusai (c. 1831): Prussian blue, foam-white text, the cream of the boats, a pale sky.', ['#04070e', '#070c17', '#050913', '#0f1828'], '#e4e8ee', '#909cb0', '#9ab8e0', '#4a6aa0', '#b0c8ec',
  '#7ab8a8', '#9ab8e0', '#a8a0d0', '#e07060', '#e8c890', '#9ab4d0', '#e0a8b0', '#f4f0e4', '#e8c890', '#f4f0e4', ['rgba(154, 180, 208, .05) 30% 0', 'rgba(232, 200, 144, .03) 80% 100%'], 'invert(.92) sepia(.2) hue-rotate(190deg) saturate(1.1)')
T['waterlilies'] = quick('Water Lilies, after Monet: pond blue at dusk, pale text, lily pink, pad green, lilac.', ['#06080e', '#0a0e17', '#080b13', '#141b2a'], '#e2e6f0', '#929cb4', '#f0a0c0', '#a85a7e', '#f4b0cc',
  '#6ab884', '#8aa8e0', '#b4a0e0', '#e0706a', '#f0c080', '#8ac0d0', '#f0a0c0', '#f4e070', '#6ab884', '#7ac894', ['rgba(240, 160, 192, .05) 40% 0', 'rgba(106, 184, 132, .04) 80% 100%'], 'invert(.92) sepia(.3) hue-rotate(200deg) saturate(1.1)')
T['klimt'] = quick('Klimt, after the golden phase (1907-08): black lacquer, ivory text, gold leaf, with small squares of red, blue and green.', ['#090705', '#0e0b08', '#0c0906', '#1c1610'], '#ece2cc', '#a8987a', '#e0b850', '#9a7a30', '#ecc86a',
  '#5aa878', '#5a8ad0', '#b090c0', '#c8402f', '#e8a050', '#88b8c0', '#d890a0', '#f0d070', '#c8402f', '#f0d070', ['rgba(224, 184, 80, .06) 50% 0', 'rgba(224, 184, 80, .04) 50% 100%'], 'invert(.9) sepia(.6) saturate(1.2)')
ORDER = ['kairos', 'aion', 'chronos', 'silva', 'mons', 'torrens', 'bibliotheca', 'mars', 'aurora', 'shire', 'earthrise', 'palebluedot', 'deepfield', 'pluto', 'jupiter', 'solarpunk', 'urbs', 'flora', 'cortex', 'medicina', 'leonardo', 'newton', 'einstein', 'starrynight', 'scream', 'greatwave', 'waterlilies', 'klimt']
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
  --vista: {A[k]['vista']}; --vista-w: {A[k]['w']};
  --px-bold: {s.get('bold') or s['verd']};
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
   Aurora and Mars are landscapes; Bibliotheca and Shire are places; Earthrise, Pale Blue Dot,
   Deep Field, Pluto and Jupiter follow famous NASA images; Solarpunk, Urbs, Flora, Cortex and Medicina
   are subjects; Leonardo, Newton and Einstein follow their notebooks and work; and five follow paintings in the public domain. Each has its own pixel-art
   landscape, colour sigil and colour band. The text stays in the Istari type. */
'''
css = HEAD + ''.join(block(k) for k in ORDER) + '\n'
p = 'src/style.css'; s = open(p).read()
a = s.index('\n/* ---------- the pixel themes ----------'); b = s.index('/* ---------- shared rules of the pixel themes')
s = s[:a] + css + s[b:]
open(p, 'w').write(s)
print(len(css))
