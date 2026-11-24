"""Runs Musubi the way an artifact page runs: inside a sandboxed srcdoc iframe with an opaque origin."""
import os, sys
from playwright.sync_api import sync_playwright
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
html = open('dist/musubi.html', encoding='utf-8').read()
with sync_playwright() as p:
    exe = '/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None
    b = p.chromium.launch(executable_path=exe, args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1400, 'height': 900}); errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.set_content('<!doctype html><body style="margin:0"><iframe id="f" sandbox="allow-scripts allow-forms allow-popups allow-modals" style="border:0;width:100vw;height:100vh"></iframe></body>')
    pg.evaluate('(h) => { document.getElementById("f").srcdoc = h; }', html)
    fr = None
    for _ in range(60):
        pg.wait_for_timeout(250)
        fr = next((f for f in pg.frames if f != pg.main_frame), None)
        if fr and fr.evaluate('!!window.musubi'): break
    check(fr is not None and fr.evaluate('!!window.musubi'), 'starts inside a sandboxed srcdoc frame')
    fr.wait_for_selector('.tour-card'); fr.click('.tour-skip'); fr.wait_for_timeout(400)
    a = fr.evaluate("musubi.createNote({title:'Alpha', body:'Links to [[Beta]].'}).id"); fr.wait_for_timeout(300)
    bid = fr.evaluate("musubi.createNote({title:'Beta', body:'Back to [[Alpha]].'}).id"); fr.wait_for_timeout(300)
    check(fr.evaluate('musubi.app.current') == bid and fr.locator('#mentions .mn-item').count() == 1, 'opening a note completes (mentions render) without address changes')
    fr.click('#btn-back'); fr.wait_for_timeout(300)
    check(fr.evaluate('musubi.app.current') == a, 'back button works without browser history')
    fr.click('#btn-fwd'); fr.wait_for_timeout(300)
    check(fr.evaluate('musubi.app.current') == bid, 'forward button works')
    fr.locator('.cm-lp-link a.wl').first.click(); fr.wait_for_timeout(300)
    check(fr.evaluate('musubi.app.current') == a, 'clicking a rendered link navigates')
    fr.evaluate('musubi.startTour({firstRun:true}), 0'); fr.wait_for_selector('.tour-card')
    for _ in range(3): fr.click('.tour-card .btn-cta'); fr.wait_for_timeout(300)
    fr.click('.tour-skip'); fr.wait_for_timeout(500)
    check(sorted(fr.evaluate('musubi.vault.all().map(n=>n.title)')) == ['Alpha', 'Beta'], 'tour cleanup works in the frame')
    print('\n'.join(errs) or 'no console errors')
    if errs: fails.append('errors')
    b.close()
print(f'\n{len(fails)} failure(s)'); sys.exit(1 if fails else 0)
