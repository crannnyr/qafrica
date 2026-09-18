/**
 * china-import-browse
 *
 * Sustainable, server-side product browsing for the import catalog:
 * pagination, tokenized+synonym search, and parent/subcategory filtering.
 * Deliberately kept separate from the main `china-import` function so
 * this can be built and iterated on with zero risk to checkout, orders,
 * payments, or admin flows living there.
 *
 * GET ?action=browse-products
 *   query params: parent, subcategory, search, sort (default|trending|new),
 *                 price_max, exclude_id, limit (default 20, max 50), offset,
 *                 seed (optional — pins a browsing session to one rotation)
 * GET ?action=categories
 *   returns the parent -> [subcategories] taxonomy, derived live from data.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
function jsonCached(body: unknown, maxAgeSeconds: number) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 4}` },
  })
}

const memoryCache = new Map<string, { data: unknown; expires: number }>()
function cacheGet<T>(key: string): T | null {
  const hit = memoryCache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expires) { memoryCache.delete(key); return null }
  return hit.data as T
}
function cacheSet(key: string, data: unknown, ttlMs: number) {
  memoryCache.set(key, { data, expires: Date.now() + ttlMs })
}

// ── Deterministic rotation ───────────────────────────────────────────────────
// The catalogue is re-ordered every 4 hours so every product gets time near the
// top, and products from the same category are spread apart so a shoe never
// sits beside another shoe.
//
// Why a SEEDED order rather than random: the grid is paginated with infinite
// scroll. A genuinely random order would mean page 2 is drawn from a different
// shuffle than page 1, so a customer sees some products twice and others never
// at all. A seed makes the order deterministic -- the same for every visitor in
// the same 4-hour window, stable across pages, reproducible for support, and
// safe to cache.
//
// Why not ORDER BY random() in SQL: it forces a full scan and sort on every
// request, returns something different each time, and defeats every cache.
const ROTATION_MS = 4 * 60 * 60 * 1000

function currentSeed(): number {
  return Math.floor(Date.now() / ROTATION_MS)
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Mixes the product id into the seed so a product's position depends on both,
// not on where it happened to sit in the source array.
function hashId(id: string, seed: number): number {
  let h = (seed >>> 0) ^ 0x9E3779B9
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 2654435761) >>> 0
  }
  return h >>> 0
}

function seededOrder<T extends { id: string }>(items: T[], seed: number): T[] {
  return [...items].sort((a, b) => hashId(a.id, seed) - hashId(b.id, seed))
}

// Spreads categories apart by always emitting from whichever category has the
// most items left, never twice in a row while an alternative exists.
//
// Exact when no category exceeds half the catalogue. The largest here is
// Clothing at ~31%, so zero same-category neighbours is achievable. If a
// category ever did exceed half, the tail would unavoidably repeat -- this
// degrades gracefully rather than failing.
function spreadCategories<T extends { category?: string | null }>(items: T[]): T[] {
  const buckets = new Map<string, T[]>()
  for (const item of items) {
    const key = item.category ?? 'Uncategorised'
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(item)
  }
  if (buckets.size <= 1) return items

  const out: T[] = []
  let last: string | null = null

  while (out.length < items.length) {
    let pick: string | null = null
    for (const [key, arr] of buckets) {
      if (arr.length === 0 || key === last) continue
      if (pick === null || arr.length > buckets.get(pick)!.length) pick = key
    }
    // Only the just-used category has anything left; repeating beats dropping.
    if (pick === null) {
      for (const [key, arr] of buckets) { if (arr.length) { pick = key; break } }
    }
    if (pick === null) break
    out.push(buckets.get(pick)!.shift()!)
    last = pick
  }
  return out
}

const PRODUCT_COLUMNS = 'id, name, description, image_url, image_urls, price_cny, price_ngn, price_usd, category, parent_category, moq, has_variants, variants, delivery_time, ship_only, volume_cbm, weight_grams, sea_shipping_cost_ngn, flight_shipping_cost_ngn, sort_order, units_sold, is_trending, trending_order, created_at'

const SYNONYMS: Record<string, string[]> = {
  phone: ['iphone', 'smartphone', 'android', 'cellphone', 'mobile'],
  iphone: ['phone', 'apple'],
  shoe: ['shoes', 'sneaker', 'sneakers', 'footwear'],
  sneaker: ['sneakers', 'shoe', 'shoes', 'footwear'],
  bag: ['bags', 'backpack', 'handbag', 'purse'],
  watch: ['watches', 'wristwatch', 'smartwatch'],
  earphone: ['earphones', 'earbuds', 'headset', 'headphone', 'headphones', 'audio'],
  headphone: ['headphones', 'earphone', 'earbuds', 'headset', 'audio'],
  charger: ['charging', 'adapter', 'power bank', 'powerbank'],
  charging: ['charger', 'adapter', 'power'],
  fan: ['cooling', 'ventilation'],
  trouser: ['trousers', 'pants', 'joggers'],
  pant: ['pants', 'trouser', 'trousers', 'joggers'],
  top: ['shirt', 'tshirt', 't-shirt', 'tee', 'blouse'],
  shirt: ['top', 'tshirt', 't-shirt', 'tee'],
  polo: ['shirt', 'top'],
  slipper: ['slippers', 'sandal', 'sandals', 'flip-flop', 'flip-flops'],
  sandal: ['sandals', 'slipper', 'slippers'],
  case: ['cover', 'protective case'],
  cream: ['lotion', 'moisturizer', 'skincare'],
  female: ['women', "women's", 'woman', 'lady', 'ladies', 'girl', 'girls'],
  girl: ['girls', 'women', "women's", 'female', 'lady', 'ladies'],
  girls: ['girl', 'women', "women's", 'female', 'lady', 'ladies'],
  lady: ['ladies', 'women', "women's", 'female', 'woman'],
  ladies: ['lady', 'women', "women's", 'female', 'woman'],
  woman: ['women', "women's", 'female', 'lady', 'ladies'],
  women: ['woman', "women's", 'female', 'lady', 'ladies', 'girl', 'girls'],
  male: ['men', "men's", 'man', 'boy', 'boys'],
  boy: ['boys', 'men', "men's", 'male'],
  boys: ['boy', 'men', "men's", 'male'],
  man: ['men', "men's", 'male'],
  men: ['man', "men's", 'male', 'boy', 'boys'],
}

function escapeIlike(s: string) {
  return s.replace(/[%_]/g, m => `\\${m}`)
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  try {
    if (req.method === 'GET' && action === 'browse-products') {
      const parent = url.searchParams.get('parent')
      const subcategory = url.searchParams.get('subcategory')
      const search = url.searchParams.get('search')
      const sort = url.searchParams.get('sort') || 'default'
      const priceMax = url.searchParams.get('price_max')
      const excludeId = url.searchParams.get('exclude_id')
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 50)
      const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)

      const hasSearch = !!(search && search.trim())

      // Rotation applies to ordinary browsing only.
      //
      // Search is excluded on purpose: when someone types "sneaker" they want
      // the best matches, not a fair rotation. Explicit sorts (trending, new,
      // oldest) are excluded because the order IS the point of those views.
      const rotate = sort === 'default' && !hasSearch

      if (rotate) {
        // The seed can be pinned by the client so an infinite-scroll session
        // stays on one rotation. Without this, a customer scrolling across a
        // 4-hour boundary would get page 3 from a different order than page 1
        // and see duplicates.
        const seedParam = Number(url.searchParams.get('seed'))
        const seed = Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : currentSeed()

        const cacheKey = `ordered:${parent ?? ''}:${subcategory ?? ''}:${priceMax ?? ''}:${excludeId ?? ''}:${seed}`
        let ordered = cacheGet<any[]>(cacheKey)

        if (!ordered) {
          // Ordering has to happen across the whole filtered set BEFORE
          // pagination -- shuffling within a page of 20 would leave every
          // category still clustered on the same pages.
          let q = supabase
            .from('china_import_products')
            .select(PRODUCT_COLUMNS)
            .eq('is_active', true)

          if (parent && parent !== 'All') q = q.eq('parent_category', parent)
          if (subcategory && subcategory !== 'All') q = q.eq('category', subcategory)
          if (priceMax) q = q.lte('price_ngn', Number(priceMax))
          if (excludeId) q = q.neq('id', excludeId)

          const { data, error } = await q.limit(2000)
          if (error) return json({ error: error.message, products: [] }, 500)

          ordered = spreadCategories(seededOrder(data ?? [], seed))

          // Held for 5 minutes rather than the whole 4-hour window so newly
          // added or deactivated products appear reasonably quickly. One query
          // per filter per 5 minutes against ~300 rows is negligible.
          cacheSet(cacheKey, ordered, 5 * 60_000)
        }

        const total = ordered.length
        const page = ordered.slice(offset, offset + limit)
        return jsonCached({
          products: page,
          total,
          hasMore: offset + page.length < total,
          seed,
        }, 60)
      }

      let query = supabase
        .from('china_import_products')
        .select(PRODUCT_COLUMNS, { count: 'exact' })
        .eq('is_active', true)

      if (parent && parent !== 'All') query = query.eq('parent_category', parent)
      if (subcategory && subcategory !== 'All') query = query.eq('category', subcategory)
      if (priceMax) query = query.lte('price_ngn', Number(priceMax))
      if (excludeId) query = query.neq('id', excludeId)

      if (hasSearch) {
        const tokens = search!.trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6)
        for (const token of tokens) {
          const alts = Array.from(new Set([token, ...(SYNONYMS[token] ?? [])]))
          const orParts: string[] = []
          for (const alt of alts) {
            const escaped = escapeIlike(alt)
            orParts.push(`name.ilike.%${escaped}%`)
            orParts.push(`description.ilike.%${escaped}%`)
            orParts.push(`category.ilike.%${escaped}%`)
          }
          query = query.or(orParts.join(','))
        }
      }

      if (sort === 'trending') query = query.eq('is_trending', true).order('trending_order', { ascending: true })
      else if (sort === 'new') query = query.order('created_at', { ascending: false })
      else if (sort === 'oldest') query = query.order('created_at', { ascending: true })
      else query = query.order('sort_order', { ascending: true }).order('created_at', { ascending: false })

      query = query.range(offset, offset + limit - 1)

      const { data, error, count } = await query
      if (error) return json({ error: error.message, products: [] }, 500)

      const total = count ?? 0
      return jsonCached({
        products: data ?? [],
        total,
        hasMore: offset + (data?.length ?? 0) < total,
      }, 20)
    }

    if (req.method === 'GET' && action === 'categories') {
      const cached = cacheGet<unknown>('categories')
      if (cached) return jsonCached(cached, 300)

      const { data, error } = await supabase
        .from('china_import_products')
        .select('parent_category, category')
        .eq('is_active', true)
      if (error) return json({ error: error.message, categories: [] }, 500)

      const order = ['Fashion', 'Electronics', 'Power & Charging', 'Home & Living', 'Beauty', 'Other']
      const map = new Map<string, Set<string>>()
      for (const row of data ?? []) {
        const p = (row as any).parent_category ?? 'Other'
        const c = (row as any).category
        if (!c) continue
        if (!map.has(p)) map.set(p, new Set())
        map.get(p)!.add(c)
      }
      const categories = Array.from(map.entries())
        .map(([parent, subs]) => ({ parent, subcategories: Array.from(subs).sort() }))
        .sort((a, b) => {
          const ai = order.indexOf(a.parent); const bi = order.indexOf(b.parent)
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
        })

      const body = { categories }
      cacheSet('categories', body, 300_000)
      return jsonCached(body, 300)
    }

    return json({ error: `Unknown action: ${action ?? '(none)'}` }, 400)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[china-import-browse]', message)
    return json({ error: message }, 500)
  }
})
