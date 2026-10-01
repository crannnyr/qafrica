const SHELL_CACHE = 'qafrica-import-shell-v5';
const IMAGE_CACHE = 'qafrica-import-images-v5';
const API_CACHE = 'qafrica-import-api-v5';
const MAX_IMAGES = 150;
const MAX_API = 80;

function isImportPage(url) { return url.pathname === '/recommendations' || url.pathname.startsWith('/recommendations/') || url.pathname === '/importations' || url.pathname.startsWith('/importations/'); }
function isImportReferrer(request) { if (!request.referrer) return false; try { return isImportPage(new URL(request.referrer)); } catch { return false; } }
function isImportStatic(request, url) { return url.origin === self.location.origin && (isImportReferrer(request) || url.pathname.startsWith('/assets/')) && ['script', 'style', 'font', 'manifest'].includes(request.destination); }
async function trim(cacheName, max) { const cache = await caches.open(cacheName); const keys = await cache.keys(); while (keys.length > max) await cache.delete(keys.shift()); }

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => Promise.allSettled([cache.add('/qafrica-bag-logo.svg'), cache.add('/manifest-import.json')])));
});
self.addEventListener('activate', event => { event.waitUntil((async () => { const names = await caches.keys(); await Promise.all(names.filter(name => name.startsWith('qafrica-import-') && ![SHELL_CACHE, IMAGE_CACHE, API_CACHE].includes(name)).map(name => caches.delete(name))); await self.clients.claim(); })()); });

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.pathname.includes('/functions/v1/')) {
    event.respondWith((async () => {
      const cache = await caches.open(API_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok || response.type === 'opaque') event.waitUntil((async () => { try { await cache.put(request, response.clone()); await trim(API_CACHE, MAX_API); } catch {} })());
        return response;
      } catch { return await cache.match(request) || new Response(JSON.stringify({ products: [], categories: [], hasMore: false, rates: {}, offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } }); }
    })());
    return;
  }

  if (request.mode === 'navigate' && isImportPage(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try { const response = await fetch(request); if (response.ok) event.waitUntil((async () => { try { await cache.put(request, response.clone()); } catch {} })()); return response; }
      catch { return await cache.match(request) || await cache.match('/recommendations') || new Response('QAFRICA Import is offline. Reconnect once to load the app.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
    })());
    return;
  }

  if (isImportStatic(request, url)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE); const cached = await cache.match(request); if (cached) return cached;
      try { const response = await fetch(request); if (response.ok) event.waitUntil((async () => { try { await cache.put(request, response.clone()); } catch {} })()); return response; }
      catch { return await cache.match(request) || new Response('', { status: 503 }); }
    })());
    return;
  }

  if (request.destination === 'image' && (isImportPage(url) || isImportReferrer(request))) {
    event.respondWith((async () => {
      const cache = await caches.open(IMAGE_CACHE); const cached = await cache.match(request); if (cached) return cached;
      try { const response = await fetch(request); if (response.ok || response.type === 'opaque') event.waitUntil((async () => { try { await cache.put(request, response.clone()); await trim(IMAGE_CACHE, MAX_IMAGES); } catch {} })()); return response; }
      catch { return await caches.match('/qafrica-bag-logo.svg') || new Response('', { status: 404 }); }
    })());
  }
});
