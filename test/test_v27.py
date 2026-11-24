"""Musubi 2.7: navigation arrows, tabs and split view, folder tree, block references, tag manager,
plots from Python, review statistics, PDF reader, light theme and bold anchors.
Run: python3 test/test_v27.py (after node build.mjs)"""
import base64, os, tempfile
from playwright.sync_api import sync_playwright

URL = 'file://' + os.path.abspath('dist/musubi.html')
fails = []
def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

def make_pdf(p):
    html = '<html><body style="font-family:serif">' + ''.join(
        f'<h1>Chapter {i}</h1><p>' + ('The path makes the action stationary. ' * 30) + f'</p><p><a href="https://example.org">web</a></p><div style="page-break-after:always"></div>'
        for i in range(1, 5)) + '</body></html>'
    b = p.chromium.launch(args=['--no-sandbox']); pg = b.new_page(); pg.set_content(html)
    path = os.path.join(tempfile.mkdtemp(), 't.pdf')
    try: pg.pdf(path=path, format='A4', outline=True, tagged=True)
    except TypeError: pg.pdf(path=path, format='A4')
    b.close()
    return base64.b64encode(open(path, 'rb').read()).decode()

with sync_playwright() as p:
    pdf64 = make_pdf(p)
    exe = '/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None
    b = p.chromium.launch(executable_path=exe, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1440, 'height': 900})
    pg = ctx.new_page(); errs = []
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
    pg.goto(URL); pg.wait_for_function('window.musubi')
    pg.click('.tour-skip'); pg.wait_for_timeout(300)
    pg.evaluate('musubi.seedVault(true)'); pg.wait_for_timeout(600)
    E = pg.evaluate
    ids = E('musubi.vault.all().map(n => n.id)')
    tabs = lambda: E("[0,1].map(p => [...document.querySelectorAll('#tabbar'+p+' .tab')].map(t => (t.classList.contains('on') ? '*' : '') + t.querySelector('.tab-title').textContent))")

    # ---------- 1. navigation arrows at the foot ----------
    check(E("!!document.querySelector('#nav-dock #btn-back .katex') && !!document.querySelector('#nav-dock #btn-fwd .katex')"), 'back and forward are KaTeX arrows in a dock')
    check(E("!document.querySelector('.mtop #btn-back')"), 'the arrows are no longer in the top bar')
    E(f"musubi.openNote('{ids[3]}')"); E(f"musubi.openNote('{ids[4]}')")
    t3 = E(f"musubi.vault.get('{ids[3]}').title")
    check(E("document.querySelector('#btn-back .nav-label').textContent") == t3, 'the back arrow names the note it goes to')
    pg.click('#btn-back'); pg.wait_for_timeout(200)
    check(E('musubi.app.current') == ids[3], 'the back arrow goes back')
    E('document.activeElement.blur()')
    pg.keyboard.press('Control+Alt+ArrowRight'); pg.wait_for_timeout(200)
    check(E('musubi.app.current') == ids[4], 'Ctrl+Alt+Right goes forward')

    # ---------- 2. tabs and split view ----------
    E(f"musubi.openNote('{ids[5]}', {{ newTab: true }})")
    check(len(tabs()[0]) == 2 and tabs()[0][1].startswith('*'), 'a new tab opens and is active')
    pg.click('.tab-split'); pg.wait_for_timeout(300)
    check(E("document.querySelector('#panes').classList.contains('split')") and len(tabs()[1]) == 1, 'split view opens a second pane with a copy of the tab')
    check(E("!!document.querySelector('#pane1 .ghost .prose')"), 'the second pane shows the note rendered')
    pg.click('#pane1 .ghost', position={'x': 300, 'y': 420}); pg.wait_for_timeout(300)
    check(E("!!document.querySelector('#pane1 #note-scroll') && !!document.querySelector('#pane0 .ghost')"), 'a click moves the editor to that pane')
    pg.click('#pane0 .tab >> nth=0'); pg.wait_for_timeout(300)
    check(E("!!document.querySelector('#pane0 #note-scroll')"), 'a tab click in the first pane brings the editor back')
    pg.wait_for_timeout(700); pg.reload(); pg.wait_for_function('window.musubi'); pg.wait_for_timeout(700)
    check(E("document.querySelector('#panes').classList.contains('split')") and len(tabs()[0]) == 2, 'tabs and the split survive a reload')
    E('document.activeElement.blur()')
    pg.keyboard.press('Alt+KeyT'); pg.wait_for_timeout(300); pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    check(any('New tab' in t for t in tabs()[0]), 'Alt T opens an empty tab')
    pg.keyboard.press('Alt+KeyW'); pg.wait_for_timeout(200)
    check(not any('New tab' in t for t in tabs()[0]), 'Alt W closes it')
    pg.keyboard.press('Alt+Backslash'); pg.wait_for_timeout(300)
    check(not E("document.querySelector('#panes').classList.contains('split')"), 'Alt \\ closes the split')

    # ---------- 3. folder tree ----------
    check(E("document.querySelector('.sb-tab[data-tab=folders]').hidden"), 'the Folders tab is off at first')
    E("musubi.app.settings.folderTree = true; musubi.app.settings.sidebarTab = 'folders'; musubi.renderSidebar()")
    n0 = E("musubi.createNote({ title: 'Foldered', folder: 'Physics/Mechanics', body: 'x' }, { open: false }).id")
    E("musubi.app.settings.folderOpen = { 'Physics/': true, 'Physics/Mechanics/': true }; musubi.renderSidebar()")
    check(E(f"musubi.vault.get('{n0}').file") == 'Physics/Mechanics/Foldered.md', 'a note made in a folder keeps the path')
    check(E("[...document.querySelectorAll('.ft-folder .ft-name')].map(x => x.textContent).join('/')") == 'Physics/Mechanics', 'the tree shows nested folders')
    check(E(f"!!document.querySelector('.ft-note[data-id=\"{n0}\"]')"), 'the note sits under its folder')

    # ---------- 4. block references ----------
    E("""(() => { const A = musubi.createNote({ title: 'BlockA', body: 'A claim about limits. ^claim\\n\\n:::theorem[T]\\nStatement.\\n:::\\n^thm\\n\\nNo id here.\\n' }, { open: false });
      window.BB = musubi.createNote({ title: 'BlockB', body: 'See [[BlockA#^claim]].\\n\\n![[BlockA#^thm]]\\n' }, { open: false }); return 1; })()""")
    h = E("musubi.renderMarkdown(BB.body, { note: BB })")
    check('data-block="claim"' in h and 'A claim about limits' in h, 'a block link carries the block and its words')
    check('embed-block' in h and 'Statement.' in h, 'a block embed shows the box')
    ha = E("musubi.renderMarkdown(musubi.vault.all().find(n => n.title === 'BlockA').body, {})")
    check('^claim' not in ha and 'data-block="thm"' in ha, 'the markers hide in read view')
    blocks = E("musubi.listBlocks('Para one.\\n\\n- item ^li\\n\\n$$\\nx\\n$$\\n^eq\\n').map(b => [b.kind, b.id])")
    check(blocks == [['para', None], ['item', 'li'], ['math', 'eq']], 'blocks are found with their IDs')

    # ---------- 5. tag manager ----------
    E("window.TA = musubi.createNote({ title: 'TagA', tags: ['zz', 'zz/sub'], body: 'Text #zz here and `#zz` in code.\\n' }, { open: false })")
    E("musubi.openTagManager('zz')"); pg.wait_for_timeout(300)
    check(E("!!document.querySelector('.tagman .tm-row')"), 'the tag manager opens')
    pg.click('.tm-detail .btn:text("Rename or move")'); pg.wait_for_timeout(200)
    pg.fill('.ov-dialog .input', 'yy'); pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    check(E("musubi.vault.get(TA.id).tags.join(',')") == 'yy,yy/sub', 'rename changes front matter and nested tags')
    check(E("musubi.vault.get(TA.id).body") == 'Text #yy here and `#zz` in code.\n', 'rename changes inline tags but not code')
    pg.click('.toast button:text("Undo")'); pg.wait_for_timeout(400)
    check(E("musubi.vault.get(TA.id).tags.join(',')") == 'zz,zz/sub', 'Undo restores the tags')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)

    # ---------- 6. plots ----------
    ph = E("musubi.plotHtml('x = np.linspace(0, 6.3, 200)\\nplt.plot(x, np.sin(x), label=r\"$\\\\sin x$\")\\nplt.legend()\\nplt.xlabel(\"t\")')")
    check('<svg' in ph and 'plot-legend' in ph and 'katex' in ph, 'a plot renders SVG with a KaTeX legend')
    pe = E("musubi.plotHtml('import os')")
    check('plot-error' in pe and 'not available' in pe, 'other modules give a clear error')
    pe2 = E("musubi.plotHtml('x = (1).__class__')")
    check('plot-error' in pe2, 'dunder names are blocked')
    pl = E("musubi.plotHtml('while True:\\n    pass')")
    check('too long' in pl, 'an endless loop stops')
    pf = E("musubi.plotHtml('fig, axs = plt.subplots(2, 2)\\nfor ax in axs.flat:\\n    ax.hist(np.random.normal(0, 1, 200), bins=12)')")
    check(pf.count('<clipPath ') == 4, 'subplots draw four axes')
    E("musubi.createNote({ title: 'PlotNote', body: 'Plot:\\n\\n```python plot\\nplt.plot([1, 2, 3], [1, 4, 9])\\n```\\n' })"); pg.wait_for_timeout(500)
    check(E("!!document.querySelector('.cm-lp-plot svg')"), 'live preview draws the plot')

    # ---------- 7. review statistics ----------
    pg.keyboard.press('Escape'); E('document.activeElement.blur()')
    pg.keyboard.press('Alt+KeyR'); pg.wait_for_timeout(300)
    for g in ['3', '1', '3']:
        pg.keyboard.press('Space'); pg.wait_for_timeout(100); pg.keyboard.press(g); pg.wait_for_timeout(120)
    log = E("Object.values(musubi.app.srs._log)[0]")
    check(log and log['n'] == 3 and log['a'] == 1 and log['g'] == 2, 'each answer is logged for the day')
    pg.click('.rv-stats'); pg.wait_for_timeout(400)
    check(E("document.querySelectorAll('.st-tile').length") == 5 and E("document.querySelectorAll('.st-svg').length") >= 2, 'the statistics view shows tiles and charts')
    pg.hover('.st-chart >> nth=0 >> .st-hit >> nth=-1'); pg.wait_for_timeout(150)
    tiptext = E("document.querySelector('.st-tip').textContent")
    check('review' in tiptext and 'new card' in tiptext and '1 reviews' not in tiptext, 'hovering a bar shows its values: ' + tiptext)
    pg.click('.st-sec-head .link-btn:text("table") >> nth=0'); pg.wait_for_timeout(150)
    check(E("!!document.querySelector('.st-table')"), 'a chart can show a table')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)

    # ---------- 8. PDF reader ----------
    E("""async (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      await musubi.saveAsset(new Blob([u], { type: 'application/pdf' }), 'paper.pdf');
      window.LN = musubi.createNote({ title: 'Paper notes', type: 'literature', citekey: 'paper2026', body: '![[paper.pdf]]\\n\\n[[paper.pdf#page=3]]\\n' }); }""", pdf64)
    pg.wait_for_timeout(500)
    pg.click('.att-read'); pg.wait_for_timeout(2500)
    check(E("document.querySelectorAll('.pdf-page').length") == 4, 'the PDF opens with all its pages')
    check(E("document.querySelector('#panes').classList.contains('split')") and any('paper' in t for t in tabs()[1]), 'it opens in a tab beside the note')
    check(E("document.querySelectorAll('.pdf-page .textLayer span').length") > 10, 'the text can be selected')
    E("""(() => { const sp = document.querySelectorAll('.pdf-page[data-n="1"] .textLayer span'); const r = document.createRange(); r.setStart(sp[1].firstChild, 0); r.setEnd(sp[2].firstChild, sp[2].textContent.length); const s = getSelection(); s.removeAllRanges(); s.addRange(r); })()""")
    pg.dispatch_event('.pdf-scroll', 'mouseup'); pg.wait_for_timeout(200)
    pg.click('.pdf-selbar .btn-primary'); pg.wait_for_timeout(400)
    check('[@paper2026, p. 1]' in E("musubi.vault.get(LN.id).body"), 'Quote into note adds the quote with the citekey and page')
    check(E("(musubi.app.settings.pdfMarks['paper.pdf'] || []).length") == 1, 'the quoted text is also highlighted')
    pg.fill('.pdf-find', 'chapter 3'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1000)
    check(E("document.querySelector('.pdf-pagein').value") == '3', 'find goes to the page')
    E("musubi.setMode('read')"); pg.wait_for_timeout(300)
    pg.click('#preview a.att[data-page="3"]'); pg.wait_for_timeout(600)
    check(E("document.querySelector('.pdf-pagein').value") == '3', 'a #page= link opens the reader at that page')
    E("musubi.setMode('live')")

    # ---------- 9. light theme and bold anchors ----------
    E("musubi.app.settings.theme = 'light'; musubi.applyTheme()")
    check(E("document.documentElement.dataset.theme") == 'istari-light', 'the light theme applies')
    check(E("getComputedStyle(document.body).backgroundColor") == 'rgb(246, 241, 229)', 'the light theme has a parchment background')
    E("musubi.app.settings.boldAnchors = true; musubi.applyTheme(); musubi.ed.setAnchors(); musubi.setMode('read')"); pg.wait_for_timeout(300)
    check(E("document.querySelectorAll('#preview b.ba').length") > 3, 'bold anchors appear in read view')
    check(E("[...document.querySelectorAll('#preview code b.ba, #preview .katex b.ba')].length") == 0, 'code and math keep their text')
    E("musubi.setMode('live')"); pg.wait_for_timeout(300)
    check(E("document.querySelectorAll('.cm-ba').length") > 3, 'bold anchors appear in live preview')
    E("musubi.app.settings.boldAnchors = false; musubi.app.settings.theme = 'dark'; musubi.applyTheme(); musubi.ed.setAnchors()")

    real = [e for e in errs if 'favicon' not in e]
    check(not real, 'no console errors' + (': ' + '; '.join(real[:4]) if real else ''))
    b.close()

print(f'\n{len(fails)} failure(s)')
if fails: raise SystemExit(1)
