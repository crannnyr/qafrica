// This file mirrors what is deployed (china-import-browse v33, 2026-10-04).
// The previous copy in git had drifted from production (it carried a rotation
// seed + in-memory cache that were never deployed and lacked the live search
// code); it is in git history if those are wanted back.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const PRODUCT_COLUMNS = "id, name, description, image_url, image_urls, price_cny, price_ngn, price_usd, category, parent_category, moq, has_variants, variants, delivery_time, ship_only, sort_order, units_sold, is_trending, trending_order, created_at, volume_cbm, weight_grams, sea_shipping_cost_ngn, flight_shipping_cost_ngn";
// Single-product / cart lookups also need the express flag shown on the product page.
const PRODUCT_DETAIL_COLUMNS = PRODUCT_COLUMNS + ", express_air_cargo";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } }); }

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const url = new URL(req.url); const action = url.searchParams.get("action");
  try {
    if (req.method === "GET" && action === "browse-products") {
      const parent = url.searchParams.get("parent"); const subcategory = url.searchParams.get("subcategory");
      const search = url.searchParams.get("search")?.trim() ?? ""; const sort = url.searchParams.get("sort") ?? "default";
      const priceMax = url.searchParams.get("price_max"); const excludeId = url.searchParams.get("exclude_id");
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 50);
      const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

      if (search) {
        // Ranked, typo-tolerant search over product name, subcategory and category.
        // Runs and paginates in the database (see search_china_import_products).
        const { data, error } = await supabase.rpc("search_china_import_products", {
          p_query: search.slice(0, 120),
          p_parent: parent && parent !== "All" ? parent : null,
          p_category: subcategory && subcategory !== "All" ? subcategory : null,
          p_price_max: priceMax && Number.isFinite(Number(priceMax)) ? Number(priceMax) : null,
          p_exclude: excludeId && UUID.test(excludeId) ? excludeId : null,
          p_limit: limit,
          p_offset: offset,
        });
        if (error) return json({ error: error.message, products: [] }, 500);
        const products = data?.products ?? []; const total = Number(data?.total ?? 0);
        return json({ products, total, hasMore: offset + products.length < total, corrected: data?.corrected ?? null });
      }

      let base = supabase.from("china_import_products").select(PRODUCT_COLUMNS, { count: "exact" }).eq("is_active", true);
      if (parent && parent !== "All") base = base.eq("parent_category", parent);
      if (subcategory && subcategory !== "All") base = base.eq("category", subcategory);
      if (priceMax) base = base.lte("price_ngn", Number(priceMax));
      if (excludeId) base = base.neq("id", excludeId);

      if (sort === "trending") base = base.eq("is_trending", true).order("trending_order", { ascending: true });
      else if (sort === "new") base = base.order("created_at", { ascending: false });
      else if (sort === "oldest") base = base.order("created_at", { ascending: true });
      else base = base.order("sort_order", { ascending: true }).order("created_at", { ascending: false });

      const { data, error, count } = await base.range(offset, offset + limit - 1);
      if (error) return json({ error: error.message, products: [] }, 500);
      const products = data ?? []; const total = count ?? products.length;
      return json({ products, total, hasMore: offset + products.length < total });
    }

    // One product by id (product page), or several by ids (cart re-pricing),
    // so neither has to download the whole catalogue.
    if (req.method === "GET" && action === "product") {
      const id = url.searchParams.get("id");
      const ids = (url.searchParams.get("ids") ?? "").split(",").map((v) => v.trim()).filter((v) => UUID.test(v)).slice(0, 100);
      if (id) {
        if (!UUID.test(id)) return json({ error: "Invalid product id", product: null }, 400);
        const { data, error } = await supabase.from("china_import_products").select(PRODUCT_DETAIL_COLUMNS).eq("id", id).eq("is_active", true).maybeSingle();
        if (error) return json({ error: error.message, product: null }, 500);
        if (!data) return json({ error: "Product not found", product: null }, 404);
        return json({ product: data });
      }
      if (ids.length === 0) return json({ products: [] });
      const { data, error } = await supabase.from("china_import_products").select(PRODUCT_DETAIL_COLUMNS).in("id", ids).eq("is_active", true);
      if (error) return json({ error: error.message, products: [] }, 500);
      return json({ products: data ?? [] });
    }

    if (req.method === "GET" && action === "categories") {
      const { data, error } = await supabase.from("china_import_products").select("parent_category, category").eq("is_active", true);
      if (error) return json({ error: error.message, categories: [] }, 500);
      const map = new Map<string, Set<string>>();
      for (const row of data ?? []) {
        const parent = row.parent_category ?? "Other"; const category = row.category;
        if (!category) continue; if (!map.has(parent)) map.set(parent, new Set()); map.get(parent)!.add(category);
      }
      const categories = Array.from(map.entries()).map(([parent, set]) => ({ parent, subcategories: Array.from(set).sort() })).sort((a,b) => a.parent.localeCompare(b.parent));
      return json({ categories });
    }
    return json({ error: `Unknown action: ${action ?? "(none)"}` }, 400);
  } catch (err) { return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500); }
});
