// Offline cache for the QAFRICA import experience.
//
// The page remains the source of truth while online. This worker only adds a
// network fallback: successful import API responses, product images, the logo,
// and visited import HTML documents are kept in the browser so a brief or
// complete connection loss does not turn the catalog into an empty state.

const STATIC_CACHE = 'qafrica-import-static-v2';
const API_CACHE = 'qafrica-import-api-v2';
const IMAGE_CACHE = 'qafrica-import-images-v2';
const PAGE_CACHE = 'qafrica-import-pages-v2';

const MAX_API_ENTRIES = 40;
const MAX_IMAGE_ENTRIES = 150;
const MAX_PAGE_ENTRIES = 12;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      Promise.allSettled([
        cache.add('/qafrica-bag-logo.svg'),
        cache.add('/manifest-import.json'),
      ])
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC_CACHE, API_CACHE, IMAGE_CACHE, PAGE_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('qafrica-import-') && !keep.has(name)).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  while (keys.length > maxEntries) {
    await cache.delete(keys.shift());
  }
}

function isImportApi(url) {
  return url.pathname.includes('/functions/v1/china-import-browse') ||
    url.pathname.includes('/functions/v1/china-import');
}

function isImportPage(url) {
  return url.pathname === '/recommendations' ||
    url.pathname.startsWith('/recommendations/') ||
    url.pathname === '/importations' ||
    url.pathname.startsWith('/importations/');
}

function isImportImageRequest(request, url) {
  if (isImportPage(url) || url.pathname.endsWith('/qafrica-bag-logo.svg')) return true;
  if (!request.referrer) return false;
  try {
    return isImportPage(new URL(request.referrer));
  } catch {
    return false;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API: network first while online, then use the most recent successful
  // response for the exact query when the connection disappears.
  if (isImportApi(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(API_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
          await trimCache(API_CACHE, MAX_API_ENTRIES);
        }
        return response;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        return new Response(JSON.stringify({ products: [], categories: [], hasMore: false, offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    })());
    return;
  }

  // Product/logo images: cache first. A successful online request warms the
  // cache; offline requests can therefore still render the product card.
  if (request.destination === 'image' && isImportImageRequest(request, url)) {
    event.respondWith((async () => {
      const cache = await caches.open(IMAGE_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok || response.type === 'opaque') {
          await cache.put(request, response.clone());
          await trimCache(IMAGE_CACHE, MAX_IMAGE_ENTRIES);
        }
        return response;
      } catch {
        const logo = await caches.match('/qafrica-bag-logo.svg');
        if (logo) return logo;
        return new Response('', { status: 404 });
      }
    })());
    return;
  }

  // Network-first HTML for import routes. This makes an already-visited
  // recommendations/importations route reloadable during an outage.
  if (request.mode === 'navigate' && isImportPage(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(PAGE_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
          await trimCache(PAGE_CACHE, MAX_PAGE_ENTRIES);
        }
        return response;
      } catch {
        const exact = await cache.match(request);
        if (exact) return exact;
        const fallback = await cache.match(new Request('/recommendations')) || await cache.match(new Request('/importations'));
        if (fallback) return fallback;
        return new Response('You are offline. Reconnect once to load QAFRICA Import.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })());
  }
});
