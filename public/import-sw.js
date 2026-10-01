// Minimal service worker — exists to satisfy PWA installability criteria for
// the import experience. Intentionally does not cache anything yet; it's a
// pass-through so the app always serves fresh content while still qualifying
// as an installable app on Android/desktop Chrome.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
