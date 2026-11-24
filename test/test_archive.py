"""A note written by the Archive plugin for Supernote, in folder mode."""
import os, sys, subprocess, time, base64, io
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
fails = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
im = Image.new('RGBA', (300, 120), (0,0,0,0)); d = ImageDraw.Draw(im)
d.line([(10,60),(80,20),(150,90),(290,30)], fill=(0,0,0,255), width=6)
buf = io.BytesIO(); im.save(buf, 'PNG'); png = base64.b64encode(buf.getvalue()).decode()
NOTE = '---\ncaptured: 2026-10-24T21:36\nsource: supernote\nnotebook: "Lee Manifolds"\npage: 12\ntags:\n  - archive\n---\n\n![[Title 20261024-213600.png|ink]]\n'
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8766', '--bind', '127.0.0.1', '--directory', os.path.abspath('dist/site')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox']); pg = b.new_page(viewport={'width':1300,'height':850}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8766/'); pg.wait_for_selector('.tour-card'); pg.click('.tour-skip'); pg.wait_for_timeout(300)
    pg.evaluate("""async ([note, png]) => {
      const root = await navigator.storage.getDirectory();
      const v = await root.getDirectoryHandle('vault', { create: true });
      const a = await v.getDirectoryHandle('Archive', { create: true });
      const at = await a.getDirectoryHandle('attachments', { create: true });
      let w = await (await a.getFileHandle('Title.md', { create: true })).createWritable(); await w.write(note); await w.close();
      const bytes = Uint8Array.from(atob(png), c => c.charCodeAt(0));
      w = await (await at.getFileHandle('Title 20261024-213600.png', { create: true })).createWritable(); await w.write(bytes); await w.close();
      window.__v = v; window.__a = a; await musubi.useFolderHandle(v);
    }""", [NOTE, png])
    pg.wait_for_timeout(2500)
    n = pg.evaluate("musubi.vault.all().find(n => n.title === 'Title')")
    check(n is not None and n['file'] == 'Archive/Title.md' and n['tags'] == ['archive'], 'the Archive note loads with its title and tag')
    check(any('notebook:' in x for x in n['extra']) and any('page: 12' in x for x in n['extra']), 'its notebook and page fields are kept')
    txt = pg.evaluate("async () => (await (await window.__a.getFileHandle('Title.md')).getFile()).text()")
    check(txt == NOTE, 'linking the folder does not rewrite the file')
    id1 = n['id']
    pg.reload(); pg.wait_for_function('window.musubi'); pg.wait_for_timeout(3000)
    check(pg.evaluate("musubi.vault.all().map(n=>n.id)") == [id1], 'the note keeps its ID after a reload')
    pg.evaluate("musubi.openNote(musubi.vault.all().find(n => n.title === 'Title').id)"); pg.wait_for_timeout(1200)
    img = pg.evaluate("[...document.querySelectorAll('#note-view img')].map(i => [i.alt, i.naturalWidth, getComputedStyle(i).filter])")
    check(len(img) == 1 and img[0][1] == 300, 'the handwriting image in attachments/ resolves')
    check(img and img[0][0] == 'ink' and 'invert' in img[0][2], 'ink images are redrawn in parchment on the dark theme')
    pg.screenshot(path=os.environ.get('SHOTS', '/tmp/musubi-shots') + '/archive-note.png')
    check(not errs, 'no page errors ' + ';'.join(errs))
    b.close()
finally: srv.terminate()
print(f'\n{len(fails)} failure(s)'); sys.exit(1 if fails else 0)
