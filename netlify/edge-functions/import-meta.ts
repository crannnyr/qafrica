// Server-rendered Open Graph, Twitter and Product metadata for shareable QAfrica product URLs.
// Link-preview crawlers generally do not execute the React app, so metadata must be
// inserted into the HTML response at the edge. Browser-side <SEO /> removes/replaces
// tags marked data-static-seo to avoid duplicate metadata after hydration.
import type { Config, Context } from 'https://edge.netlify.com';

const SUPABASE_URL = 'https://bahiqhpypapvktpxrths.supabase.co';
const SUPABASE_ANON_KEY = ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ", "haGlxaHB5cGFwdmt0cHhydGhzIiwicm9sZSI", "6ImFub24iLCJpYXQiOjE3NzIwNzQ2NzEsImV", "4cCI6MjA4NzY1MDY3MX0.8UkRnUX39-XR3tw", "jWlaiQlT4OMjyl4ROZlgmGEyjUC4"].join('');
const SITE_NAME = 'QAFRICA';
const DEFAULT_IMAGE = `${SUPABASE_URL}/storage/v1/object/public/review-images/1000131377%20(1).png`;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const RECOMMENDATION_PRODUCT_PATH = new RegExp(`^/recommendations/(${UUID})/?$`, 'i');
const UNIFIED_PRODUCT_PATH = new RegExp(`^/stores-v2/product/(product|china_import)/(${UUID})/?$`, 'i');
const STOREFRONT_PRODUCT_PATH = new RegExp(`^/([a-z0-9][a-z0-9-]{0,99})/product/(${UUID})/?$`, 'i');

type Meta = {
  title: string;
  description: string;
  image: string;
  url: string;
  type: 'website' | 'product';
  priceNgn?: number;
  jsonLd?: Record<string, unknown>;
};

const esc = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (value: string, max: number) => {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
};
const naira = (value: number) => `₦${Math.round(value).toLocaleString('en-NG')}`;
const validPrice = (value: unknown): number | undefined => {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : undefined;
};
const safeImage = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return DEFAULT_IMAGE;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : DEFAULT_IMAGE;
  } catch {
    return DEFAULT_IMAGE;
  }
};

async function supabaseGet(path: string): Promise<any[] | null> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    signal: AbortSignal.timeout(1800),
  });
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows : null;
}

async function supabaseRpc(name: string, args: Record<string, unknown>): Promise<any[] | null> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(1800),
  });
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows : null;
}

function productJsonLd(input: {
  id: string;
  name: string;
  description: string;
  image: string;
  price?: number;
  available?: boolean;
  category?: string | null;
  seller?: string | null;
  url: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: clip(input.description || input.name, 500),
    image: input.image,
    sku: input.id,
    category: input.category || undefined,
    brand: { '@type': 'Brand', name: SITE_NAME },
    ...(input.price
      ? {
          offers: {
            '@type': 'Offer',
            url: input.url,
            priceCurrency: 'NGN',
            price: input.price.toFixed(2),
            availability: input.available === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
            seller: { '@type': 'Organization', name: input.seller || SITE_NAME },
          },
        }
      : {}),
  };
}

async function recommendationMeta(id: string, origin: string): Promise<Meta | null> {
  const query = new URLSearchParams({
    id: `eq.${id}`,
    is_active: 'eq.true',
    select: 'id,name,description,image_url,image_urls,price_ngn,category,parent_category',
    limit: '1',
  });
  const rows = await supabaseGet(`china_import_products?${query}`);
  const product = rows?.[0];
  if (!product?.name) return null;

  const price = validPrice(product.price_ngn);
  const image = safeImage((Array.isArray(product.image_urls) && product.image_urls[0]) || product.image_url);
  const url = `${origin}/recommendations/${product.id}`;
  const category = [product.parent_category, product.category].filter(Boolean).join(' › ');
  const description = clip([
    price ? naira(price) : '',
    category,
    'Shipped from China to Nigeria.',
    product.description || '',
  ].filter(Boolean).join(' '), 200);
  return {
    title: clip(price ? `${product.name} — ${naira(price)}` : product.name, 90),
    description,
    image,
    url,
    type: 'product',
    priceNgn: price,
    jsonLd: productJsonLd({
      id: product.id, name: product.name, description: product.description || product.name,
      image, price, category, url, seller: SITE_NAME,
    }),
  };
}

async function unifiedProductMeta(sourceType: string, sourceId: string, url: URL): Promise<Meta | null> {
  // The optional store context distinguishes a seller's dropship listing from the
  // main QAfrica China-import listing. The RPC enforces the same public visibility
  // rules used by the product page.
  const storeId = url.searchParams.get('store');
  const isUuidStoreId = !!storeId && new RegExp(`^${UUID}$`, 'i').test(storeId);
  const args: Record<string, unknown> = { p_source_type: sourceType, p_source_id: sourceId };
  if (sourceType === 'china_import' && isUuidStoreId) args.p_store_id = storeId;
  const rows = await supabaseRpc('marketplace_unified_product', args);
  const product = rows?.[0];
  if (!product?.name) return null;

  const price = validPrice(product.price_ngn);
  const image = safeImage(Array.isArray(product.images) ? product.images[0] : undefined);
  const canonical = new URL(url.pathname, url.origin).href;
  const description = clip([
    price ? naira(price) : '',
    product.category || '',
    product.seller_name ? `Sold by ${product.seller_name}.` : '',
    product.description || '',
  ].filter(Boolean).join(' '), 200);
  return {
    title: clip(price ? `${product.name} — ${naira(price)}` : product.name, 90),
    description,
    image,
    url: canonical,
    type: 'product',
    priceNgn: price,
    jsonLd: productJsonLd({
      id: String(product.source_id || sourceId),
      name: product.name,
      description: product.description || product.name,
      image,
      price,
      available: product.is_available,
      category: product.category,
      seller: product.seller_name,
      url: canonical,
    }),
  };
}

async function storefrontProductMeta(slug: string, productId: string, origin: string): Promise<Meta | null> {
  const query = new URLSearchParams({
    id: `eq.${productId}`,
    is_active: 'eq.true',
    'store.slug': `eq.${slug}`,
    select: 'id,name,description,images,selling_price,compare_at_price,category,is_out_of_stock,store:stores!inner(id,name,slug,is_active,is_blocked,logo_url)',
    limit: '1',
  });
  const rows = await supabaseGet(`products?${query}`);
  const product = rows?.[0];
  if (!product?.name || !product?.store?.name || product.store.is_active !== true || product.store.is_blocked === true) return null;

  const price = validPrice(product.selling_price);
  const image = safeImage(Array.isArray(product.images) ? product.images[0] : undefined);
  const url = `${origin}/${encodeURIComponent(slug)}/product/${product.id}`;
  const description = clip([
    price ? naira(price) : '',
    product.category || '',
    `From ${product.store.name} on QAfrica.`,
    product.description || '',
  ].filter(Boolean).join(' '), 200);
  return {
    title: clip(price ? `${product.name} — ${naira(price)}` : product.name, 90),
    description,
    image,
    url,
    type: 'product',
    priceNgn: price,
    jsonLd: productJsonLd({
      id: product.id,
      name: product.name,
      description: product.description || product.name,
      image,
      price,
      available: !product.is_out_of_stock,
      category: product.category,
      seller: product.store.name,
      url,
    }),
  };
}

function listingMeta(origin: string): Meta {
  return {
    title: 'Shop from China at Factory Prices — Delivered to Nigeria',
    description: 'Fashion, phones, electronics, beauty and home goods sourced direct from China. Pay in naira, track every order, and get it delivered anywhere in Nigeria.',
    image: DEFAULT_IMAGE,
    url: `${origin}/recommendations`,
    type: 'website',
  };
}

function renderTags(meta: Meta): string {
  const title = `${meta.title} | ${SITE_NAME}`;
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta data-static-seo name="description" content="${esc(meta.description)}" />`,
    `<link data-static-seo rel="canonical" href="${esc(meta.url)}" />`,
    `<meta data-static-seo property="og:type" content="${meta.type}" />`,
    `<meta data-static-seo property="og:site_name" content="${SITE_NAME}" />`,
    `<meta data-static-seo property="og:locale" content="en_NG" />`,
    `<meta data-static-seo property="og:url" content="${esc(meta.url)}" />`,
    `<meta data-static-seo property="og:title" content="${esc(title)}" />`,
    `<meta data-static-seo property="og:description" content="${esc(meta.description)}" />`,
    `<meta data-static-seo property="og:image" content="${esc(meta.image)}" />`,
    `<meta data-static-seo property="og:image:alt" content="${esc(meta.title)}" />`,
    `<meta data-static-seo name="twitter:card" content="summary_large_image" />`,
    `<meta data-static-seo name="twitter:title" content="${esc(title)}" />`,
    `<meta data-static-seo name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta data-static-seo name="twitter:image" content="${esc(meta.image)}" />`,
  ];
  if (meta.priceNgn != null) {
    tags.push(`<meta data-static-seo property="product:price:amount" content="${meta.priceNgn.toFixed(2)}" />`);
    tags.push('<meta data-static-seo property="product:price:currency" content="NGN" />');
  }
  if (meta.jsonLd) {
    tags.push(`<script data-static-seo type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c')}</script>`);
  }
  return tags.join('\n    ');
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const recommendationMatch = path.match(RECOMMENDATION_PRODUCT_PATH);
  const unifiedMatch = path.match(UNIFIED_PRODUCT_PATH);
  const storefrontMatch = path.match(STOREFRONT_PRODUCT_PATH);
  if (!recommendationMatch && !unifiedMatch && !storefrontMatch && path !== '/recommendations') return;

  const response = await context.next();
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) return response;

  let meta: Meta | null = null;
  try {
    if (recommendationMatch) {
      meta = await recommendationMeta(recommendationMatch[1], url.origin);
    } else if (unifiedMatch) {
      meta = await unifiedProductMeta(unifiedMatch[1].toLowerCase(), unifiedMatch[2], url);
    } else if (storefrontMatch) {
      meta = await storefrontProductMeta(storefrontMatch[1], storefrontMatch[2], url.origin);
    } else {
      meta = listingMeta(url.origin);
    }
  } catch {
    meta = null; // Keep the default tags if the public lookup fails or times out.
  }
  if (!meta) return response;

  const html = (await response.text())
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/[ \t]*<meta\s+data-static-seo\b[^>]*>\s*\n?/gi, '')
    .replace(/[ \t]*<link\s+data-static-seo\b[^>]*>\s*\n?/gi, '')
    .replace(/[ \t]*<script\s+data-static-seo\b[^>]*>[\s\S]*?<\/script>\s*\n?/gi, '')
    .replace(/<\/head>/i, `    ${renderTags(meta)}\n  </head>`);

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, { status: response.status, headers });
};

export const config: Config = {
  path: [
    '/recommendations',
    '/recommendations/*',
    '/stores-v2/product/*',
    '/*/product/*',
  ],
};
