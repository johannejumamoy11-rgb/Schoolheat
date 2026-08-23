// SchoolHeat Service Worker
// Two caching strategies:
//  1. App shell (same-origin files) — cache-first, so the app opens
//     instantly and works fully offline once installed.
//  2. External CDN scripts (Chart.js, Hammer.js, zoom plugin) — network
//     first, falling back to cache. This keeps them up to date when
//     online, while still working offline after at least one successful
//     load has cached them.

const CACHE_VERSION = 'schoolheat-v1';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/script.js',
  './manifest.json',
  './assets/school-logo.png',
  './assets/campus-map.jpg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    // App shell: cache-first, network fallback (and cache anything new)
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          return response;
        }).catch(() => cached);
      })
    );
  } else {
    // External CDN libraries: network-first so updates come through when
    // online, falling back to whatever was cached from a previous visit.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
