const CACHE_VERSION = 'schoolheat-v5';
const CACHE_NAME = `${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  'css/style.css',
  'js/script.js',
  'manifest.json',
  'assets/school-logo.png',
  'assets/campus-map.jpg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-192-maskable.png',
  'icons/icon-512-maskable.png'
];

// FIX: Cache CDN dependencies for offline use
const CDN_RESOURCES = [
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/hammerjs@2.0.8',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Cache local app shell
        const localCache = cache.addAll(APP_SHELL);
        // Cache CDN resources with CORS mode
        const cdnCache = Promise.all(
          CDN_RESOURCES.map(url =>
            fetch(url, { mode: 'cors' })
              .then(response => {
                if (response.ok) {
                  return cache.put(url, response);
                }
                console.warn('Failed to cache CDN resource:', url);
              })
              .catch(err => {
                console.warn('CDN cache failed for', url, err);
              })
          )
        );
        return Promise.all([localCache, cdnCache]);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      // FIX: Also try matching CDN URLs that might have different request modes
      return fetch(event.request).catch(() => {
        // If network fails and we have a cached version with different URL format, try that
        return caches.match(event.request.url);
      });
    })
  );
});
