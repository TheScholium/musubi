"""End-to-end tests for Musubi in headless Chromium. Run: python3 test/test_app.py"""
import base64, json, os, sys, tempfile
from playwright.sync_api import sync_playwright

URL = 'file://' + os.path.abspath('dist/musubi.html')
SHOTS = os.environ.get('SHOTS', '/tmp/musubi-shots')
os.makedirs(SHOTS, exist_ok=True)
fails = []
def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

with sync_playwright() as p:
    exe = '/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None
    b = p.chromium.launch(executable_path=exe, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    pg = ctx.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
    pg.goto(URL); pg.wait_for_function('window.musubi')

    # ---------- first start ----------
    check(pg.locator('.tour-card').count() == 1, 'first start opens the tour')
    check(pg.evaluate('musubi.vault.notes.size') == 0, 'first start has no notes')
    pg.click('.tour-skip'); pg.wait_for_timeout(400)
    check(pg.locator('.tour-card').count() == 0 and pg.is_visible('.setup'), 'skip leaves the setup screen')
    check(pg.evaluate('musubi.app.settings.onboarded') is True, 'skip marks onboarding done')

    pg.evaluate('musubi.seedVault(false)'); pg.wait_for_timeout(500)
    R = lambda md: pg.evaluate('(md) => musubi.renderMarkdown(md, {})', md)

    # ---------- renderer (read view) ----------
    h = R('Price is $5 and $10 today. Inline $a_b$ and `$x$` code.')
    check('$5 and $10' in h and h.count('class="katex"') == 1 and '<code>$x$</code>' in h, 'currency, inline math and code protection')
    h = R('$$a=b \\label{eq:one}$$\n\n\\begin{align}\nx &= 1 \\\\\ny &= 2 \\nonumber \\\\\nz &= 3 \\label{eq:z}\n\\end{align}\n\nSee \\eqref{eq:one} and \\eqref{eq:z}.')
    check('>(1)</a>' in h and '>(3)</a>' in h and 'class="eqn-num"' not in h, 'equation numbering with labels, nonumber and eqref')
    h = R(':::theorem[Big $\\alpha$]\nText *here*.\n:::\n\n:::proof\nDone.\n:::')
    check('env-theorem' in h and 'Theorem 1' in h and '<em>here</em>' in h and 'env-proof' in h and 'katex' in h, 'theorem and proof environments')
    h = R(':::argument[X]\nP1. A\nP2. B [premise]\nC. D [from P1, P2]\n:::')
    check(h.count('arg-prem') == 2 and 'arg-concl' in h and 'arg-rule' in h and 'from P1, P2' in h, 'argument environment')
    h = R('Q: What is $x$?\nA: It is *y*.')
    check('class="qa"' in h and '<em>y</em>' in h and 'katex' in h, 'Q/A block')
    h = R('A {{c1::hidden}} word and a footnote.[^n]\n\n[^n]: The **note**.')
    check('class="cloze"' in h and 'footnotes' in h and '<strong>note</strong>' in h, 'cloze and footnotes')
    h = R('[[Compact space]] and [[Nope note]] and depends-on::[[Open cover|covers]] and #topo/x tag, [@gettier1963, p. 2].')
    check('data-id="20260101001100"' in h and 'broken' in h and 'rel-struct' in h and '>covers<' in h and 'data-tag="topo/x"' in h and 'Gettier 1963, p. 2' in h, 'links, typed links, tags, citations')
    h = R('| a | b |\n|---|---|\n| $|x|$ | 2 |')
    check('<table>' in h and 'katex' in h, 'math with pipes inside a table')
    h = R("![[Euler–Lagrange equations#Example: Newton's second law]]")
    check('class="embed"' in h and 'Newton' in h and 'Setup' not in h, 'section embed')
    h = R('<script>alert(1)</script><img src=x onerror=alert(1)> ok')
    check('<script' not in h and 'onerror' not in h, 'sanitizer removes scripts')
    h = R('\\begin{multline}\na + b \\\\\n+ c \\label{eq:m}\n\\end{multline}\n\n$\\ce{H2O}$ and $\\C$')
    check('katex-error' not in h and 'katex-tag' in h, 'multline numbering, mhchem and default macros')
    cards = pg.evaluate("musubi.extractCards(musubi.vault.get('20260101000100')).map(c=>c.kind)")
    check(cards.count('cloze') == 2 and cards.count('qa') == 2 and cards.count('env') == 1, f'syntax note cards {cards}')

    # ---------- live preview ----------
    body = "# Heading one\n\nSome **bold** text with $a_b^2$ inline.\n\n$$\nx = \\frac{1}{2}\n$$\n\nA [[Compact space]] and a [[Missing note]].\n\n- [ ] task\n\n:::theorem[Named]\nStatement.\n:::\n"
    nid = pg.evaluate("(b)=>musubi.createNote({title:'Live test', body:b}).id", body); pg.wait_for_timeout(400)
    T = lambda: pg.evaluate("document.querySelector('.cm-content').innerText")
    def caret(pos):
        pg.evaluate(f"musubi.ed.focus(); musubi.ed.setSelection({pos})"); pg.wait_for_timeout(120)
        return T()
    src = pg.evaluate('musubi.ed.getText()')
    pg.click('.cm-content'); pg.wait_for_timeout(100)
    away = caret(len(src))
    check('**' not in away and '$a_b' not in away and '[[' not in away and 'Theorem 1' in away, 'live preview hides syntax away from the cursor')
    check(pg.locator('.cm-lp-mathblock').count() == 1 and pg.locator('.cm-lp-task').count() == 1 and pg.locator('.cm-lp-link a.wl.broken').count() == 1, 'block math, task box and broken link render')
    check('**bold**' in caret(src.index('bold') + 1), 'cursor inside bold shows the marks')
    check('$a_b^2$' in caret(src.index('a_b') + 1), 'cursor inside inline math shows TeX')
    check('# Heading' in caret(3), 'cursor on a heading shows #')
    t = caret(src.index('frac'))
    check('\\frac' in t and pg.locator('.cm-lp-mathpreview').count() == 1, 'cursor in block math shows TeX and a live preview')
    check('[[Compact space]]' in caret(src.index('Compact') + 2), 'cursor inside a link shows the brackets')
    t = caret(src.index('Statement'))
    check('Theorem 1' in t and ':::theorem' not in t, 'cursor in a theorem body keeps the rendered heading')
    check(':::theorem[Named]' in caret(src.index(':::theorem') + 4), 'cursor on the fence line shows its source')
    pg.locator('.cm-lp-task').click(); pg.wait_for_timeout(150)
    check('- [x] task' in pg.evaluate('musubi.ed.getText()'), 'task box toggles the source')
    caret(len(src)); pg.locator('.cm-lp-link a.wl:not(.broken)').first.click(); pg.wait_for_timeout(300)
    check(pg.evaluate('musubi.app.current') == '20260101001100', 'clicking a rendered link opens the note')
    pg.go_back(); pg.wait_for_timeout(300)
    check(pg.evaluate('musubi.app.current') == nid, 'browser back returns')

    pg.click('.cm-content'); pg.keyboard.press('Control+End'); pg.keyboard.type(' Why?'); pg.wait_for_timeout(200)
    check(pg.evaluate('musubi.ed.getText()').endswith(' Why?') and pg.locator('.ov-settings').count() == 0, 'typing ? in a note types a question mark')

    # ---------- palette ----------
    pg.keyboard.press('Control+k'); pg.wait_for_selector('.pal-input')
    pg.keyboard.type('noether'); pg.wait_for_timeout(150); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    check(pg.input_value('#title') == "Noether's theorem", 'palette opens a note')
    pg.keyboard.press('Control+k'); pg.keyboard.type('>graph'); pg.wait_for_timeout(150); pg.keyboard.press('Enter'); pg.wait_for_timeout(2500)
    check(pg.locator('.ov-graph').count() == 1, 'palette runs a command (graph)')
    pg.screenshot(path=f'{SHOTS}/graph.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    check(pg.locator('.overlay').count() == 0, 'Escape closes overlay')

    # ---------- new note, completion, rename ----------
    pg.keyboard.press('Alt+n'); pg.wait_for_selector('.dialog-new')
    pg.fill('.dialog-new input', 'Sequential compactness')
    pg.select_option('.dialog-new select >> nth=0', 'definition')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    check(pg.input_value('#title') == 'Sequential compactness' and ':::definition[Sequential compactness]' in pg.evaluate('musubi.ed.getText()'), 'new note from template')
    pg.keyboard.press('Control+End')
    pg.keyboard.type('\nRelated: [[Compa'); pg.wait_for_timeout(350)
    check(pg.locator('.cm-tooltip-autocomplete li').count() > 0, 'link completion opens')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    val = pg.evaluate('musubi.ed.getText()')
    check('[[Compact space]]' in val and '[[Compact space]]]]' not in val, 'completion inserts one plain link')
    pg.keyboard.type(' and $\\fra'); pg.wait_for_timeout(300)
    check(pg.locator('.cm-tooltip-autocomplete').count() == 1, 'LaTeX completion opens')
    pg.keyboard.press('Enter'); pg.keyboard.type('a}{b}$'); pg.wait_for_timeout(300)
    check('\\frac{a}{b}' in pg.evaluate('musubi.ed.getText()'), 'LaTeX snippet places the caret')
    pg.wait_for_timeout(900)
    new_id = pg.evaluate('musubi.app.current')
    back = pg.evaluate("musubi.vault.index().back.get('20260101001100').map(l=>l.from)")
    check(new_id in back, 'backlink appears in the index')
    pg.evaluate("musubi.openNote('20260101001100')"); pg.wait_for_timeout(300)
    check(pg.locator('#mentions .mn-item .mn-title', has_text='Sequential compactness').count() == 1, 'linked mentions list the new note')
    pg.click('#title'); pg.fill('#title', 'Compact topological space'); pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    check('[[Compact topological space]]' in pg.evaluate(f"musubi.vault.get('{new_id}').body"), 'rename rewrites links in other notes')
    check('[[Compact topological space]]' in pg.evaluate("musubi.vault.get('20260101001200').body"), 'rename rewrites typed links')

    # ---------- add a link without a relation, and with one ----------
    pg.evaluate("musubi.openNote('20260101003400')"); pg.wait_for_timeout(300)
    pg.click('#add-link'); pg.wait_for_selector('.dialog-link')
    pg.keyboard.type('Noether'); pg.wait_for_timeout(150); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    body = pg.evaluate("musubi.vault.get('20260101003400').body")
    check("[[Noether's theorem]]" in body and '::[[Noether' not in body, 'add link inserts a plain link by default')
    pg.click('#add-link'); pg.wait_for_selector('.dialog-link')
    pg.select_option('.dialog-link select', 'contrasts'); pg.keyboard.type('Gettier problem'); pg.click('.dialog-link .pal-item >> nth=0'); pg.wait_for_timeout(400)
    check('contrasts::[[Gettier problem]]' in pg.evaluate("musubi.vault.get('20260101003400').body"), 'add link can name a relation')

    # ---------- type key ----------
    pg.hover('#key-fab'); pg.wait_for_timeout(250)
    check(not pg.is_visible('#key-pop'), 'type key stays closed on a brief hover')
    pg.wait_for_timeout(500)
    check(pg.is_visible('#key-pop') and pg.locator('#key-pop .key-row').count() == 14, 'type key opens after a short hover')
    pg.screenshot(path=f'{SHOTS}/key.png')
    pg.locator('#key-pop .key-row', has_text='Theorem').click(); pg.wait_for_timeout(200)
    titles = pg.evaluate("[...document.querySelectorAll('#side-body .side-item')].map(e=>e.dataset.id).map(id=>musubi.vault.get(id).type)")
    check(titles and all(t == 'theorem' for t in titles), 'type key filters the list')
    pg.mouse.move(700, 400); pg.wait_for_timeout(500)
    check(not pg.is_visible('#key-pop'), 'type key closes when the pointer leaves')
    pg.evaluate("musubi.app.settings.typeFilter=[]"); pg.click('.sb-tab[data-tab="notes"]')

    # ---------- read mode ----------
    pg.evaluate("musubi.openNote('20260101000100')"); pg.wait_for_timeout(300)
    pg.keyboard.press('Control+e'); pg.wait_for_timeout(400)
    check(pg.get_attribute('#main', 'data-mode') == 'read' and pg.is_visible('#preview'), 'Ctrl+E switches to reading')
    check(pg.locator('#preview .callout-warning').count() == 1, 'callout in read view')
    pg.screenshot(path=f'{SHOTS}/read.png')
    pg.locator('#preview input[data-task="1"]').check(); pg.wait_for_timeout(300)
    check('- [x] Click a box' in pg.evaluate("musubi.vault.get('20260101000100').body"), 'read view task toggles source')
    pg.keyboard.press('Control+e'); pg.wait_for_timeout(300)
    check(pg.get_attribute('#main', 'data-mode') == 'live', 'Ctrl+E returns to live preview')
    pg.keyboard.press('Control+Shift+e'); pg.wait_for_timeout(300)
    check(pg.get_attribute('#main', 'data-mode') == 'source' and pg.locator('.cm-lp-math').count() == 0, 'source mode shows plain Markdown')
    pg.keyboard.press('Control+Shift+e'); pg.wait_for_timeout(300)

    # ---------- review ----------
    pg.keyboard.press('Alt+r'); pg.wait_for_selector('.review')
    n0 = pg.locator('.rv-head .muted').inner_text()
    pg.keyboard.press('Space'); pg.wait_for_timeout(200)
    check(pg.locator('.grade').count() == 4, 'answer shown with four grades')
    pg.screenshot(path=f'{SHOTS}/review.png')
    pg.keyboard.press('3'); pg.wait_for_timeout(200)
    check('1 done' in pg.locator('.rv-head .muted').inner_text(), 'grading advances')
    pg.keyboard.press('Escape')

    # ---------- settings, history ----------
    pg.click('#btn-settings'); pg.wait_for_selector('.settings')
    for k in ['general', 'editor', 'math', 'study', 'templates', 'data', 'shortcuts', 'about']:
        pg.click(f'.set-nav button[data-k="{k}"]'); pg.wait_for_timeout(120)
        if k in ('general', 'data'): pg.screenshot(path=f'{SHOTS}/settings-{k}.png')
    pg.keyboard.press('Escape')
    pg.evaluate(f"musubi.openNote('{new_id}')"); pg.wait_for_timeout(300)
    check(pg.evaluate(f"musubi.store.history('{new_id}').then(l=>l.length)") >= 1, 'history keeps the earlier text')
    pg.click('#btn-more'); pg.locator('.menu-item', has_text='Version history').click()
    pg.wait_for_selector('.history'); pg.wait_for_timeout(200)
    check(pg.locator('.dl-del, .dl-add').count() > 0, 'history shows a diff')
    pg.keyboard.press('Escape')

    # ---------- capture ----------
    pg.keyboard.press('Alt+c'); pg.wait_for_selector('.capture-input')
    pg.keyboard.type('Does symmetry explain conservation?\nOr only describe it?')
    pg.keyboard.press('Control+Enter'); pg.wait_for_timeout(300)
    check('Does symmetry explain conservation?' in pg.evaluate("musubi.vault.all().filter(n=>n.status==='fleeting').map(n=>n.title)"), 'quick capture makes a fleeting note')

    # ---------- export and import ----------
    with pg.expect_download() as dl:
        pg.click('#btn-settings'); pg.click('.set-nav button[data-k="data"]'); pg.click('text=Markdown ZIP')
    data = open(dl.value.path(), 'rb').read()
    check(data[:2] == b'PK' and len(data) > 5000, f'ZIP export ({len(data)} bytes)')
    pg.keyboard.press('Escape')
    cnt = pg.evaluate("""async (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
        const files = await musubi.readZip(u.buffer); return files.filter(f=>f.name.endsWith('.md')).length; }""", base64.b64encode(data).decode())
    check(cnt == pg.evaluate('musubi.vault.notes.size'), f'ZIP holds every note ({cnt})')
    before = pg.evaluate('musubi.vault.notes.size')
    pg.set_input_files('#file-input', dl.value.path()); pg.wait_for_timeout(1200)
    check(pg.evaluate('musubi.vault.notes.size') == before, 'reimporting the ZIP adds no duplicates')
    tmp = tempfile.mkdtemp(); bp = os.path.join(tmp, 'refs.bib')
    open(bp, 'w').write("@article{clark1963,\n  author = {Clark, Michael},\n  title = {Knowledge and Grounds},\n  journal = {Analysis},\n  year = {1963}\n}\n")
    mp = os.path.join(tmp, 'Plain note.md'); open(mp, 'w').write('# Plain note\n\nLinks to [[Gettier problem]] and #imported.\n')
    pg.set_input_files('#file-input', [bp, mp]); pg.wait_for_timeout(1200)
    lit = pg.evaluate("musubi.vault.all().find(n=>n.citekey==='clark1963')")
    check(lit and lit['author'] == 'Clark, Michael' and lit['type'] == 'literature', 'BibTeX import')
    check(pg.evaluate("!!musubi.vault.all().find(n=>n.title==='Plain note' && n.id && !n.file)"), 'Markdown import gets an id and no stray file path')

    # ---------- delete and undo ----------
    pg.evaluate(f"musubi.openNote('{new_id}')"); pg.wait_for_timeout(200)
    pg.click('#btn-more'); pg.locator('.menu-item', has_text='Move to trash').click()
    pg.wait_for_selector('.ov-dialog .btn-danger'); pg.click('.ov-dialog .btn-danger'); pg.wait_for_timeout(400)
    check(pg.evaluate(f"!musubi.vault.get('{new_id}')"), 'delete removes the note')
    pg.locator('.toast button', has_text='Undo').click(); pg.wait_for_timeout(500)
    check(pg.evaluate("musubi.vault.all().some(n=>n.title==='Sequential compactness')"), 'undo restores the note')

    # ---------- persistence ----------
    pg.wait_for_timeout(900)
    size = pg.evaluate('musubi.vault.notes.size')
    pg.reload(); pg.wait_for_function('window.musubi && musubi.vault.notes.size > 0'); pg.wait_for_timeout(500)
    check(pg.evaluate('musubi.vault.notes.size') == size, 'notes persist across reload')
    check(pg.locator('.tour-card').count() == 0, 'tour does not return after onboarding')
    check(pg.evaluate("musubi.vault.get('20260101001100').title") == 'Compact topological space', 'rename persisted')

    # ---------- display math and tables inside a ::: box keep the box ----------
    envbody = ':::definition[Inner Product]\nThe **inner product** is\n$$\n\\langle A,B \\rangle = a_{1}b_{1} + \\dots + a_{n}b_{n}.\n$$\n:::\n\nAfter.\n\n:::theorem[T]\nText.\n| a | b |\n|---|---|\n| 1 | 2 |\n:::\n'
    pg.evaluate("t => { const n = musubi.createNote({title:'Env math test', body:t}); musubi.openNote(n.id); }", envbody)
    pg.wait_for_timeout(700); pg.evaluate("document.activeElement && document.activeElement.blur()"); pg.wait_for_timeout(300)
    mb = pg.evaluate("Array.from(document.querySelectorAll('.cm-lp-mathblock')).map(e=>e.className)")
    check(len(mb) == 1 and 'cm-env-style-def' in mb[0], 'display math inside a box carries the box style')
    tb = pg.evaluate("Array.from(document.querySelectorAll('.cm-lp-table')).map(e=>[e.className, e.textContent.includes(':::')])")
    check(len(tb) == 1 and 'cm-env-style-thm' in tb[0][0] and not tb[0][1], 'a table at the end of a box stops at the closing fence')
    check(pg.locator('.cm-lp-envclose').count() == 2, 'both boxes have their closing line')
    pg.locator('#cm-host').screenshot(path=f'{SHOTS}/env-math.png')
    pg.keyboard.press('Control+e'); pg.wait_for_timeout(500)
    check(pg.locator('#preview .env .katex-display').count() == 1 and pg.locator('#preview .env table').count() == 1, 'read view keeps math and table inside their boxes')
    pg.locator('#preview').screenshot(path=f'{SHOTS}/env-math-read.png')
    pg.keyboard.press('Control+e'); pg.wait_for_timeout(300)

    # ---------- line breaks of plain Q/A cards in review ----------
    pg.evaluate("t => { window._qb = musubi.createNote({title:'QA breaks', body:t}, {open:false}); }", 'Q: What are the properties?\nA: It has these:\nSP 1. $A \\cdot B = B \\cdot A$\nSP 2. second\n')
    pg.evaluate("musubi.openReview({ noteId: window._qb.id })"); pg.wait_for_selector('.review')
    pg.keyboard.press('Space'); pg.wait_for_timeout(200)
    check(pg.locator('.rv-back br').count() == 2 and 'SP 2. second' in pg.inner_text('.rv-back'), 'review keeps the line breaks of a plain answer')
    pg.locator('.review').screenshot(path=f'{SHOTS}/review-breaks.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)

    # ---------- A:{ … } block answers ----------
    qabody = 'Q: Properties?\nA:{It has these:\n\n* $A \\cdot B = B \\cdot A$\n* second\n\n$$\n\\sum_i a_i b_i\n$$\n}\n\nAfter the card.\n\nQ: One line?\nA:{a set $\\{x\\}$ here}\n\nQ: Old?\nA: yes\n\nQ: Unclosed?\nA:{ never closed\n'
    pg.evaluate("t => { const n = musubi.createNote({title:'QA block test', body:t}); musubi.openNote(n.id); window._qa = n; }", qabody)
    pg.wait_for_timeout(700); pg.evaluate("document.activeElement && document.activeElement.blur()"); pg.wait_for_timeout(300)
    qc = pg.evaluate("musubi.extractCards(window._qa).filter(c=>c.kind==='qa').map(c=>c.back)")
    check(len(qc) == 4 and qc[0].startswith('It has these:') and '* second' in qc[0] and qc[0].rstrip().endswith('$$') and '}' not in qc[0].replace('\\{', '').replace('_i', ''), 'a block answer becomes one card back with its lists and math')
    check(qc[1] == 'a set $\\{x\\}$ here', 'a one-line block answer keeps escaped braces')
    check(qc[2] == 'yes' and qc[3].startswith('{'), 'plain and unclosed answers keep the old behaviour')
    check(pg.locator('.cm-lp-ablock').count() >= 4 and pg.locator('.cm-lp-aclose').count() == 1, 'live preview marks the answer body and hides the closing brace')
    check('{' not in pg.locator('.cm-line', has_text='It has these').inner_text(), 'live preview hides the opening brace')
    rh = pg.evaluate("musubi.renderMarkdown(window._qa.body)")
    check(rh.count('qa-block') == 2 and '<ul>' in rh.split('qa-block')[1] and 'math-display' in rh.split('qa-block')[1].split('After the card')[0], 'read view renders lists and display math inside the answer')
    check('After the card' not in rh.split('qa-block')[1].split('</div></div></div>')[0], 'text after the closing brace is outside the answer')
    pg.locator('#cm-host').screenshot(path=f'{SHOTS}/qa-block.png')

    pg.evaluate("musubi.openNote('20260101002100')"); pg.wait_for_timeout(500)
    pg.screenshot(path=f'{SHOTS}/live-derivation.png')
    pg.set_viewport_size({'width': 390, 'height': 844}); pg.wait_for_timeout(400)
    pg.screenshot(path=f'{SHOTS}/mobile.png')
    pg.click('#btn-sidebar'); pg.wait_for_timeout(300); pg.screenshot(path=f'{SHOTS}/mobile-side.png')

    print('\n'.join(errs) if errs else 'no console errors')
    if errs: fails.append('console errors')
    b.close()
print(f'\n{len(fails)} failure(s)')
sys.exit(1 if fails else 0)
