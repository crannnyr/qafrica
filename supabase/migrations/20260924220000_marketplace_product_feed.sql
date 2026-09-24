-- Applied live via apply_migration on 2026-09-24 (names: marketplace_product_feed,
-- marketplace_categories_with_niches). Verified as anon: 6 stores, first 12 items span all 6 stores,
-- search and deals work. See the live function definitions for the exact SQL:
--   public.marketplace_store_ids(), public.marketplace_products(...), public.marketplace_categories()
-- Marketplace product feed for /stores (SHEIN-style, products from all qualifying stores mixed).
-- Only original products (resold copies live in import_catalog, so each product appears once).
-- Sold counts and ratings are computed from real paid orders and approved reviews.

-- Single source of truth for which stores may appear in the marketplace
CREATE OR REPLACE FUNCTION public.marketplace_store_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id FROM stores s
  WHERE s.is_active AND NOT COALESCE(s.is_blocked, false) AND NOT COALESCE(s.is_developer_shadow, false)
    AND NOT COALESCE(s.is_hidden, false) AND s.logo_url IS NOT NULL
    AND EXISTS (SELECT 1 FROM subscriptions x WHERE x.user_id = s.owner_id AND x.is_active AND x.tier <> 'free'
                AND (x.expires_at IS NULL OR x.expires_at > now()))
    AND (SELECT count(*) FROM products p WHERE p.store_id = s.id AND p.is_active) >= 5;
$$;
REVOKE ALL ON FUNCTION public.marketplace_store_ids() FROM public;
GRANT EXECUTE ON FUNCTION public.marketplace_store_ids() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_products(
  p_tab text DEFAULT 'for_you',      -- for_you | new | deals | bestsellers
  p_niche text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 24,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid, name text, image text, image2 text, price numeric, compare_at_price numeric,
  discount_pct int, category text, niche text, has_variants boolean,
  store_id uuid, store_name text, store_slug text, store_verified boolean,
  sold int, rating numeric, review_count int, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ok_stores AS (SELECT marketplace_store_ids() AS id),
  base AS (
    SELECT p.*,
      COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                WHERE oi.product_id = p.id AND o.payment_status = 'paid'), 0)::int AS sold_n,
      (SELECT round(avg(r.rating)::numeric, 1) FROM reviews r WHERE r.product_id = p.id AND r.is_approved) AS rating_v,
      (SELECT count(*) FROM reviews r WHERE r.product_id = p.id AND r.is_approved)::int AS review_n,
      CASE WHEN p.compare_at_price > p.selling_price AND p.compare_at_price > 0
           THEN round((1 - p.selling_price / p.compare_at_price) * 100)::int ELSE 0 END AS disc,
      md5(p.id::text || current_date::text) AS daily_shuffle
    FROM products p
    WHERE p.store_id IN (SELECT id FROM ok_stores)
      AND p.is_active
      AND NOT COALESCE(p.is_out_of_stock, false)
      AND (p.has_variants OR COALESCE(p.stock_quantity, 1) > 0)
      AND COALESCE(array_length(p.images, 1), 0) > 0
      AND p.selling_price > 0
      AND (p_niche IS NULL OR p.niche = p_niche)
      AND (p_category IS NULL OR lower(trim(p.category)) = lower(trim(p_category)))
      AND (p_search IS NULL OR p.name ILIKE '%' || p_search || '%' OR p.category ILIKE '%' || p_search || '%'
           OR EXISTS (SELECT 1 FROM unnest(COALESCE(p.tags, '{}')) t WHERE t ILIKE '%' || p_search || '%'))
      AND (p_tab <> 'deals' OR (p.compare_at_price > p.selling_price))
  ),
  ranked AS (
    -- Round-robin across stores so the "For You" feed is genuinely mixed
    SELECT b.*, row_number() OVER (PARTITION BY b.store_id ORDER BY b.sold_n DESC, b.daily_shuffle) AS store_rank
    FROM base b
  )
  SELECT r.id, r.name, r.images[1], r.images[2], r.selling_price, r.compare_at_price,
         r.disc, r.category, r.niche, COALESCE(r.has_variants, false),
         s.id, s.name, s.slug, COALESCE(s.is_verified, false),
         r.sold_n, r.rating_v, r.review_n, r.created_at
  FROM ranked r JOIN stores s ON s.id = r.store_id
  ORDER BY
    CASE WHEN p_tab = 'new' THEN extract(epoch FROM r.created_at) END DESC NULLS LAST,
    CASE WHEN p_tab = 'bestsellers' THEN r.sold_n END DESC NULLS LAST,
    CASE WHEN p_tab = 'deals' THEN r.disc END DESC NULLS LAST,
    CASE WHEN p_tab = 'for_you' THEN r.store_rank END ASC NULLS LAST,
    r.daily_shuffle
  LIMIT LEAST(GREATEST(p_limit, 1), 60) OFFSET GREATEST(p_offset, 0);
$$;
REVOKE ALL ON FUNCTION public.marketplace_products(text, text, text, text, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.marketplace_products(text, text, text, text, int, int) TO anon, authenticated;

-- Category shortcuts: niches (top tabs) and top product categories (round shortcuts), with a photo each
CREATE OR REPLACE FUNCTION public.marketplace_categories()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH live AS (
    SELECT p.* FROM products p
    WHERE p.store_id IN (SELECT marketplace_store_ids()) AND p.is_active
      AND NOT COALESCE(p.is_out_of_stock, false) AND COALESCE(array_length(p.images, 1), 0) > 0 AND p.selling_price > 0
  )
  SELECT jsonb_build_object(
    'niches', COALESCE((SELECT jsonb_agg(x ORDER BY x->>'count' DESC) FROM (
        SELECT jsonb_build_object('id', niche, 'count', count(*),
               'image', (array_agg(images[1] ORDER BY created_at DESC))[1]) x
        FROM live WHERE niche IS NOT NULL AND niche <> '' GROUP BY niche) n), '[]'::jsonb),
    'categories', COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT jsonb_build_object('name', initcap(lower(trim(category))), 'count', count(*),
               'image', (array_agg(images[1] ORDER BY created_at DESC))[1]) x
        FROM live WHERE category IS NOT NULL AND trim(category) <> ''
        GROUP BY lower(trim(category)), initcap(lower(trim(category)))
        ORDER BY count(*) DESC LIMIT 24) c), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.marketplace_categories() FROM public;
GRANT EXECUTE ON FUNCTION public.marketplace_categories() TO anon, authenticated;
