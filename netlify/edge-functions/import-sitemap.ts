// /sitemap-products.xml — every active China import product, generated on request
// so new products are discoverable by Google without waiting for a redeploy.
// Listed in robots.txt next to the static sitemap (see vite.config.ts).
import type { Config } from 'https://edge.netlify.com';

const SUPABASE_URL = 'https://bahiqhpypapvktpxrths.supabase.co';
// Public anon key (same one the web app ships). RLS limits it to active products.
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhaGlxaHB5cGFwdmt0cHhydGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzQ2NzEsImV4cCI6MjA4NzY1MDY3MX0.8UkRnUX39-XR3twjWlaiQlT4OMjyl4ROZlgmGEyjUC4';
const SITE = 'https://qafrica.store';
const PAGE = 1000; // PostgREST returns at most 1000 rows per request
const MAX_URLS = 45000; // sitemap files are capped at 50,000 URLs

type Row = { id: string; updated_at: string | null; image_url: string | null; name: string | null };

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

async function fetchProducts(): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; offset < MAX_URLS; offset += PAGE) {
    const query = new URLSearchParams({
      select: 'id,updated_at,image_url,name',
      is_active: 'eq.true',
      order: 'created_at.desc,id.asc',
      limit: String(PAGE),
      offset: String(offset),
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/china_import_products?${query}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Product list failed (${res.status})`);
    const batch = (await res.json()) as Row[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

export default async () => {
  let rows: Row[];
  try {
    rows = await fetchProducts();
  } catch {
    // Tell crawlers to come back later rather than serving an empty sitemap,
    // which would read as "all products removed".
    return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Retry-After': '600' } });
  }

  const urls = rows.map(r => {
    const lastmod = r.updated_at ? `\n    <lastmod>${esc(new Date(r.updated_at).toISOString())}</lastmod>` : '';
    const image = r.image_url
      ? `\n    <image:image><image:loc>${esc(r.image_url)}</image:loc></image:image>`
      : '';
    return `  <url>\n    <loc>${SITE}/recommendations/${esc(r.id)}</loc>${lastmod}${image}\n  </url>`;
  });

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    `${urls.join('\n')}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // Let Netlify's CDN serve it for an hour instead of hitting the database per crawl.
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
};

export const config: Config = { path: '/sitemap-products.xml' };
