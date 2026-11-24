"""Attachments: location setting, paste and drop of any file, Markdown image and link paths,
PDF/audio cards, lazy files, reload of changed images, ZIP import with paths. Uses the Origin Private File System as the folder."""
import os, sys, subprocess, time
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SHOTS = os.environ.get('SHOTS', '/tmp/musubi-shots'); os.makedirs(SHOTS, exist_ok=True)
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8768', '--bind', '127.0.0.1', '--directory', os.path.join(ROOT, 'dist', 'site')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
SETUP = r"""async () => {
  const root = await navigator.storage.getDirectory();
  try { await root.removeEntry('vault2', { recursive: true }); } catch (e) {}
  const dir = await root.getDirectoryHandle('vault2', { create: true });
  const put = async (path, data) => {
    const parts = path.split('/'); let d = dir;
    for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
    const fh = await d.getFileHandle(parts[parts.length - 1], { create: true });
    const w = await fh.createWritable(); await w.write(data); await w.close();
  };
  const png = (color, size) => new Promise((res) => { const c = document.createElement('canvas'); c.width = size; c.height = size; const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, size, size); c.toBlob(res, 'image/png'); });
  window.__png = png; window.__put = put; window.__dir = dir;
  await put('Physics/Wave note.md', '---\nid: 20260301120000\ntitle: Wave note\n---\nA figure: ![wave|120](figs/wave.png)\n\nPaper: [[paper.pdf]] and [the paper](../library/paper.pdf). Data: [[data.csv]]. See [other](Other.md). Gone: [[ghost.pdf]].\n\n![[paper.pdf]]\n\n![[clip.mp3]]\n');
  await put('Physics/Other.md', '---\nid: 20260301120100\ntitle: Other\n---\nThe other note.\n');
  await put('Physics/figs/wave.png', await png('#c4a24d', 40));
  await put('library/paper.pdf', '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
  await put('audio/clip.mp3', new Uint8Array([73, 68, 51, 3, 0, 0, 0, 0, 0, 0]));
  await put('data.csv', 'a,b\n1,2\n');
  await musubi.useFolderHandle(dir);
}"""
LIST = "async (p) => { let d = window.__dir; const parts = p ? p.split('/') : []; for (const x of parts) d = await d.getDirectoryHandle(x); const out = []; for await (const [n] of d.entries()) out.push(n); return out.sort(); }"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = b.new_page(viewport={'width': 1200, 'height': 1000}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto('http://127.0.0.1:8768/'); pg.wait_for_selector('.tour-card'); pg.click('.tour-skip'); pg.wait_for_timeout(300)
        pg.evaluate(SETUP); pg.wait_for_timeout(800)
        A = lambda n: pg.evaluate("n => { const a = musubi.vault.assets.get(n); return a && { path: a.path, lazy: !!a.lazy, hasBlob: !!a.blob, size: a.size, url: a.url }; }", n)
        w, pdf, mp3 = A('wave.png'), A('paper.pdf'), A('clip.mp3')
        check(w and w['path'] == 'Physics/figs/wave.png' and w['hasBlob'] and not w['lazy'], 'an image anywhere in the folder is loaded, with its path')
        check(pdf and pdf['path'] == 'library/paper.pdf' and pdf['lazy'] and not pdf['hasBlob'], 'a PDF is registered by path and not copied into browser storage')
        unres = pg.evaluate("Array.from(musubi.vault.index ? [] : [])")
        pg.evaluate("musubi.openNote('20260301120000')"); pg.wait_for_timeout(600)
        pg.evaluate("document.activeElement && document.activeElement.blur()"); pg.wait_for_timeout(300)
        # live preview
        check(pg.locator('.cm-lp-image img.asset[src^="blob:"]').count() == 1 and pg.locator('.cm-lp-image img').get_attribute('style') == 'width:120px', 'live preview: ![wave|120](figs/wave.png) shows the image at 120 px')
        check(pg.locator('.cm-content a.att[data-att="paper.pdf"]').count() >= 1 and pg.locator('.cm-content a.att[data-att="data.csv"]').count() == 1, 'live preview: [[paper.pdf]] and [[data.csv]] are attachment links')
        check(pg.locator('.cm-content .att-card[data-att="paper.pdf"] .att-head').count() == 1 and pg.locator('.cm-content .att-card[data-att="clip.mp3"] audio').count() == 1, 'live preview: ![[paper.pdf]] is a card and ![[clip.mp3]] has a player')
        check(pg.locator('.cm-content .asset-missing', has_text='ghost.pdf').count() == 1, 'live preview: a link to a missing file says so')
        pg.locator('#cm-host').screenshot(path=f'{SHOTS}/attach-live.png')
        # read view
        pg.keyboard.press('Control+e'); pg.wait_for_timeout(600)
        pv = '#preview'
        check(pg.locator(f'{pv} img.asset[src^="blob:"]').count() == 1, 'read view: the Markdown image path resolves to the file')
        check(pg.locator(f'{pv} a.att[data-att="paper.pdf"]').count() == 2, 'read view: [[paper.pdf]] and [the paper](../library/paper.pdf) both open the PDF')
        check(pg.locator(f'{pv} a.wl[data-id="20260301120100"]').count() == 1, 'read view: [other](Other.md) links to the note')
        check(pg.locator(f'{pv} .att-card[data-att="paper.pdf"]').count() == 1 and pg.locator(f'{pv} .att-card audio').count() == 1, 'read view: PDF card and audio player')
        pg.locator(f'{pv} .att-card[data-att="paper.pdf"] .att-toggle').click(); pg.wait_for_timeout(600)
        check(pg.locator(f'{pv} .att-card iframe[src^="blob:"]').count() == 1, 'Show reads the PDF from the folder and opens it in the note')
        check(A('paper.pdf')['hasBlob'], 'the PDF bytes were read only when needed')
        pg.locator(pv).screenshot(path=f'{SHOTS}/attach-read.png')
        pg.keyboard.press('Control+e'); pg.wait_for_timeout(300)
        idx_unres = pg.evaluate("(() => { const r = []; for (const n of musubi.vault.all()) {} return r; })()")
        unresolved = pg.evaluate("Array.from(musubi.vault.index().unresolved.values()).map(u => u.target)")
        check('paper.pdf' not in unresolved and 'data.csv' not in unresolved and 'ghost.pdf' in unresolved, 'links to attachments are not "unresolved"; a missing file is')
        # location setting
        note = "musubi.vault.get('20260301120000')"
        res = {}
        for loc, folder, expect in [('folder', 'attachments', 'attachments/pic.png'), ('subfolder', 'assets', 'Physics/assets/pic-1.png'), ('note', '', 'Physics/pic-2.png'), ('root', '', 'pic-3.png')]:
            name = pg.evaluate(f"""async () => {{ const s = musubi.app.settings; s.attachLocation = '{loc}'; s.attachFolder = '{folder or 'assets'}'; s.attachSubfolder = '{folder or 'assets'}';
              return await musubi.saveAsset(await window.__png('#336699', 8), 'pic.png', {note}); }}""")
            path = A(name)['path']
            parts = expect.split('/'); listing = pg.evaluate(LIST, '/'.join(parts[:-1]))
            check(path == expect and parts[-1] in listing, f'location "{loc}": the file is written to {expect}')
        # paste a PDF and drop a .docx into the editor
        pg.evaluate("() => { musubi.app.settings.attachLocation = 'folder'; musubi.app.settings.attachFolder = 'attachments'; }")
        pg.click('.cm-content'); pg.keyboard.press('Control+End'); pg.keyboard.press('Enter')
        pg.evaluate("""() => { const dt = new DataTransfer(); dt.items.add(new File(['%PDF-1.4 x'], 'Report 2026.pdf', { type: 'application/pdf' }));
          document.querySelector('.cm-content').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }""")
        pg.wait_for_timeout(600)
        txt = pg.evaluate('musubi.ed.getText()')
        check('![[Report-2026.pdf]]' in txt and 'Report-2026.pdf' in pg.evaluate(LIST, 'attachments'), 'pasting a PDF saves it to the attachment folder and embeds it')
        pg.evaluate("""() => { const dt = new DataTransfer(); dt.items.add(new File(['PK'], 'draft.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
          const el = document.querySelector('.cm-content'); const r = el.getBoundingClientRect();
          el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.bottom - 10 })); }""")
        pg.wait_for_timeout(600)
        txt = pg.evaluate('musubi.ed.getText()')
        check('[[draft.docx]]' in txt and '![[draft.docx]]' not in txt and 'draft.docx' in pg.evaluate(LIST, 'attachments'), 'dropping a Word file saves it and inserts a plain link')
        pg.evaluate("""() => { const dt = new DataTransfer(); dt.items.add(new File(['x'], 'screenshot.png', { type: 'image/png' }));
          document.querySelector('.cm-content').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }""")
        pg.wait_for_timeout(500)
        check('![[screenshot.png]]' in pg.evaluate('musubi.ed.getText()'), 'a pasted image file keeps its name')
        # changed image reloads
        old = A('wave.png')
        pg.wait_for_timeout(1100)
        pg.evaluate("async () => { await window.__put('Physics/figs/wave.png', await window.__png('#993333', 64)); await musubi.folderRescan(true); }"); pg.wait_for_timeout(600)
        new = A('wave.png')
        check(new['size'] != old['size'] and new['url'] != old['url'], 'an image changed in another app loads again')
        # a folder-only file deleted outside goes away
        pg.evaluate("async () => { await window.__dir.getDirectoryHandle('audio').then(d => d.removeEntry('clip.mp3')); await musubi.folderRescan(true); }"); pg.wait_for_timeout(500)
        check(A('clip.mp3') is None, 'a folder-only file deleted outside is removed')
        # ZIP import keeps the paths of attachments
        pg.evaluate("""async () => { const enc = new TextEncoder();
          const zip = await musubi.makeZip([{ name: 'v/notes/Imported.md', data: enc.encode('# Imported\\n\\n![[doc.pdf]]\\n') }, { name: 'v/media/doc.pdf', data: enc.encode('%PDF-1.4 imported') }]);
          await musubi.importFiles([new File([zip], 'v.zip', { type: 'application/zip' })]); }""")
        pg.wait_for_timeout(800)
        d = A('doc.pdf')
        check(d and d['path'] == 'media/doc.pdf' and 'doc.pdf' in pg.evaluate(LIST, 'media'), 'a ZIP import keeps attachments in their folders')
        # settings row
        pg.click('#btn-settings'); pg.click('.set-nav button[data-k="data"]'); pg.wait_for_timeout(300)
        check(pg.locator('.settings select option[value="subfolder"]').count() == 1, 'Settings, Data has the attachment location setting')
        pg.locator('.settings').screenshot(path=f'{SHOTS}/attach-settings.png')
        print('\n'.join(errs) or 'no console errors')
        if errs: fails.append('errors')
        b.close()
finally:
    srv.terminate()
print(f'\n{len(fails)} failure(s)'); sys.exit(1 if fails else 0)
