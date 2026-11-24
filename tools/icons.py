"""Render the app icons (PNG) from src/pwa/*.svg with headless Chrome. Run once after changing the SVGs."""
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'pwa')
JOBS = [('icon.svg', 'icon-512.png', 512), ('icon.svg', 'icon-192.png', 192), ('icon-maskable.svg', 'maskable-512.png', 512),
        ('icon-maskable.svg', 'apple-touch-icon.png', 180), ('icon.svg', 'icon-32.png', 32)]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for src, out, size in JOBS:
        pg = b.new_page(viewport={'width': size, 'height': size})
        svg = open(os.path.join(ROOT, src)).read()
        pg.set_content(f'<html><body style="margin:0;background:transparent">{svg.replace("<svg ", f"<svg width=\'{size}\' height=\'{size}\' ", 1)}</body></html>')
        pg.screenshot(path=os.path.join(ROOT, out), omit_background=True)
        pg.close()
    b.close()
print('icons written')
