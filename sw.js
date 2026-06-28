const CACHE = "ucn-terminal-v1";

const ASSETS = [
  "/",
  "/index.html",
  "/auth.html",
  "/home.html",
  "/css/styles.css"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
