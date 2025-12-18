
const CACHE_NAME = 'talkie-rj-v11'; // Incrementamos versión a v11

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Forzar activación inmediata
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Borrar todo caché viejo que no coincida
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Tomar control inmediatamente
  );
});

self.addEventListener('fetch', (event) => {
  // Estrategia: Network First, fallback to Cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
