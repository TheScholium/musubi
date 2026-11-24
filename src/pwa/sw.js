/* Musubi service worker: keeps the app available offline. The page is one HTML file,
   so the cache holds only that file, the manifest and the icons. A new build changes VERSION,
   the browser installs the new worker, and the page offers a reload. */
const VERSION = '__VERSION__';
const CACHE = 'musubi-' + VERSION;
const ASSETS = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('musubi-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', (e) => { if (e.data === 'skip-waiting') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // the app is one page: every navigation inside the scope gets it, with or without ?action=
    e.respondWith(caches.open(CACHE).then(async (c) => (await c.match('./')) || fetch(req)));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(req, { ignoreSearch: true })) || fetch(req)));
});
