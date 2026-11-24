"""Version 2.6: icon tabs, custom note types, gear icon, Cmd/Ctrl+, the knot mark, and the philosophy essay."""
import os, sys
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath('dist/musubi.html')
SHOTS = os.environ.get('SHOTS', '/tmp/musubi-shots'); os.makedirs(SHOTS, exist_ok=True)
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)

with sync_playwright() as p:
    exe = '/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None
    b = p.chromium.launch(executable_path=exe, args=['--no-sandbox'])
    errs = []
    ctx = b.new_context(viewport={'width': 1440, 'height': 900})
    pg = ctx.new_page(); pg.set_default_timeout(15000)
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto(URL); pg.wait_for_function('window.musubi'); pg.wait_for_timeout(800)
    pg.evaluate('musubi.endTour && musubi.endTour()'); pg.wait_for_timeout(600)

    # ---------- 1. sidebar tabs are icons; only the open tab shows its name ----------
    tabs = pg.evaluate("""[...document.querySelectorAll('.sb-tab')].map(t => ({k: t.dataset.tab, on: t.classList.contains('on'),
        svg: !!t.querySelector('.sb-tab-ic svg'), label: getComputedStyle(t.querySelector('.sb-tab-label')).display, aria: t.getAttribute('aria-label')}))""")
    check(len(tabs) == 4 and all(t['svg'] for t in tabs), 'each of the four sidebar tabs has an icon')
    check(all((t['label'] != 'none') == t['on'] for t in tabs), 'only the selected tab shows its name')
    check(all(t['aria'] for t in tabs), 'icon tabs keep an accessible name')
    pg.click('.sb-tab[data-tab="tags"]'); pg.wait_for_timeout(200)
    check(pg.evaluate("getComputedStyle(document.querySelector('.sb-tab[data-tab=tags] .sb-tab-label')).display") != 'none'
          and pg.evaluate("getComputedStyle(document.querySelector('.sb-tab[data-tab=notes] .sb-tab-label')).display") == 'none',
          'clicking a tab moves the name to that tab')
    pg.click('.sb-tab[data-tab="notes"]')

    # ---------- 5. welcome screen shows the knot, not the compass ----------
    check(pg.locator('.setup-mark svg.hopf').count() == 1, 'the welcome screen shows the linked-rings mark')

    # ---------- 6. the philosophy foldout ----------
    check(pg.locator('details#philo').count() == 1 and 'Zettelkasten and the Musubi philosophy' in pg.inner_text('#philo summary'), 'the welcome screen has the essay foldout')
    check(pg.evaluate("document.querySelector('#philo-body').childElementCount") == 0, 'the essay renders only when opened')
    pg.click('#philo summary'); pg.wait_for_timeout(300)
    info = pg.evaluate("""(() => { const b = document.querySelector('#philo-body'); return {
        h2: [...b.querySelectorAll('h2')].map(x => x.textContent), fn: b.querySelectorAll('.footnotes li').length,
        ext: [...b.querySelectorAll('a[href^="http"]')].every(a => a.target === '_blank'),
        raw: /\\[\\^[a-z]/.test(b.textContent) || /\\]\\(http/.test(b.innerHTML), table: !!b.querySelector('table'),
        text: b.textContent }; })()""")
    check(len(info['h2']) >= 6 and info['table'], 'the essay renders its sections and table')
    check(info['fn'] >= 50 and not info['raw'], f"the essay has its sources as footnotes ({info['fn']})")
    check(info['ext'], 'source links open in a new tab')
    for w in ['Shaoshupai', 'thinking notes', 'Quantum Well', 'TeXNotes', 'Hacker News', 'Umesao', 'Gu Yanwu', 'Dasan', 'Ibn al-Jawzi', 'Timbuktu', 'khipu', 'Pāṇini', 'Ramanujan', 'Gauss', 'Stacks Project', 'Luhmann']:
        check(w in info['text'], f'the essay covers {w}')
    pg.screenshot(path=f'{SHOTS}/v26-philosophy.png')
    pg.click('#philo-body sup.fnref a >> nth=0'); pg.wait_for_timeout(1800)
    check(pg.evaluate("(() => { const r = document.querySelector('#philo-body .footnotes li').getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight; })()"),
          'a footnote mark scrolls to its source')

    # ---------- 3 and 4. gear icon, and Cmd/Ctrl+, opens settings ----------
    gear = pg.evaluate("[...document.querySelectorAll('button')].find(x => /settings/i.test(x.title || x.getAttribute('aria-label') || ''))?.innerHTML || ''")
    check('<svg' in gear, 'the settings button has an icon')
    pg.keyboard.press('Control+,'); pg.wait_for_timeout(400)
    check(pg.locator('.settings, .modal .set-nav, [role=dialog]').count() >= 1, 'Ctrl+, opens the settings panel')
    pg.screenshot(path=f'{SHOTS}/v26-settings.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)

    # ---------- 2. custom note types ----------
    pg.evaluate("musubi.app.settings.customTypes = []")
    pg.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', {key: ',', ctrlKey: true, bubbles: true}))"); pg.wait_for_timeout(300)
    pg.locator('.ov-settings .set-nav >> text=Note types').click(); pg.wait_for_timeout(300)
    pg.fill('input[placeholder="Name of a new type"]', 'Conjecture'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    ct = pg.evaluate('musubi.app.settings.customTypes')
    check(len(ct) == 1 and ct[0]['id'] == 'conjecture' and ct[0]['label'] == 'Conjecture', 'a new type can be added by name')
    pg.click('.type-row[data-type=conjecture] .shape-btn[title="Moon"]'); pg.wait_for_timeout(150)
    pg.click('.type-row[data-type=conjecture] .swatch >> nth=7'); pg.wait_for_timeout(150)
    ct = pg.evaluate('musubi.app.settings.customTypes')[0]
    check(ct['shape'] == 'moon', 'a shape can be picked')
    check(ct['color'] != '' and pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--t-conjecture').trim()") != '', 'a colour can be picked and is applied')
    pg.screenshot(path=f'{SHOTS}/v26-types.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    check(pg.evaluate("[...document.querySelectorAll('#type option')].some(o => o.value === 'conjecture')"), 'the new type appears in the note type menu')
    pg.evaluate("musubi.createNote({title:'Every even number is a sum of two primes', type:'conjecture', body:'x'}, {open:true})"); pg.wait_for_timeout(500)
    check(pg.locator('.dot.t-conjecture').count() >= 1, 'a note of the new type shows its marker')
    pg.reload(); pg.wait_for_function('window.musubi'); pg.wait_for_timeout(800)
    check(pg.evaluate("musubi.vault.all().some(n => n.type === 'conjecture')") and pg.evaluate("[...document.querySelectorAll('#type option')].some(o => o.value === 'conjecture')"),
          'the custom type survives a reload')

    # ---------- palette command for the essay ----------
    pg.evaluate('musubi.openPhilosophy()'); pg.wait_for_timeout(500)
    check(pg.evaluate("document.querySelector('#philo').open && !document.querySelector('#empty-view').hidden"), 'the palette command opens the essay')

    print('\n'.join(errs) or 'no console errors')
    if errs: fails.append('console errors')
    b.close()
print(f'\n{len(fails)} failure(s)'); sys.exit(1 if fails else 0)
