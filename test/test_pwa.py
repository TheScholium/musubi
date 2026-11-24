"""Installed-app (PWA) checks: manifest, installability, service worker, offline start, Dock shortcuts,
update prompt, folder banner. Serves dist/site on a local port."""
import os, sys, json, shutil, subprocess, time, tempfile, re
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
SHOTS = os.environ.get('SHOTS', '/tmp/musubi-shots'); os.makedirs(SHOTS, exist_ok=True)
PORT = 8767
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
site = tempfile.mkdtemp(); shutil.copytree(os.path.join(ROOT, 'dist', 'site'), site, dirs_exist_ok=True)
def serve():
    return subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = serve(); time.sleep(0.8)
URL = f'http://127.0.0.1:{PORT}/'
man = json.load(open(os.path.join(site, 'manifest.webmanifest')))
check(man['display'] == 'standalone' and any(i['purpose'] == 'maskable' for i in man['icons']) and len(man['shortcuts']) == 3, 'manifest: standalone, maskable icon, three Dock shortcuts')
check(all(os.path.exists(os.path.join(site, i['src'])) for i in man['icons']), 'every manifest icon exists')
check(re.search(r"const VERSION = '\d+\.\d+\.\d+-[0-9a-f]{10}'", open(os.path.join(site, 'sw.js')).read()) is not None, 'service worker carries the build version')
try:
    with sync_playwright() as p:
        prof = tempfile.mkdtemp()
        ctx = p.chromium.launch_persistent_context(prof, executable_path='/usr/bin/google-chrome', args=['--no-sandbox'], viewport={'width': 1200, 'height': 860})
        b = ctx
        pg = ctx.pages[0] if ctx.pages else ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        pg.goto(URL); pg.wait_for_function('window.musubi'); pg.wait_for_timeout(500)
        check(pg.locator('link[rel="manifest"]').count() == 1, 'served over http(s): the page links the manifest')
        check(pg.evaluate("getComputedStyle(document.body).backgroundColor") not in ('rgba(0, 0, 0, 0)', 'transparent'), 'the Istari styles are applied')
        pg.wait_for_function('navigator.serviceWorker.ready.then(() => true)', timeout=10000)
        pg.reload(); pg.wait_for_function('window.musubi'); pg.wait_for_timeout(600)
        check(pg.evaluate('!!navigator.serviceWorker.controller'), 'the service worker controls the page after a reload')
        cdp = ctx.new_cdp_session(pg)
        inst = cdp.send('Page.getInstallabilityErrors')
        check(inst.get('installabilityErrors') == [], 'Chrome reports no installability errors: ' + json.dumps(inst.get('installabilityErrors')))
        mf = cdp.send('Page.getAppManifest')
        check(not mf.get('errors'), 'Chrome parses the manifest without errors')
        # offline: stop the server, the app still opens
        if pg.locator('.tour-skip').count(): pg.click('.tour-skip'); pg.wait_for_timeout(300)
        pg.evaluate("() => { const n = musubi.createNote({title:'Offline note', body:'kept'}); }"); pg.wait_for_timeout(600)
        srv.terminate(); srv.wait(); time.sleep(0.3)
        pg.reload(); pg.wait_for_function('window.musubi', timeout=10000); pg.wait_for_timeout(600)
        check(pg.evaluate("musubi.vault.all().some(n => n.title === 'Offline note')"), 'with the server stopped, the app still starts and has its notes')
        # Dock shortcut ?action=new works offline too
        pg.goto(URL + '?action=new'); pg.wait_for_function('window.musubi', timeout=10000); pg.wait_for_timeout(900)
        check(pg.locator('.overlay').count() >= 1 and '?action' not in pg.url, 'the "New note" Dock shortcut opens the new-note dialog and cleans the address')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        # folder banner
        pg.evaluate("() => { musubi.app.folder = { handle: null, name: 'Zettelkasten', status: 'needs-permission', files: new Map() }; }")
        has = pg.evaluate("(() => { if (window.musubi.updateFolderBanner) window.musubi.updateFolderBanner(); return !!document.getElementById('folder-banner'); })()")
        check(has and 'Zettelkasten' in pg.inner_text('#folder-banner'), 'a folder that lost permission shows a banner with an Allow button')
        pg.screenshot(path=f'{SHOTS}/pwa-banner.png')
        # install page in settings
        pg.click('#btn-settings'); pg.click('.set-nav button[data-k="install"]'); pg.wait_for_timeout(300)
        check('Keep in Dock' in pg.inner_text('.settings'), 'Settings has the install instructions')
        pg.screenshot(path=f'{SHOTS}/pwa-install.png')
        pg.keyboard.press('Escape')
        # update: a new build with another version offers a reload
        srv = serve(); time.sleep(0.8)
        pg.goto(URL); pg.wait_for_function('window.musubi'); pg.wait_for_timeout(500)
        swp = os.path.join(site, 'sw.js'); src = open(swp).read()
        open(swp, 'w').write(re.sub(r"const VERSION = '[^']+'", "const VERSION = 'test-update'", src))
        pg.evaluate("navigator.serviceWorker.getRegistration().then(r => r.update())"); pg.wait_for_timeout(2500)
        check('new version' in pg.inner_text('#toasts'), 'a new build offers a reload')
        pg.locator('#toasts button', has_text='Reload').click()
        pg.wait_for_function('window.musubi', timeout=10000); pg.wait_for_timeout(1500)
        ver = pg.evaluate("caches.keys()")
        check(ver == ['musubi-test-update'], 'after the reload only the new cache remains: ' + str(ver))
        print('\n'.join(errs) if errs else 'no console errors')
        bad = [e for e in errs if 'Failed to load resource' not in e and 'ERR_CONNECTION_REFUSED' not in e]
        if bad: fails.append('console errors')
        b.close()
finally:
    try: srv.terminate()
    except Exception: pass
print(f'\n{len(fails)} failure(s)'); sys.exit(1 if fails else 0)
