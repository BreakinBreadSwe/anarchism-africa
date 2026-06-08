/* BREAKIN BREAD — Free Cinema · service worker (PWA + offline shell)
 *
 * Strategy:
 *   - Navigation (HTML): network-first → cached shell when offline.
 *   - Same-origin static (css/js/json/svg): stale-while-revalidate.
 *   - archive.org thumbnails: cache-first (so browsed posters survive offline).
 *   - archive.org /embed/ player iframes are never cached (live streaming only).
 */
const CACHE = "bb-shell-v1";
const SCOPE = new URL(self.registration.scope).pathname; // e.g. /breakinbread/

const SHELL = [
  "",
  "index.html",
  "css/app.css",
  "js/catalog.js",
  "js/app.js",
  "manifest.webmanifest",
  "icons/favicon.svg"
].map(p => SCOPE + p);

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map(async url => {
      try { const r = await fetch(url, { cache: "no-cache" }); if (r.ok) await c.put(url, r.clone()); } catch {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // never intercept the streaming player
  if (url.hostname.endsWith("archive.org") && url.pathname.startsWith("/embed/")) return;

  // navigation: network-first, fall back to cached shell
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() => caches.match(req).then(c => c || caches.match(SCOPE + "index.html")))
    );
    return;
  }

  // archive.org thumbnails: cache-first
  if (url.hostname.endsWith("archive.org") && url.pathname.startsWith("/services/img/")) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(r => {
        if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
        return r;
      }).catch(() => cached))
    );
    return;
  }

  // same-origin static: stale-while-revalidate
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(cached => {
        const fresh = fetch(req).then(r => {
          if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
          return r;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
  }
});

self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });
