/* ---------- installed app (Progressive Web App) ----------
   When Musubi is served over HTTPS (or localhost), it can be installed from Chrome, Edge, Brave or Arc:
   it gets a Dock icon, its own windows (Cmd/Ctrl+N opens another), works offline, and keeps the folder link.
   As a local file or inside an embedded frame, none of this runs. */
const PWA = { prompt: null, can: false, waiting: null };
function pwaPossible() {
  try { return /^https?:$/.test(location.protocol) && window.top === window && 'serviceWorker' in navigator; } catch (e) { return false; }
}
function pwaStandalone() {
  try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches || navigator.standalone === true; } catch (e) { return false; }
}
function pwaInit() {
  if (!pwaPossible()) return;
  PWA.can = true;
  const head = document.head;
  head.appendChild(h('link', { rel: 'manifest', href: 'manifest.webmanifest' }));
  head.appendChild(h('link', { rel: 'apple-touch-icon', href: 'icons/apple-touch-icon.png' }));
  head.appendChild(h('meta', { name: 'theme-color', content: '#12100e' }));
  head.appendChild(h('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }));
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); PWA.prompt = e; });
  window.addEventListener('appinstalled', () => { PWA.prompt = null; toast('Musubi is installed. Open it from the Dock or the app list.'); });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const offer = (w) => {
      PWA.waiting = w;
      toast('A new version of Musubi is ready.', { ms: 15000, action: { label: 'Reload', run: pwaUpdate } });
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing; if (!w) return;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
    setInterval(() => reg.update().catch(() => {}), 6 * 3600 * 1000);
  }).catch((e) => console.warn('Service worker not registered:', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (PWA.waiting && !reloading) { reloading = true; saveCurrent.flush(); location.reload(); } });
}
function pwaUpdate() { saveCurrent.flush(); if (PWA.waiting) PWA.waiting.postMessage('skip-waiting'); else location.reload(); }
async function pwaInstall() {
  if (pwaStandalone()) { toast('Musubi is already running as an installed app.'); return; }
  if (PWA.prompt) { PWA.prompt.prompt(); const r = await PWA.prompt.userChoice.catch(() => null); PWA.prompt = null; if (r && r.outcome === 'accepted') return; return; }
  openSettings('install');
}
function pwaNewWindow() {
  const w = window.open(location.href.split('#')[0].split('?')[0], '_blank', 'noopener');
  if (!w) toast('The browser blocked the new window. In the installed app, use Cmd/Ctrl+N.');
}
/* Dock shortcuts: ?action=new, capture, review */
function pwaLaunchAction() {
  let action = '';
  try { action = new URLSearchParams(location.search).get('action') || ''; } catch (e) { return; }
  if (!action) return;
  try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* sandboxed */ }
  setTimeout(() => {
    if (action === 'new') newNoteDialog();
    else if (action === 'capture') captureDialog();
    else if (action === 'review') openReview();
  }, 300);
}
/* A folder that lost its permission (common after a restart) gets a clear banner, because the browser
   only grants access again after a click. */
function updateFolderBanner() {
  let bar = document.getElementById('folder-banner');
  const need = app.folder && app.folder.status === 'needs-permission';
  if (!need) { if (bar) bar.remove(); return; }
  if (bar) return;
  bar = h('div', { id: 'folder-banner', class: 'folder-banner', role: 'alert' },
    h('span', null, 'Musubi needs your permission to open the folder ', h('b', null, '“' + (app.folder.name || 'vault') + '”'), ' again.'),
    h('button', { class: 'btn btn-sm btn-cta', onclick: async () => { await reconnectFolder(); updateFolderBanner(); } }, 'Allow'),
    h('button', { class: 'link-btn', onclick: () => bar.remove() }, 'Later'));
  const main = document.getElementById('main') || document.body;
  main.insertBefore(bar, main.firstChild);
}
const INSTALL_MD = () => `
Musubi can run as an app on your computer: its own icon in the Dock or taskbar, its own windows, no browser bars, and no network after the first visit.

**Install**

1. Open Musubi in **Chrome, Edge, Brave or Arc** at its web address.
2. Click the install icon at the right end of the address bar, or open the browser menu and choose **Install Musubi** (in Chrome: *Cast, save and share → Install page as app*).
3. To keep it in the Dock on a Mac: right-click its icon while it runs and choose **Options → Keep in Dock**.

**Use**

- **No title bar:** Musubi draws its own top bar where the title bar was. If Chrome still shows a grey title bar, click the small **⌃** button next to Chrome's icons at its right end. The window buttons and Chrome's icons then float over Musubi's bar. The same button brings the title bar back.
- **More windows:** <kbd>⌘ N</kbd> (<kbd>Ctrl N</kbd> on Windows and Linux) in the app, or the command *New window*. All windows share the same vault and stay in step.
- **Folder:** Settings → Data → *Link a folder*. Each note is a Markdown file there. When the browser asks, choose **Allow on every visit**, so the link survives restarts. If it asks again later, click *Allow* in the banner at the top.
- **Dock menu:** right-click the icon for *New note*, *Quick capture* and *Review*.
- **Updates** download by themselves; Musubi offers a reload when one is ready.
- **Uninstall:** in the app, open the menu (⋮ or the app name) and choose *Uninstall Musubi*. Your notes stay in the folder.

Safari can add Musubi to the Dock (*File → Add to Dock*), but Safari cannot open folders, so notes then stay inside Safari.
${PWA.can ? (pwaStandalone() ? '\n*Musubi is running as an installed app now.*' : '') : '\n*This copy runs from a file or inside another page, so it cannot be installed. Open the web address instead.*'}
`;
