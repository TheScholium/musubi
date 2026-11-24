"""Tour cleanup, migration from version 1, branch, extract, unlinked mentions, hover cards, blocked storage."""
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
    def page(ctx):
        pg = ctx.new_page(); pg.set_default_timeout(15000)
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        return pg

    # ---------- full tour, with real actions, then cleanup ----------
    ctx = b.new_context(viewport={'width': 1440, 'height': 900})
    pg = page(ctx); pg.goto(URL); pg.wait_for_selector('.tour-card')
    steps = 0
    while pg.locator('.tour-card').count():
        title = pg.locator('.tour-title').inner_text()
        if 'Link one idea' in title:
            pg.click('.cm-content'); pg.keyboard.press('Control+End'); pg.keyboard.press('Enter')
            pg.keyboard.type('[[link'); pg.wait_for_timeout(400); pg.keyboard.press('Enter'); pg.wait_for_timeout(700)
            check(pg.is_visible('.tour-done'), 'tour notices the link the user made')
        if 'A note renders' in title:
            # extra work during the tour: a new note, a flashcard review, an image, and a deleted note
            pg.evaluate("musubi.createNote({title:'Made during tour', body:'{{c1::x}}'}, {open:false})")
            pg.evaluate("""(async () => { const c = musubi.extractCards(musubi.vault.all().find(n=>n.title==='Made during tour'))[0];
              musubi.app.srs[c.id] = {due: 0, ivl: 1, ease: 2.5, reps: 1, lapses: 0}; })()""")
            pg.evaluate("(async()=>{ const n = musubi.createNote({title:'Deleted during tour', body:'x'}, {open:false}); await musubi.store.putTrash(Object.assign({}, n, {deletedAt: Date.now()})); })()")
            pg.wait_for_timeout(200)
        pg.screenshot(path=f'{SHOTS}/tour-{steps:02d}.png')
        steps += 1
        pg.click('.tour-card .btn-cta'); pg.wait_for_timeout(450)
        if steps > 20: break
    pg.wait_for_timeout(600)
    check(steps == 13, f'tour has 13 steps ({steps})')
    check(pg.evaluate('musubi.vault.notes.size') == 0, 'after the tour no notes remain')
    check(pg.evaluate('musubi.store.allNotes().then(l=>l.length)') == 0, 'after the tour storage holds no notes')
    check(pg.evaluate('musubi.store.allTrash().then(l=>l.length)') == 0, 'after the tour the trash is empty')
    check(pg.evaluate("Object.keys(musubi.app.srs).filter(k=>!k.startsWith('_')).length") == 0, 'after the tour no review history remains')
    check(pg.evaluate("musubi.store.history('x').then(()=>musubi.vault.index().tagCount.size)") == 0, 'after the tour no tags remain')
    check(pg.evaluate('musubi.app.settings.onboarded') is True and pg.evaluate('musubi.app.settings.tour') is None, 'tour completion is recorded')
    check(pg.is_visible('.setup') and 'Begin your Zettelkasten' in pg.inner_text('.setup-title'), 'the setup screen is ready')
    pg.screenshot(path=f'{SHOTS}/after-tour.png')
    pg.reload(); pg.wait_for_function('window.musubi'); pg.wait_for_timeout(500)
    check(pg.locator('.tour-card').count() == 0 and pg.evaluate('musubi.vault.notes.size') == 0, 'reload stays empty, tour does not return')
    ctx.close()

    # ---------- tour resumes after a reload mid-way, and replay keeps existing notes ----------
    ctx = b.new_context(viewport={'width': 1440, 'height': 900})
    pg = page(ctx); pg.goto(URL); pg.wait_for_selector('.tour-card')
    for _ in range(3): pg.click('.tour-card .btn-cta'); pg.wait_for_timeout(350)
    pg.wait_for_timeout(800)
    pg.reload(); pg.wait_for_selector('.tour-card')
    check('4 of 13' in pg.inner_text('.tour-count'), 'tour resumes at the same step after reload')
    pg.click('.tour-skip'); pg.wait_for_timeout(500)
    check(pg.evaluate('musubi.vault.notes.size') == 0, 'skipping mid-way also cleans up')
    pg.evaluate("musubi.createNote({title:'My own note', body:'Mine.'})"); pg.wait_for_timeout(300)
    pg.evaluate('musubi.startTour(), 0'); pg.wait_for_selector('.ov-dialog .btn-cta, .ov-dialog .btn-primary')
    pg.click('.ov-dialog .btn-primary'); pg.wait_for_selector('.tour-card')
    for _ in range(4): pg.click('.tour-card .btn-cta'); pg.wait_for_timeout(350)
    pg.click('.tour-skip'); pg.wait_for_timeout(500)
    titles = pg.evaluate('musubi.vault.all().map(n=>n.title)')
    check(titles == ['My own note'], f'replaying the tour keeps existing notes ({titles})')
    ctx.close()

    # ---------- migration: version 1 seeded example notes ----------
    ctx = b.new_context(viewport={'width': 1440, 'height': 900})
    pg = page(ctx); pg.goto(URL); pg.wait_for_selector('.tour-card')
    pg.evaluate("""(async () => {
      await musubi.seedVault(false);
      const s = Object.assign({}, musubi.app.settings, { seeded: true, onboarded: undefined, tour: null });
      await musubi.store.setMeta('settings', s);
    })()""")
    pg.wait_for_timeout(800)
    pg.reload(); pg.wait_for_function('window.musubi'); pg.wait_for_timeout(800)
    check(pg.evaluate('musubi.vault.notes.size') == 0 and pg.locator('.tour-card').count() == 1, 'old auto-seeded notes move to the trash and the tour starts')
    check(pg.evaluate('musubi.store.allTrash().then(l=>l.length)') == 20, 'the old example notes stay restorable in the trash')
    ctx.close()

    # ---------- data from the old name (Organon) is copied once ----------
    ctx = b.new_context(viewport={'width': 1440, 'height': 900})
    pg = page(ctx); pg.goto(URL); pg.wait_for_selector('.tour-card')
    pg.evaluate("""(async () => {
      musubi.store.db.close();
      await new Promise((res) => { const d = indexedDB.deleteDatabase('musubi'); d.onsuccess = d.onerror = d.onblocked = () => res(); });
      const db = await new Promise((res, rej) => { const rq = indexedDB.open('organon', 1); rq.onupgradeneeded = () => { const x = rq.result;
        x.createObjectStore('notes', { keyPath: 'id' }); x.createObjectStore('meta'); const h = x.createObjectStore('history', { keyPath: 'hid', autoIncrement: true }); h.createIndex('noteId', 'noteId');
        x.createObjectStore('trash', { keyPath: 'id' }); x.createObjectStore('assets', { keyPath: 'name' }); };
        rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });
      await new Promise((res) => { const tx = db.transaction(['notes', 'meta'], 'readwrite');
        tx.objectStore('notes').put({ id: '20250101000000', title: 'Old note', type: 'concept', status: 'permanent', tags: [], aliases: [], extra: [], created: '2025-01-01T00:00:00', modified: '2025-01-01T00:00:00', body: 'Kept.' });
        tx.objectStore('meta').put({ onboarded: true, mode: 'live' }, 'settings');
        tx.oncomplete = res; });
      db.close();
    })()""")
    pg.reload(); pg.wait_for_function('window.musubi'); pg.wait_for_timeout(800)
    pg.wait_for_selector('.tour-card')
    check(pg.evaluate("musubi.vault.all().map(n=>n.title)").count('Old note') == 1, 'notes from the Organon database carry over')
    check(pg.locator('.tour-card').count() == 1, 'the new tour opens once for a user who finished the old tour')
    check('stay as they are' in pg.inner_text('.tour-body'), 'the welcome text says that existing notes stay')
    for _ in range(3): pg.click('.tour-card .btn-cta'); pg.wait_for_timeout(350)
    pg.click('.tour-skip'); pg.wait_for_timeout(500)
    check(pg.evaluate("musubi.vault.all().map(n=>n.title)") == ['Old note'], 'the tour keeps the carried-over note and removes its own')
    check(pg.evaluate('musubi.app.settings.tourSeen') == 2, 'skipping records the tour version')
    pg.reload(); pg.wait_for_function('window.musubi'); pg.wait_for_timeout(800)
    check(pg.locator('.tour-card').count() == 0, 'the tour does not open again after that')
    ctx.close()

    # ---------- working features on example notes ----------
    ctx = b.new_context(viewport={'width': 1440, 'height': 900})
    pg = page(ctx); pg.goto(URL); pg.wait_for_selector('.tour-card'); pg.click('.tour-skip'); pg.wait_for_timeout(300)
    pg.evaluate('musubi.seedVault(false)'); pg.wait_for_timeout(500)
    pg.evaluate("musubi.openNote('20260101003100')"); pg.wait_for_timeout(400)
    pg.screenshot(path=f'{SHOTS}/argument-live.png')
    pg.click('.cm-content'); pg.evaluate('musubi.ed.setSelection(musubi.ed.getText().length)')
    pg.keyboard.press('Alt+b'); pg.wait_for_selector('.dialog-new')
    pg.fill('.dialog-new input', 'Gettier cases and luck'); pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    curn = pg.evaluate('musubi.vault.get(musubi.app.current)')
    check(curn['title'] == 'Gettier cases and luck' and 'follows::[[Gettier problem]]' in curn['body'], 'branch makes a follow-up note')
    check('[[Gettier cases and luck]]' in pg.evaluate("musubi.vault.get('20260101003100').body"), 'branch links back from the source note')

    pg.evaluate("musubi.openNote('20260101000200')"); pg.wait_for_timeout(300)
    t = pg.evaluate('musubi.ed.getText()')
    i = t.index('The sociologist'); j = t.index('partner in thought.') + len('partner in thought.')
    pg.click('.cm-content'); pg.evaluate(f'musubi.ed.setSelection({i}, {j})')
    pg.click('#btn-more'); pg.locator('.menu-item', has_text='Extract').click(); pg.wait_for_selector('.dialog-new')
    pg.fill('.dialog-new input', 'Luhmann slip box'); pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    zk = pg.evaluate("musubi.vault.get('20260101000200').body")
    check('[[Luhmann slip box]]' in zk and 'partner in thought' not in zk and 'partner in thought' in pg.evaluate('musubi.vault.get(musubi.app.current).body'), 'extract moves the selection to a new note')

    pg.evaluate("musubi.createNote({title:'Completeness', type:'definition', body:'Every Cauchy sequence converges.'})"); pg.wait_for_timeout(500)
    check(pg.locator('#mentions .mn-linkit').count() >= 1, 'unlinked mentions are found')
    pg.locator('#mentions .mn-linkit').first.click(); pg.wait_for_timeout(400)
    check('[[Completeness|completeness]]' in pg.evaluate("musubi.vault.get('20260101001200').body"), 'link button rewrites the mention')

    pg.evaluate("musubi.openNote('20260101001400')"); pg.wait_for_timeout(300)
    pg.keyboard.press('Control+e'); pg.wait_for_timeout(300)
    pg.hover('#preview a.wl[data-id="20260101001200"] >> nth=0'); pg.wait_for_timeout(900)
    check(pg.is_visible('#hover-card'), 'hover card appears')
    pg.screenshot(path=f'{SHOTS}/hover.png')
    pg.mouse.move(5, 500); pg.wait_for_timeout(500)
    check(not pg.is_visible('#hover-card'), 'hover card hides')
    pg.keyboard.press('Control+e')
    ctx.close()

    # ---------- storage blocked ----------
    ctx2 = b.new_context(viewport={'width': 1280, 'height': 800})
    ctx2.add_init_script("""Object.defineProperty(window, 'indexedDB', { get() { throw new DOMException('blocked', 'SecurityError'); } });
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
      window.BroadcastChannel = function () { throw new Error('no'); };""")
    pg2 = ctx2.new_page(); e2 = []
    pg2.on('pageerror', lambda e: e2.append(str(e)))
    pg2.goto(URL); pg2.wait_for_timeout(1500)
    check(pg2.evaluate('window.musubi && musubi.store.mode') == 'memory' and pg2.locator('.tour-card').count() == 1, 'runs with storage blocked (memory mode)')
    check(not e2, 'no page errors in memory mode ' + ';'.join(e2))
    print('\n'.join(errs) or 'no console errors')
    if errs: fails.append('console errors')
    b.close()
print(f'\n{len(fails)} failure(s)'); sys.exit(1 if fails else 0)
