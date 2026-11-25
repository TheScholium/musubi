"""Musubi 2.8: slides (Advanced Slides syntax), the slide preview, speaker view, export and print;
delete from the note list; link completion that does not create notes; block glyphs.
Run: python3 test/test_slides.py (after node build.mjs)"""
import os, tempfile
from playwright.sync_api import sync_playwright

URL = 'file://' + os.path.abspath('dist/musubi.html')
fails = []
def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

DECK = r'''<style> @import url('https://fonts.googleapis.com/css2?family=EB+Garamond&display=swap');
:root { --deck-gold: rgb(196, 162, 77); }
.reveal h2 { color: var(--deck-gold) !important; text-align: left; }
.reveal .cols { display: flex; gap: 1em; }
.reveal .card { border-left: 2px solid #8f7639; }
</style>
<div class="eyebrow">Fall 2026</div>

# Symmetry and Conservation
**A. Student**

note: Welcome everyone.

---
<div class="cols" style="display:grid; grid-template-columns: 2fr 1fr">
<div class="card"><h4>A skater</h4>Spinning changes nothing.

The _rotational symmetry_ gives $L = I\omega$.
</div>
<div class="cols">
![[skater.png|300]]

note: The unclosed div above must not reach the next slide.

---

## Lists

+ first
+ second
+ third

A paragraph <!-- element class="fragment fade-up" -->

---
## Stack top
--
## Stack bottom
<svg width="100" height="100"><circle cx="50" cy="50" r="40" stroke="#c4a24d" fill="none"/></svg>

---
<!-- slide bg="rgb(10, 20, 30)" class="special" -->
<split even gap="4">

Left column

Right column

</split>

<grid drag="40 30" drop="right" bg="rgb(1, 2, 3)">
Grid box
</grid>

---
## Long

''' + '\n\n'.join(f'Paragraph {i} with enough words to fill a line or two of the slide at forty pixels.' for i in range(9)) + '''

---

'''

with sync_playwright() as p:
    exe = '/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None
    b = p.chromium.launch(executable_path=exe, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1440, 'height': 900})
    pg = ctx.new_page(); errs = []
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e) + ' ' + str(e.stack)[:600]))
    pg.goto(URL); pg.wait_for_function('window.musubi')
    pg.click('.tour-skip'); pg.wait_for_timeout(300)
    E = pg.evaluate
    nid = E("""async (body) => {
      const c = document.createElement('canvas'); c.width = 300; c.height = 200; c.getContext('2d').fillRect(0, 0, 300, 200);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      musubi.vault.assets.set('skater.png', { blob, url: URL.createObjectURL(blob), path: 'assets/skater.png', mtime: 0, size: blob.size, type: 'image/png', lazy: false });
      const n = musubi.createNote({ title: 'Deck', type: 'concept', status: 'draft', body }, { open: true });
      return n.id;
    }""", DECK)
    pg.wait_for_timeout(400)

    # ---------- 1. the deck ----------
    d = E(f"musubi.buildDeck(musubi.vault.get('{nid}')).then(d => ({{ n: d.slides.length, kids: d.slides.map(s => s.children ? s.children.length : 0), html: d.slides.map(s => s.html || s.children.map(c => c.html).join('|')), notes: d.slides.map(s => s.notes || ''), css: d.css, bg: d.slides[4].bg, attrs: d.slides[4].attrs }}))")
    check(d['n'] == 6, 'six slides: the --- at the end leaves no empty slide')
    check(d['kids'][3] == 2, '-- makes a vertical stack of two')
    check('Welcome everyone' in d['notes'][0] and 'Welcome everyone' not in d['html'][0], 'note: starts the speaker notes, which stay off the slide')
    check('.reveal h2' in d['css'] and '<style' not in d['html'][0], 'a <style> block becomes deck CSS')
    check(d['bg'] and d['bg'].get('color') == 'rgb(10, 20, 30)' and 'special' in d['attrs'].get('class', ''), '<!-- slide --> sets the background and class')
    check('katex' in d['html'][1] and 'blob:' in d['html'][1], 'mathematics and an embedded image inside raw HTML blocks render')

    # ---------- 2. presenting ----------
    E(f"musubi.presentNote('{nid}', {{ fromStart: true, noFullscreen: true }})"); pg.wait_for_timeout(1000)
    S = "musubi.slidesState.present.host.shadowRoot"
    check(E(f"!!{S}.querySelector('.reveal-viewport .reveal .slides section.present')"), 'the presentation has the reveal.js structure')
    check(E(f"getComputedStyle({S}.querySelector('section.present h1')).fontFamily").find('Cormorant') >= 0, 'the Istari theme sets the headings')
    check(E(f"!/@import/.test({S}.querySelector('style').textContent.split('.reveal h2 {{')[1] || '')") and E(f"!{S}.querySelector('style').textContent.includes('fonts.googleapis')"), 'remote @import lines are dropped: no network')
    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(900)
    check(E(f"musubi.slidesState.present.rt.state().h") == 1, 'Right goes to the next slide')
    check(E(f"[...{S}.querySelectorAll('.slides > section')][2].querySelector('.cols') === null || ![...{S}.querySelectorAll('.slides > section')][2].closest('.cols')"), 'an unclosed <div> stays inside its slide')
    check(E(f"!!{S}.querySelector('section.present img[src^=\"blob:\"]')"), 'the image embed shows')
    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(900)
    frag = lambda: E(f"[...{S}.querySelectorAll('section.present .fragment')].map(x => x.classList.contains('visible'))")
    check(frag() == [False, False, False, False], 'a + list and an element annotation make fragments, hidden at first')
    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(300); pg.keyboard.press('Space'); pg.wait_for_timeout(300)
    check(frag() == [True, True, False, False], 'Right and Space show the fragments one by one')
    check(E(f"!!{S}.querySelector('section.present p.fragment.fade-up')"), '<!-- element --> applies to the element before it')
    pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(300)
    check(frag() == [True, False, False, False], 'Left hides the last fragment')
    E("musubi.slidesState.present.rt.go(3, 0, -1)"); pg.wait_for_timeout(900)
    pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(900)
    check(E("musubi.slidesState.present.rt.state()") == {'h': 3, 'v': 1, 'f': -1}, 'Down goes to the vertical slide')
    check(E(f"!!{S}.querySelector('section.present svg circle')"), 'inline SVG survives sanitizing')
    check(E(f"{S}.querySelector('.slide-number').textContent.trim()") == '4.2', 'the slide number shows h.v')
    E("musubi.slidesState.present.rt.go(4, 0, -1)"); pg.wait_for_timeout(900)
    check(E(f"{S}.querySelector('section.present .mus-split').style.gridTemplateColumns") == 'repeat(2, 1fr)', '<split even> makes equal columns')
    g = E(f"(() => {{ const el = {S}.querySelector('section.present .mus-grid'); const cs = getComputedStyle(el); return [cs.position, el.style.width, cs.backgroundColor]; }})()")
    check(g == ['absolute', '40%', 'rgb(1, 2, 3)'], '<grid drag drop bg> places a box')
    check(E(f"getComputedStyle({S}.querySelector('.slide-background.present')).backgroundColor") == 'rgb(10, 20, 30)', 'the slide background shows')
    E("musubi.slidesState.present.rt.go(5, 0, -1)"); pg.wait_for_timeout(1000)
    z = E(f"parseFloat({S}.querySelector('.slides > section.present').style.zoom || '1')")
    check(0.5 <= z < 1, f'a slide that is too tall shrinks to fit (zoom {z:.2f})')
    check(E("getComputedStyle(document.querySelector('#note-view h2') || document.body).color") != 'rgb(196, 162, 77)', 'the deck CSS does not reach the app')
    # overview
    pg.keyboard.press('o'); pg.wait_for_timeout(600)
    check(E(f"{S}.querySelectorAll('.mus-ov-item').length") == 7, 'O opens the overview with every slide')
    pg.keyboard.press('Home'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    check(E(f"!{S}.querySelector('.reveal-viewport').classList.contains('mus-ov-on')") and E("!!musubi.slidesState.present"), 'Esc closes the overview first')
    # jump
    pg.keyboard.press('2'); pg.keyboard.press('Enter'); pg.wait_for_timeout(900)
    check(E("musubi.slidesState.present.rt.state().h") == 1, 'a number and Enter go to that slide')
    # speaker view
    with ctx.expect_page() as pop:
        pg.keyboard.press('s')
    sp = pop.value; sp.wait_for_timeout(800)
    check('unclosed div' in sp.evaluate("document.querySelector('.spk-notes').textContent"), 'S opens the speaker view with the notes')
    check(sp.evaluate("!!document.querySelector('.spk-cur .mus-thumb-host') && !!document.querySelector('.spk-upnext .mus-thumb-host')"), 'the speaker view shows the current and the next slide')
    sp.keyboard.press('ArrowRight'); pg.wait_for_timeout(500)
    check(E("musubi.slidesState.present.rt.state().h") == 2, 'keys in the speaker view drive the presentation')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    check(E("musubi.slidesState.present === null") and not E("!!document.querySelector('.slides-present')"), 'Esc ends the presentation')
    check(sp.is_closed(), 'ending the presentation closes the speaker view')

    # ---------- 3. the slide preview ----------
    E(f"musubi.openSlidePreview('{nid}')"); pg.wait_for_timeout(1200)
    check(E("!!document.querySelector('#pane1 .slides-pane .slides-host')") and E("[...document.querySelectorAll('#tabbar1 .tab-title')].map(x => x.textContent)") == ['Deck'], 'the preview opens in a tab beside the note')
    pos = E("musubi.ed.getText().indexOf('## Stack bottom')")
    E(f"musubi.ed.setSelection({pos})"); pg.wait_for_timeout(700)
    check(E("musubi.slidesState.previews[1].rt.state()")['h'] == 3 and E("musubi.slidesState.previews[1].rt.state()")['v'] == 1, 'the preview follows the cursor')
    E("musubi.ed.insertAtCursor('## Fresh heading\\n')"); pg.wait_for_timeout(1100)
    check(E("[...document.querySelector('#pane1 .slides-host').shadowRoot.querySelectorAll('section.present:not(.stack) h2')].map(x => x.textContent)")[0] == 'Fresh heading', 'the preview updates while you type')
    check(E("[...document.querySelector('#pane1 .slides-host').shadowRoot.querySelectorAll('.fragment')].every(x => x.classList.contains('visible'))"), 'the preview shows each slide whole')
    pg.reload(); pg.wait_for_function('window.musubi'); pg.wait_for_timeout(1200)
    check(E("!!document.querySelector('#pane1 .slides-pane')"), 'the preview tab survives a reload')
    E("""async () => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; c.getContext('2d').fillRect(0, 0, 300, 200);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      musubi.vault.assets.set('skater.png', { blob, url: URL.createObjectURL(blob), path: 'assets/skater.png', mtime: 0, size: blob.size, type: 'image/png', lazy: false }); }""")

    # ---------- 4. export and print ----------
    html = E(f"musubi.slidesHtml(musubi.vault.get('{nid}'))")
    check('blob:' not in html and 'data:image/png' in html, 'the exported file carries its images')
    path = os.path.join(tempfile.mkdtemp(), 'deck.html'); open(path, 'w').write(html)
    x = ctx.new_page(); xerr = []; x.on('pageerror', lambda e: xerr.append(str(e)))
    x.goto('file://' + path); x.wait_for_timeout(800)
    x.keyboard.press('ArrowRight'); x.wait_for_timeout(900)
    check(not xerr and x.evaluate("location.hash") == '#/1' and x.evaluate("!!document.querySelector('#deck').shadowRoot.querySelector('section.present .card')"), 'the exported file runs alone and keeps its place in the address')
    x.close()
    E("window.__printed = 0; window.print = () => { window.__printed++; }")
    E(f"musubi.printSlides('{nid}')"); pg.wait_for_function('window.__printed > 0', timeout=8000)
    check(E("window.__printed") == 1, 'Print builds the pages and prints')
    check(E("(() => { const h = document.querySelector('.slides-print-host'); return h ? h.shadowRoot.querySelectorAll('.mus-print-page').length : -1; })()") == 7, 'one page per slide')
    E("window.dispatchEvent(new Event('afterprint'))"); pg.wait_for_timeout(500)
    check(E("!document.querySelector('.slides-print-host')"), 'the print pages go away after printing')

    # ---------- 5. tags, glyphs, link completion, delete ----------
    check(E("[...musubi.vault.index().tagCount.keys()]") == [], 'colours in <style> and in attributes are not tags')
    other = E("musubi.createNote({ title: 'Glyphs', type: 'concept', status: 'draft', body: ':::theorem[Basis]\\nAll bases have one size.\\n:::\\n\\n> [!tip] Hint\\n> Try a smaller case.\\n' }, { open: true }).id")
    pg.wait_for_timeout(400)
    check(E("!!document.querySelector('.cm-lp-envhead .blk-ic')"), 'live preview: a block label has its glyph')
    E("musubi.setMode('read')"); pg.wait_for_timeout(300)
    check(E("!!document.querySelector('#preview .env-head .blk-ic') && !!document.querySelector('#preview .callout-title .blk-ic')"), 'read view: blocks and callouts have glyphs')
    E("musubi.setMode('live')"); pg.wait_for_timeout(300)
    E("musubi.ed.setSelection(musubi.ed.getText().length)"); E("musubi.ed.focus()")
    pg.keyboard.type('\n\nSee [[Quite new idea'); pg.wait_for_timeout(700)
    check(E("!!document.querySelector('.cm-tooltip-autocomplete')"), 'link completion opens')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    check('[[Quite new idea]]' in E("musubi.ed.getText()"), 'Enter completes a link to a title with no note')
    check(not E("musubi.vault.all().some(n => n.title === 'Quite new idea')"), 'and does not create the note')
    pg.click('.side-body .side-item >> nth=0', button='right'); pg.wait_for_timeout(200)
    labels = E("[...document.querySelectorAll('#menu .menu-label')].map(x => x.textContent)")
    check('Move to trash' in labels, 'the note list menu has Move to trash')
    before = E("musubi.vault.all().length")
    pg.click('#menu .menu-item.danger'); pg.wait_for_timeout(300)
    pg.click('.ov-dialog .btn-danger'); pg.wait_for_timeout(500)
    check(E("musubi.vault.all().length") == before - 1, 'it moves the note to the trash')

    check(not errs, 'no console errors' + ('' if not errs else ': ' + '; '.join(errs[:5])))
    b.close()

print(f'\n{len(fails)} failure(s)')
raise SystemExit(1 if fails else 0)
