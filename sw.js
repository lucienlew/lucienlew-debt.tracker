/* Debt Tracker — offline app shell.
   Bump CACHE_VERSION any time index.html (or this file) changes and is redeployed.
   That's what makes the browser see a byte-diff in sw.js, install the new worker,
   and fire the "Update ready" toast already wired up in index.html — until then,
   everyone keeps getting the exact cached version below, even with no network at all. */
const CACHE_VERSION = "v1";
const CACHE_NAME = `debt-tracker-${CACHE_VERSION}`;

const SHELL_URLS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-192-maskable.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      /* addAll fails the whole install if even one URL 404s — safer than a half-cached shell. */
      cache.addAll(SHELL_URLS)
    )
    /* No skipWaiting(): the new worker parks in "installed" while the old one keeps
       serving open tabs, matching the "Update ready — reopen the app to apply" toast. */
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Cache-first for everything in scope, so the app opens instantly with zero network —
   airplane mode, dead signal, whatever. A cache miss still tries the network (harmless
   no-op offline), and a failed navigation falls back to the cached shell itself, so a
   hard refresh or deep link while offline boots the app instead of the browser's own
   offline page. */
self.addEventListener("fetch", event => {
  const req = event.request;
  if(req.method !== "GET") return;

  event.respondWith(
    caches.match(req, {ignoreSearch:true}).then(cached => {
      if(cached) return cached;
      return fetch(req)
        .then(res => {
          if(res && res.ok && req.url.startsWith(self.location.origin)){
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          if(req.mode === "navigate") return caches.match("./index.html");
        });
    })
  );
});
