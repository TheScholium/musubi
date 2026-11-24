"""Folder sync test with the Origin Private File System as a stand-in for a real folder."""
import os, sys, subprocess, time
from playwright.sync_api import sync_playwright
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1', '--directory', os.path.abspath('dist/site')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
try:
    with sync_playwright() as p:
        exe = '/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None
        b = p.chromium.launch(executable_path=exe, args=['--no-sandbox'])
        pg = b.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto('http://127.0.0.1:8765/'); pg.wait_for_selector('.tour-card'); pg.click('.tour-skip'); pg.wait_for_timeout(300)
        pg.evaluate('musubi.seedVault(false)'); pg.wait_for_timeout(500)
        pg.evaluate("""async () => {
          const root = await navigator.storage.getDirectory();
          const dir = await root.getDirectoryHandle('vault', { create: true });
          const fh = await dir.getFileHandle('External idea.md', { create: true });
          const w = await fh.createWritable(); await w.write('# External idea\\n\\nWritten in another editor. See [[Compact space]].\\n'); await w.close();
          window.__dir = dir;
          await musubi.useFolderHandle(dir);
        }""")
        pg.wait_for_timeout(500)
        files = pg.evaluate("async () => { const out=[]; for await (const [n] of window.__dir.entries()) out.push(n); return out; }")
        n_notes = pg.evaluate('musubi.vault.notes.size')
        check(len([f for f in files if f.endswith('.md')]) == n_notes, f'every note written as a file ({len(files)} entries, {n_notes} notes)')
        ext = pg.evaluate("musubi.vault.all().find(n => n.title === 'External idea')")
        check(ext is not None and ext['file'] == 'External idea.md', 'external file imported')
        check('Compact space.md' in files, 'file named after title')
        # edit in the app -> file updated
        pg.evaluate("musubi.openNote('20260101001000')"); pg.wait_for_timeout(200)
        pg.click('.cm-content'); pg.keyboard.press('Control+End'); pg.keyboard.type('\nEdited in Musubi.'); pg.wait_for_timeout(1500)
        txt = pg.evaluate("async () => (await (await window.__dir.getFileHandle('Open cover.md')).getFile()).text()")
        check('Edited in Musubi.' in txt and txt.startswith('---\nid: 20260101001000'), 'app edit written to file with front matter')
        # rename -> file renamed
        pg.click('#title'); pg.fill('#title', 'Open covering'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1500)
        files = pg.evaluate("async () => { const out=[]; for await (const [n] of window.__dir.entries()) out.push(n); return out; }")
        check('Open covering.md' in files and 'Open cover.md' not in files, 'rename renames the file')
        # external edit -> note updated
        pg.wait_for_timeout(1100)
        pg.evaluate("""async () => { const fh = await window.__dir.getFileHandle('External idea.md'); const w = await fh.createWritable();
          await w.write('# External idea\\n\\nChanged outside.\\n'); await w.close(); await musubi.folderRescan(true); }""")
        pg.wait_for_timeout(400)
        body = pg.evaluate("musubi.vault.all().find(n => n.title === 'External idea').body")
        check('Changed outside.' in body, 'external edit loads on rescan')
        # external delete -> note to trash
        pg.evaluate("async () => { await window.__dir.removeEntry('External idea.md'); await musubi.folderRescan(true); }"); pg.wait_for_timeout(400)
        check(pg.evaluate("!musubi.vault.all().some(n => n.title === 'External idea')"), 'external delete moves note to trash')
        # Not tested here: reading an OPFS handle back from IndexedDB crashes headless Chrome in this sandbox.
        print('\n'.join(errs) or 'no console errors')
        if errs: fails.append('errors')
        b.close()
finally:
    srv.terminate()
print(f'\n{len(fails)} failure(s)'); sys.exit(1 if fails else 0)
