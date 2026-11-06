// Service worker.
//
// It stays deliberately hands-off for HTML and API/JSON: those requests are
// NEVER intercepted or cached, so a stale page shell can never be served and
// live data is always fresh (this is why the old logout/stale-shell bugs stay
// fixed). On activation it purges every OLD shell cache.
//
// The ONE thing it now caches is immutable, content-addressed IMAGES — avatars,
// room pictures, business/reel images. Their URLs carry a content hash
// (`?v=<sha1>`), so the URL only changes when the bytes change; a cache-first
// strategy therefore can never go stale. This survives the browser's aggressive
// HTTP-cache eviction on mobile, so profile photos & pictures are downloaded
// ONCE instead of being re-fetched after every app restart / memory purge — the
// single biggest saving for the "profile photos re-downloaded" data usage.
const CACHE = "lotus-v460";        // page-shell marker (purged each version)
const IMG_CACHE = "lotus-img-v1";  // persistent image cache (kept across versions)

// Only these content-hashed, immutable image routes are cached. Never HTML/JSON,
// never /api/media (audio/video uses Range requests), never private files.
const IMG_PREFIXES = [
  "/api/avatar/",
  "/api/room-image/",
  "/api/business-image/",
  "/api/business-post-image/",
  "/api/business-product-image/",
  "/api/business-media-image/",
  "/api/reel-thumb/",
];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Delete every OLD cache except the persistent image cache, so a stale page
      // shell that points at deleted JS can never be served again.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== IMG_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never touch POST/PATCH/etc.
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return; // same-origin only
  const isImg = IMG_PREFIXES.some((p) => url.pathname.startsWith(p));
  if (!isImg) return; // everything else (HTML, JSON, media, static) → network as normal

  // Cache-first for immutable, content-hashed images.
  event.respondWith(
    (async () => {
      const cache = await caches.open(IMG_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        // Only cache a full, successful image response.
        if (res && res.status === 200 && res.type === "basic") {
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      } catch {
        // Offline and not cached — let the browser show its normal broken-image.
        return fetch(req);
      }
    })()
  );
});
