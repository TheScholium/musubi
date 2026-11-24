import sys, asyncio
from playwright.sync_api import sync_playwright
url = 'file:///home/claude/musubi/dist/musubi.html'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    errs = []
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
    pg.goto(url); pg.wait_for_timeout(1500)
    pg.screenshot(path='/home/claude/shots/01-welcome.png')
    print('notes', pg.evaluate('musubi.vault.notes.size'))
    pg.evaluate("musubi.openNote('20260101000100')"); pg.wait_for_timeout(800)
    pg.screenshot(path='/home/claude/shots/02-syntax.png')
    print('\n'.join(errs) or 'no console errors')
    b.close()
