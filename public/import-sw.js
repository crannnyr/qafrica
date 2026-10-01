const SHELL_CACHE = 'qafrica-import-shell-v4';
const IMAGE_CACHE = 'qafrica-import-images-v4';
const API_CACHE = 'qafrica-import-api-v4';
const MAX_IMAGES = 150;
const MAX_API = 80;

function isImportPage(url) {
  return url.pathname === '/recommendations' ||
    url.pathname.startsWith('/recommendations/') ||
    url.pathname === '/importations' ||
    url.pathname.startsWith('/importations/');
}

async function cacheHtmlAndAssets(cache, url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Shell request failed: ${response.status}`);
  await cache.put(url, response.clone());

  const html = await response.clone().text();
  const assetUrls = new Set();
  const attrRe = /(?:src|href)=["']([^"']+)["']/g;
  let match;
  while ((match = attrRe.exec(html))) {
    const value = match[1];
    if (!value || value.startsWith('data:') || value.startsWith('#')) continue;
    try {
      const asset = new URL(value, self.location.origin);
      if (asset.origin === self.location.origin &&
          (/\.(?:js|css|woff2?|ttf|otf)$/i.test(asset.pathname) ||
           asset.pathname.startsWith('/assets/'))) {
        assetUrls.add(asset.href);
      }
    } catch { /* ignore malformed markup */ }
  }

  await Promise.allSettled([...assetUrls].map(async href => {
    const assetResponse = await fetch(href, { cache: 'no-store' });
    if (assetResponse.ok) await cache.put(href, assetResponse.clone());
  }));
}

async function cacheImagesFromProducts(products) {
  if (!Array.isArray(products)) return;
  const imageUrls = [];
  for (const product of products) {
    if (typeof product?.image_url === 'string') imageUrls.push(product.image_url);
    if (Array.isArray(product?.image_urls)) {
      for (const image of product.image_urls) {
        if (typeof image === 'string') imageUrls.push(image);
      }
    }
  }

  const unique = [...new Set(imageUrls)].slice(0, MAX_IMAGES);
  const cache = await caches.open(IMAGE_CACHE);
  await Promise.allSettled(unique.map(async imageUrl => {
    try {
      const response = await fetch(imageUrl, { mode: 'no-cors', cache: 'no-store' });
      if (response.ok || response.type === 'opaque') {
        await cache.put(imageUrl, response.clone());
      }
    } catch { /* individual image failure is harmless */ }
  }));
  await trimImages();
}

async function warmApiUrls(urls) {
  const cache = await caches.open(API_CACHE);
  await Promise.allSettled(urls.map(async value => {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') return;
      const response = await fetch(url.toString(), { cache: 'no-store' });
      if (!(response.ok || response.type === 'opaque')) return;
      await cache.put(url.toString(), response.clone());

      // The catalog response gives us the image URLs needed for the first
      // offline screen, so cache those at the same time.
      try {
        const data = await response.clone().json();
        await cacheImagesFromProducts(data?.products);
      } catch { /* non-JSON endpoint */ }
    } catch { /* best effort; never block app startup */ }
  }));
  await trimApi();
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await Promise.allSettled([
      cacheHtmlAndAssets(shell, new Request('/recommendations')),
      shell.add('/qafrica-bag-logo.svg'),
      shell.add('/manifest-import.json'),
    ]);
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'WARM_IMPORT_CACHE' && Array.isArray(event.data.urls)) {
    event.waitUntil(warmApiUrls(event.data.urls));
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(name => name.startsWith('qafrica-import-') &&
          ![SHELL_CACHE, IMAGE_CACHE, API_CACHE].includes(name))
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

function isImportReferrer(request) {
  if (!request.referrer) return false;
  try { return isImportPage(new URL(request.referrer)); } catch { return false; }
}

function isImportStatic(request, url) {
  return url.origin === self.location.origin &&
    (isImportReferrer(request) || url.pathname.startsWith('/assets/')) &&
    ['script', 'style', 'font', 'manifest'].includes(request.destination);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.pathname.includes('/functions/v1/')) {
    event.respondWith((async () => {
      const cache = await caches.open(API_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok || response.type === 'opaque') {
          await cache.put(request, response.clone());
          await trimApi();
        }
        return response;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        return new Response(JSON.stringify({
          products: [], categories: [], hasMore: false, rates: {}, offline: true,
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    })());
    return;
  }

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

  if (request.destination === 'image' &&
      (isImportPage(url) || isImportReferrer(request))) {
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
        return (await caches.match('/qafrica-bag-logo.svg')) ||
          new Response('', { status: 404 });
      }
    })());
  }
});
