// Minimal service worker for the import experience.
//
// Do not intercept navigation or asset requests here. The import experience
// must continue to use the browser/Netlify network path directly, including
// public share URLs such as /importations/sourcing/<token>. A pass-through
// fetch handler can surface browser-level "FetchEvent.respondWith ... Load
// failed" errors when the underlying navigation request is interrupted.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
