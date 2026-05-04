/* ANARCHISM.AFRICA - service worker (PWA + offline shell)
 *
 * Caches both the public site and every role page so each can be installed
 * as a standalone app on iOS / Android / Desktop. Strategies:
 *   - Navigation requests (HTML): network-first, fall back to cached shell
 *     for the requested role page if offline; final fallback = /index.html.
 *   - Static assets (CSS/JS/SVG/PNG/fonts): stale-while-revalidate.
 *   - /api/* + POSTs: never intercepted (live-only).
 */
const CACHE = 'aa-shell-v22';   // bump on every shell change

const SHELL = [
  '/',
  '/index.html',
  '/item.html',
  '/admin.html',
  '/publisher.html',
  '/editor.html',
  '/journalist.html',
  '/market.html',
  '/partner.html',
  '/anarchist.html',

  '/css/styles.css',
  '/css/auth-page.css',
  '/css/header-modes.css',
  '/css/intro-popup.css',
  '/css/responsive-fixes.css',
  '/css/menu-behavior.css',
  '/css/logo-generator.css',
  '/css/admin-editor.css',

  '/js/config.js',
  '/js/api.js',
  '/js/ai-chat.js',
  '/js/theme.js',
  '/js/logo.js',
  '/js/app.js',
  '/js/auth.js',
  '/js/tooltips.js',
  '/js/auth-rail.js',
  '/js/chat.js',
  '/js/admin.js',
  '/js/role-shared.js',
  '/js/role-switcher.js',
  '/js/header-modes.js',
  '/js/logo-mark.js',
  '/js/logo-generator.js',
  '/js/menu-behavior.js',
  '/js/intro-popup.js',
  '/js/wishlist.js',
  '/js/live-actions.js',
  '/js/item-page.js',
  '/js/article-lab.js',
  '/js/user-settings.js',
  '/js/pin-gate.js',
  '/js/thumb.js',
  '/js/afro-books.js',
  '/js/beta-popup.js',

  '/manifest.webmanifest',
  '/manifest.admin.webmanifest',
  '/manifest.publisher.webmanifest',
  '/manifest.market.webmanifest',
  '/manifest.partner.webmanifest',
  '/manifest.anarchist.webmanifest',

  '/icons/AAlogo1.svg',
  '/icons/favicon.svg',
  '/icons/favicon.ico',
  '/icons/favicon-16.png',
  '/icons/favicon-32.png',
  '/icons/favicon-48.png',
  '/icons/favicon-180.png',
  '/icons/favicon-192.png',
  '/icons/favicon-512.png',
  '/icons/aa-logo-192.png',
  '/icons/aa-logo-512.png',
  '/icons/aa-logo-192-maskable.png',
  '/icons/aa-logo-512-maskable.png',
  '/icons/icon-admin-192.svg',
  '/icons/icon-admin-512.svg',

  '/data/seed.json',
  '/data/afro-books.json',
  '/data/afro-anarchist-quotes.json',
  '/data/african-languages.json'
];

const OFFLINE_NAV = '/index.html';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(async (c) => {
        await Promise.all(SHELL.map(async (url) => {
          try {
            const r = await fetch(url, { cache: 'no-cache' });
            if (r.ok) await c.put(url, r.clone());
          } catch {}
        }));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;

  // Navigation: network-first with cache fallback
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          if (resp && resp.ok && url.origin === location.origin) {
            const copy = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() => caches.match(e.request).then(c => c || caches.match(OFFLINE_NAV)))
    );
    return;
  }

  // Same-origin static: stale-while-revalidate
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(resp => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          }
          return resp;
        }).catch(() => cached || caches.match(OFFLINE_NAV));
        return cached || fresh;
      })
    );
    return;
  }

  // Cross-origin: cache-first with network fallback
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(resp => {
        if (resp && resp.ok && resp.type !== 'opaque') {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => cached)
    )
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
