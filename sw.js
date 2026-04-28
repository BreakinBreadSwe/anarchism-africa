/* ANARCHISM.AFRICA — service worker (PWA + offline shell) */
const CACHE = 'aa-shell-v1';
const SHELL = [
  '/',
  '/index.html',
  '/admin.html',
  '/css/styles.css',
  '/js/config.js',
  '/js/api.js',
  '/js/ai-chat.js',
  '/js/theme.js',
  '/js/logo.js',
  '/js/app.js',
  '/js/chat.js',
  '/js/admin.js',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/data/seed.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Don't intercept POST or API calls
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  // Network-first for navigation (HTML), cache-first for assets
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        // cache same-origin successful responses
        if (resp.ok && url.origin === location.origin) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
