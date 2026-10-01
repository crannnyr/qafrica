const SHELL_CACHE = 'qafrica-import-shell-v3';
const IMAGE_CACHE = 'qafrica-import-images-v3';
const API_CACHE = 'qafrica-import-api-v3';
const MAX_IMAGES = 150;
const MAX_API = 60;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => Promise.allSettled([
      cache.add('/recommendations'),
      cache.add('/qafrica-bag-logo.svg'),
      cache.add('/manifest-import.json'),
    ]))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(name => name.startsWith('qafrica-import-') && ![SHELL_CACHE, IMAGE_CACHE, API_CACHE].includes(name))
        .map(name => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

async function trimImages() {
  const cache = await caches.open(IMAGE_CACHE);
  const keys = await cache.keys();
  while (keys.length > MAX_IMAGES) await cache.delete(keys.shift());
}

async function trimApi() {
  const cache = await caches.open(API_CACHE);
  const keys = await cache.keys();
  while (keys.length > MAX_API) await cache.delete(keys.shift());
}

function isImportPage(url) {
  return url.pathname === '/recommendations' ||
    url.pathname.startsWith('/recommendations/') ||
    url.pathname === '/importations' ||
    url.pathname.startsWith('/importations/');
}

function isImportReferrer(request) {
  if (!request.referrer) return false;
  try { return isImportPage(new URL(request.referrer)); } catch { return false; }
}

function isImportStatic(request, url) {
  return url.origin === self.location.origin &&
    isImportReferrer(request) &&
    ['script', 'style', 'font', 'manifest'].includes(request.destination);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Catalog/rates/search API: network first while online, exact-response
  // fallback offline. This never controls application navigation.
  if (url.pathname.includes('/functions/v1/')) {
    event.respondWith((async () => {
      const cache = await caches.open(API_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
          await trimApi();
        }
        return response;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        return new Response(JSON.stringify({
          products: [],
          categories: [],
          hasMore: false,
          rates: {},
          offline: true,
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    })());
    return;
  }

  // Import navigation: fresh when online, cached app shell when offline.
  if (request.mode === 'navigate' && isImportPage(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        const exact = await cache.match(request);
        return exact || await cache.match('/recommendations') ||
          new Response('QAFRICA Import is offline. Reconnect once to load the app.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
      }
    })());
    return;
  }

  // Cache the actual Vite JS/CSS/fonts used by the import page. This is what
  // prevents cached HTML from reopening into a white screen.
  if (isImportStatic(request, url)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || new Response('', { status: 503 });
      }
    })());
    return;
  }

  // Product images: cache them while they are requested from the import page.
  if (request.destination === 'image' && (isImportPage(url) || isImportReferrer(request))) {
    event.respondWith((async () => {
      const cache = await caches.open(IMAGE_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok || response.type === 'opaque') {
          await cache.put(request, response.clone());
          await trimImages();
        }
        return response;
      } catch {
        return (await caches.match('/qafrica-bag-logo.svg')) || new Response('', { status: 404 });
      }
    })());
  }
});
