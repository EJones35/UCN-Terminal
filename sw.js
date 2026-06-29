const CACHE = "ucn-terminal-v4";

const ASSETS = [
  "/",
  "/index.html",
  "/auth.html",
  "/boot.html",
  "/setup.html",
  "/home.html",
  "/admin.html",
  "/suspended.html",
  "/css/styles.css",
  "/js/app.js",
  "/js/firebase.js",
  "/js/auth.js",
  "/js/boot.js",
  "/js/setup.js",
  "/js/terminal.js",
  "/js/admin.js",
  "/manifest.json"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => clients.claim())
  );
});
