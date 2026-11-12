// MarsL Service Worker - caches game assets for offline play
const CACHE_NAME = 'marsl-v1';
const STATIC_ASSETS = [
  '/',
  '/game.css',
  '/game.js',
  '/fonts.css',
  '/icon.svg',
  '/icon-192.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Cache-first for static assets
  if (request.method === 'GET' && (
    request.url.includes('/game.css') ||
    request.url.includes('/game.js') ||
    request.url.includes('/fonts.css') ||
    request.url.includes('/icon') ||
    request.url.includes('/manifest')
  )) {
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then((fetchResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
  }
  // Network-first for API calls and dynamic content
  else if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
  }
});
