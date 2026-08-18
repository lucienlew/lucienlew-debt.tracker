/* Debt Tracker service worker.
   Bump CACHE on every release — the name is the only cache-busting mechanism here.
   Nothing user-generated is cached: the ledger lives in IndexedDB, not in the Cache API. */
const CACHE = "debt-tracker-v4";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

/* Precache tolerantly: one missing icon must not fail the whole install. */
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map(url =>
      cache.add(new Request(url, {cache:"reload"})).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

/* Drop every cache from an older version, then take over open tabs. */
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n)));
    if(self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if(event.data === "SKIP_WAITING") self.skipWaiting();
});

/* Navigations: network first, so a deployed update is picked up on the next launch,
   falling back to the cached shell when offline.
   Assets: cache first for instant paint, refreshed quietly in the background. */
self.addEventListener("fetch", event => {
  const req = event.request;
  if(req.method !== "GET") return;

  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;

  if(req.mode === "navigate"){
    event.respondWith((async () => {
      try{
        const preload = await event.preloadResponse;
        const res = preload || await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put("./index.html", res.clone());
        return res;
      }catch(e){
        return (await caches.match("./index.html")) || (await caches.match("./")) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    const network = fetch(req).then(res => {
      if(res && res.ok && res.type === "basic"){
        caches.open(CACHE).then(c => c.put(req, res.clone()));
      }
      return res;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
