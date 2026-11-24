"""LaTeX Suite compatibility: snippets, tabstops, auto-fraction, tabout, matrix shortcuts, user snippets."""
import json, os, sys, time
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
URL = 'file://' + os.path.join(HERE, '..', 'dist', 'musubi.html')
SHOTS = os.environ.get('SHOTS', '/tmp/musubi-shots'); os.makedirs(SHOTS, exist_ok=True)
fails = []
def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

USER = r'''// my snippets
export default [
  {trigger: "RR", replacement: "\\mathbb{R}^{${0:n}}", options: "mA", priority: 5},
  {trigger: /([a-z])pp/, replacement: "[[0]]^{\\prime}", options: "rmA"},
  {trigger: "trip", replacement: (m) => "triple", options: "tA"},
  {trigger: "zz", replacement: "Z", options: "mA",},
]
'''
cases = [
  # (description, initial body, keys list, expected text)
  ('mk opens inline math', '', ['type:mk'], '${}{}$'),
  ('mk then x sr', '', ['type:mkxsr'], '${}x^{2}{}$'),
  ('dm on empty line', '', ['type:dm'], '$$\n\n$$'),
  ('greek @a', '', ['type:mk@a'], '${}\\alpha{}$'),
  ('auto subscript', '', ['type:mkx1'], '${}x_{1}{}$'),
  ('// fraction with tabstops', '', ['type:mk//', 'type:a', 'Tab', 'type:b', 'Tab', 'type:+c'], '${}\\frac{a}{b}+c{}$'),
  ('autofraction x/', '', ['type:mkx/', 'type:2'], '${}\\frac{x}{2}{}$'),
  ('autofraction (a+b)/', '', ['type:mk(a+b', 'type:)', 'type:/y'], '${}\\frac{a+b}{y}{}$'),
  ('alpha auto backslash', '', ['type:mkalpha'], '${}\\alpha{}$'),
  ('space after macro', '', ['type:mk\\alphax'], '${}\\alpha x{}$'),
  ('sum tab', '', ['type:mksum', 'Tab'], '${}\\sum_{i=1}^{N}{}$'),
  ('nested frac tabstops', '', ['type:mk//', 'type://', 'type:a', 'Tab', 'type:b', 'Tab', 'Tab', 'type:c'], '${}\\frac{\\frac{a}{b}}{c}{}$'),
  ('tabout of braces', '', ['type:mkhat', 'type:x', 'Tab', 'type:y'], '${}\\hat{x}y{}$'),
  ('tabout of equation', '', ['type:mkx', 'Tab', 'type: after'], '${}x{}$ after'),
  ('text mode has no math snippets', '', ['type:sr alpha'], 'sr alpha'),
  ('pmat matrix shortcuts', '', ['type:dmpmat', 'type:1', 'Tab', 'type:2', 'Enter', 'type:3'], '$$\n\\begin{pmatrix}\n1 & 2 \\\\\n3\n\\end{pmatrix}\n$$'),
  ('lim placeholder (inline trims the end)', '', ['type:mklim'], '${}\\lim_{ n \\to \\infty }{}$'),
  ('lim in display keeps space', '', ['type:dmlim'], '$$\n\\lim_{ n \\to \\infty } \n$$'),
  ('undo restores trigger', '', ['type:mksr', 'Control+z'], '${}sr{}$'),
  ('backspace deletes empty math', '', ['type:mk', 'Backspace'], ''),
  ('no snippets in code', '`x`', ['select:2-2', 'type:mk'], '`xmk`'),
  ('sum enlarges brackets', '', ['type:mk(', 'type:sum'], '${}\\left( \\sum \\right){}$'),
  ('visual U', '$x+y$', ['select:1-4', 'type:U'], '$\\underbrace{ x+y }_{  }$'),
  ('inline dm in list', '- item ', ['End', 'type:dm'], '- item \n  $$\n  \n  $$'),
  ('close paren skips', '', ['type:mk(a', 'type:)', 'type:b'], '${}(a)b{}$'),
  ('text in math', '', ['type:mk"', 'type:sr'], '${}\\text{sr}{}$'),
]
cases2 = [
  ('shift-tab goes back', '', ['type:mk//', 'type:a', 'Tab', 'type:b', 'Shift+Tab', 'type:c'], '${}\\frac{c}{b}{}$'),
  ('linked fields (outer)', '', ['type:mkouter', 'type:\\phi'], '${}\\ket{\\phi} \\bra{\\phi}{}$'),
  ('iden3', '', ['type:dmiden3'], '$$\n\\begin{pmatrix}\n1 & 0 & 0 \\\\\n0 & 1 & 0 \\\\\n0 & 0 & 1\n\\end{pmatrix}\n$$'),
  ('align in display', '', ['type:dmalign', 'type:a', 'Tab', 'type:=b', 'Enter', 'type:c'], '$$\n\\begin{aligned}\na & =b \\\\\nc\n\\end{aligned}\n$$'),
  ('dm mid-line adds newline', 'Text ', ['End', 'type:dm'], 'Text \n$$\n\n$$'),
  ('dm not before text', 'ab', ['select:1-1', 'type:dm'], 'admb'),
  ('in quote dm keeps prefix', '> ', ['End', 'type:dm'], '> $$\n> \n> $$'),
  ('set', '', ['type:mkset'], '${}\\{  \\}{}$'),
  ('exists', '', ['type:mkexists'], '${}\\exists{}$'),
  ('sin auto', '', ['type:mksinx'], '${}\\sin x{}$'),
  ('in env equation', '\\begin{equation}\n\n\\end{equation}', ['select:17-17', 'type:@b'], '\\begin{equation}\n\\beta\n\\end{equation}'),
  ('\\(\\) delimiters', '\\(\\)', ['select:2-2', 'type:sr'], '\\(^{2}\\)'),
]

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1200, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    pg.goto(URL); pg.wait_for_selector('.tour-card'); pg.click('.tour-skip'); pg.wait_for_timeout(300)
    pg.evaluate("() => { const n = musubi.createNote({title:'LS', body:''}); musubi.openNote(n.id); }"); pg.wait_for_timeout(400)
    def run(cs):
        for desc, init, keys, exp in cs:
            pg.evaluate("t => { musubi.ed.setText(t); musubi.ed.focus(); musubi.ed.setSelection(t.length); }", init); pg.wait_for_timeout(50)
            for k in keys:
                if k.startswith('type:'):
                    for ch in k[5:]: pg.keyboard.type(ch); pg.wait_for_timeout(15)
                elif k.startswith('select:'):
                    x, y = map(int, k[7:].split('-')); pg.evaluate(f"musubi.ed.view.dispatch({{selection:{{anchor:{x}, head:{y}}}}})")
                else: pg.keyboard.press(k); pg.wait_for_timeout(30)
            got = pg.evaluate("musubi.ed.getText()")
            check(got == exp, desc + ('' if got == exp else f' -- got {json.dumps(got)}, expected {json.dumps(exp)}'))
    run(cases); run(cases2)
    pg.evaluate("s => { musubi.app.settings.lsSnippets = s; }", USER)
    c = pg.evaluate("(() => { const c = musubi.lsSnippets(); return [c.list.length, c.errors]; })()")
    check(c[1] == [] and c[0] > 200, 'a pasted LaTeX Suite file loads without errors')
    run([('user string snippet with default', '', ['type:mkRR'], '${}\\mathbb{R}^{n}{}$'),
         ('user regex literal', '', ['type:mkfpp'], "${}f^{\\prime}{}$"),
         ('user function snippet', '', ['type:trip'], 'triple')])
    pg.evaluate("() => { musubi.app.settings.lsSnippets = '[ {trigger: \"x\", replacement: oops} ]'; }")
    check('Unknown name oops' in ' '.join(pg.evaluate("musubi.lsSnippets().errors")), 'a broken snippet file reports the error')
    pg.evaluate("() => { musubi.app.settings.lsSnippets = ''; musubi.app.settings.lsDefaults = false; }")
    run([('defaults can be turned off', '', ['type:mksr'], 'mksr')])
    pg.evaluate("() => { musubi.app.settings.lsDefaults = true; musubi.app.settings.lsEnabled = false; }")
    run([('snippets can be turned off', '', ['type:mksr'], 'mksr')])
    pg.evaluate("() => { musubi.app.settings.lsEnabled = true; }")
    big = ('Some text with $x^2$ and more words here. ' * 40 + '\n\n') * 30
    pg.evaluate("t => { musubi.ed.setText(t); musubi.ed.focus(); musubi.ed.setSelection(t.length); }", big)
    for ch in 'mkxsr': pg.keyboard.type(ch)
    check(pg.evaluate("musubi.ed.getText()").endswith('${}x^{2}{}$'), 'snippets work at the end of a 50,000-character note')
    ms = float(pg.evaluate("""(() => { const v = musubi.ed.view; const t1 = performance.now(); for (let k = 0; k < 20; k++) v.dispatch({changes:{from: v.state.doc.length - 1, insert: 'q'}}); return ((performance.now() - t1) / 20); })()"""))
    check(ms < 40, f'a keystroke in a large note takes {ms:.1f} ms')
    # settings
    pg.evaluate("musubi.ed.setText('')")
    pg.keyboard.press('Escape')
    pg.evaluate("document.activeElement && document.activeElement.blur()")
    pg.click('#btn-settings'); pg.wait_for_timeout(300)
    pg.click('.set-nav button[data-k="math"]'); pg.wait_for_timeout(300)
    check(pg.locator('.set-h', has_text='LaTeX Suite').count() == 1 and '203 snippets active' not in pg.inner_text('.ls-status') and 'snippets active' in pg.inner_text('.ls-status'), 'settings show the LaTeX Suite section and the snippet count')
    pg.locator('.set-h', has_text='LaTeX Suite').scroll_into_view_if_needed(); pg.wait_for_timeout(200)
    pg.screenshot(path=f'{SHOTS}/ls-settings.png')
    print('\n'.join(errs) if errs else 'no console errors')
    if errs: fails.append('console errors')
    b.close()
print(f'\n{len(fails)} failure(s)')
sys.exit(1 if fails else 0)
