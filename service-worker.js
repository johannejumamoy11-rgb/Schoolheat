try {
  importScripts(
  'https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js'
  );
} catch (error) {
  console.warn('SchoolHeat push notifications require internet access:', error);
}

try {
firebase.initializeApp({
  apiKey: 'AIzaSyDtXhB7VjJof72FgkMC_rC3r-JrxaBs4rs',
  authDomain: 'schoolheat-final.firebaseapp.com',
  projectId: 'schoolheat-final',
  messagingSenderId: '960776018094',
  appId: '1:960776018094:web:2d61dc050347340c86f53f'
});

firebase.messaging().onBackgroundMessage(payload => {
  const notification = payload.notification || {};
  return self.registration.showNotification(notification.title || 'SchoolHeat heat warning', {
    body: notification.body || 'A new heat alert is available.',
    icon: notification.icon || './assets/app-logo.png',
    badge: './assets/app-logo.png',
    tag: 'schoolheat-heat-alert',
    renotify: true,
    data: { url: './' }
  });
});
} catch (error) {
  console.warn('SchoolHeat push notifications require internet access:', error);
}

const CACHE_NAME = 'schoolheat-v145';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './locales.js',
  './script.js',
  './cloud_config.js',
  './forecast.json',
  './manifest.json',
  './manual/index.html',
  './manual/APP_OPERATION_MANUAL-en.md',
  './manual/APP_OPERATION_MANUAL-tl.md',
  './manual/APP_OPERATION_MANUAL-ceb.md',
  './manual/APP_OPERATION_MANUAL-war.md',
  './assets/app-logo.png',
  './assets/mnhs-campus-reference.png',
  './assets/school-bg-mobile.jpg'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(ASSETS.map(asset => {
        const url = new URL(asset, self.registration.scope).href;
        return fetch(url, { cache: 'reload' }).then(response => {
          if (!response.ok) throw new Error(`Cannot cache ${url}: ${response.status}`);
          return cache.put(url, response);
        });
      }))
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => 'focus' in client);
    if (existing) return existing.focus();
    return self.clients.openWindow(event.notification.data?.url || './');
  }));
});

self.addEventListener('fetch', e => {
  const requestUrl = new URL(e.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.endsWith('/forecast.json')) {
    e.respondWith(
      fetch(e.request, { cache: 'reload' }).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(requestUrl.href, copy));
        }
        return response;
      }).catch(() => caches.match(requestUrl.href).then(cached => cached || new Response(
        JSON.stringify({
          schemaVersion: 1,
          status: 'pending',
          horizonMinutes: 60,
          message: 'Offline: the published forecast could not be loaded.'
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(response => {
      if (response) return response;
      return fetch(e.request).catch(() => {
        if (e.request.destination === 'document') {
          return caches.match(new URL('./index.html', self.registration.scope));
        }
      });
    })
  );
});
