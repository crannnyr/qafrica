// Link previews and search snippets for the China import shop (/recommendations).
//
// WhatsApp, Facebook, X and most link-preview crawlers do not run JavaScript, so
// the tags the React app sets with <SEO /> never reach them. This runs at the
// edge and writes the page's real title, description, image and price into the
// HTML before it is sent. Every tag is marked data-static-seo so the browser-side
// <SEO /> can remove them and take over without leaving duplicates.
import type { Config, Context } from 'https://edge.netlify.com';

const SUPABASE_URL = 'https://bahiqhpypapvktpxrths.supabase.co';
// Public anon key (same one the web app ships in src/lib/config). Row-level
// security only lets it read active import products.
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhaGlxaHB5cGFwdmt0cHhydGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzQ2NzEsImV4cCI6MjA4NzY1MDY3MX0.8UkRnUX39-XR3twjWlaiQlT4OMjyl4ROZlgmGEyjUC4';

const SITE_NAME = 'QAFRICA';
const DEFAULT_IMAGE = `${SUPABASE_URL}/storage/v1/object/public/review-images/1000131377%20(1).png`;
const PRODUCT_PATH = /^\/recommendations\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

type Meta = {
  title: string;
  description: string;
  image: string;
  url: string;
  type: 'website' | 'product';
  priceNgn?: number;
  jsonLd?: Record<string, unknown>;
};

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (v: string, max: number) => {
  const text = v.replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
};
const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;

async function productMeta(id: string, origin: string): Promise<Meta | null> {
  const query = new URLSearchParams({
    id: `eq.${id}`,
    is_active: 'eq.true',
    select: 'id,name,description,image_url,image_urls,price_ngn,category,parent_category',
    limit: '1',
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/china_import_products?${query}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    signal: AbortSignal.timeout(1500),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  const p = Array.isArray(rows) ? rows[0] : null;
  if (!p?.name) return null;

  const price = Number(p.price_ngn);
  const hasPrice = Number.isFinite(price) && price > 0;
  const image = (Array.isArray(p.image_urls) && p.image_urls[0]) || p.image_url || DEFAULT_IMAGE;
  const url = `${origin}/recommendations/${p.id}`;
  const trail = [p.parent_category, p.category].filter(Boolean).join(' › ');
  const lead = [hasPrice ? naira(price) : '', trail, 'Shipped from China to Nigeria'].filter(Boolean).join(' · ');
  const description = clip(`${lead}. ${p.description ?? ''}`, 200);

  return {
    title: clip(hasPrice ? `${p.name} — ${naira(price)}` : p.name, 90),
    description,
    image,
    url,
    type: 'product',
    priceNgn: hasPrice ? price : undefined,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      description: clip(p.description ?? p.name, 500),
      image,
      sku: p.id,
      category: trail || undefined,
      brand: { '@type': 'Brand', name: SITE_NAME },
      ...(hasPrice
        ? {
            offers: {
              '@type': 'Offer',
              url,
              priceCurrency: 'NGN',
              price: price.toFixed(2),
              availability: 'https://schema.org/InStock',
              seller: { '@type': 'Organization', name: SITE_NAME },
            },
          }
        : {}),
    },
  };
}

function listingMeta(origin: string): Meta {
  return {
    title: 'Shop from China at Factory Prices — Delivered to Nigeria',
    description:
      'Fashion, phones, electronics, beauty and home goods sourced direct from China. Pay in naira, track every order, and get it delivered anywhere in Nigeria.',
    image: DEFAULT_IMAGE,
    url: `${origin}/recommendations`,
    type: 'website',
  };
}

function renderTags(m: Meta): string {
  const title = `${m.title} | ${SITE_NAME}`;
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta data-static-seo name="description" content="${esc(m.description)}" />`,
    `<link data-static-seo rel="canonical" href="${esc(m.url)}" />`,
    `<meta data-static-seo property="og:type" content="${m.type}" />`,
    `<meta data-static-seo property="og:site_name" content="${SITE_NAME}" />`,
    `<meta data-static-seo property="og:locale" content="en_NG" />`,
    `<meta data-static-seo property="og:url" content="${esc(m.url)}" />`,
    `<meta data-static-seo property="og:title" content="${esc(title)}" />`,
    `<meta data-static-seo property="og:description" content="${esc(m.description)}" />`,
    `<meta data-static-seo property="og:image" content="${esc(m.image)}" />`,
    `<meta data-static-seo property="og:image:alt" content="${esc(m.title)}" />`,
    `<meta data-static-seo name="twitter:card" content="summary_large_image" />`,
    `<meta data-static-seo name="twitter:title" content="${esc(title)}" />`,
    `<meta data-static-seo name="twitter:description" content="${esc(m.description)}" />`,
    `<meta data-static-seo name="twitter:image" content="${esc(m.image)}" />`,
  ];
  if (m.priceNgn != null) {
    tags.push(`<meta data-static-seo property="product:price:amount" content="${m.priceNgn.toFixed(2)}" />`);
    tags.push(`<meta data-static-seo property="product:price:currency" content="NGN" />`);
  }
  if (m.jsonLd) {
    tags.push(`<script data-static-seo type="application/ld+json">${JSON.stringify(m.jsonLd).replace(/</g, '\\u003c')}</script>`);
  }
  return tags.join('\n    ');
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const productMatch = path.match(PRODUCT_PATH);
  if (!productMatch && path !== '/recommendations') return;

  const response = await context.next();
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) return response;

  let meta: Meta | null = null;
  try {
    meta = productMatch ? await productMeta(productMatch[1], url.origin) : listingMeta(url.origin);
  } catch {
    meta = null; // Lookup failed or timed out: serve the page with its default tags.
  }
  if (!meta) return response;

  const html = (await response.text())
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/[ \t]*<meta\s+data-static-seo\b[^>]*>\s*\n?/gi, '')
    .replace(/<\/head>/i, `    ${renderTags(meta)}\n  </head>`);

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, { status: response.status, headers });
};

export const config: Config = {
  path: ['/recommendations', '/recommendations/*'],
};
