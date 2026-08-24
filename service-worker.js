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
      // For CDN resources, try matching by URL only (ignoring request mode differences)
      const url = event.request.url;
      if (url.startsWith('https://cdn.jsdelivr.net/')) {
        return caches.match(url).then((cached) => {
          if (cached) return cached;
          return fetch(event.request);
        });
      }
      return fetch(event.request);
    }).catch(() => {
      // Network failed - try cache one more time as fallback
      return caches.match(event.request);
    })
  );
});
