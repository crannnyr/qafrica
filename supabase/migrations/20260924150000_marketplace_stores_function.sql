-- Applied live via apply_migration on 2026-09-24 (names: marketplace_stores_function, marketplace_stores_listing_rule_v2).
-- Verified as the anon role (logged-out shopper).
-- Public list of stores for /stores. Runs server-side (SECURITY DEFINER) because the
-- eligibility rule needs the owner's subscription, which shoppers cannot read. Previously the
-- page checked subscriptions in the browser, RLS hid them, and shoppers saw zero stores.
-- Returns only public-safe columns.
CREATE OR REPLACE FUNCTION public.marketplace_stores()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  description text,
  logo_url text,
  banner_url text,
  primary_color text,
  niches text[],
  is_verified boolean,
  storefront_look text,
  look_settings jsonb,
  product_count integer,
  preview_images text[],
  rating numeric,
  review_count integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH eligible AS (
    SELECT s.*
    FROM stores s
    WHERE s.is_active
      AND NOT COALESCE(s.is_blocked, false)
      AND NOT COALESCE(s.is_developer_shadow, false)
      AND NOT COALESCE(s.is_hidden, false)
      -- Listing rule: active + logo + active paid plan + 5 active products (below).
      -- A banner is optional; only stores with one appear in the /stores carousel.
      AND s.logo_url IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM subscriptions x
        WHERE x.user_id = s.owner_id AND x.is_active AND x.tier <> 'free'
          AND (x.expires_at IS NULL OR x.expires_at > now())
      )
  ),
  prods AS (
    SELECT p.store_id,
           count(*)::int AS n,
           (array_agg(p.images[1] ORDER BY p.created_at DESC) FILTER (WHERE COALESCE(array_length(p.images, 1), 0) > 0))[1:4] AS imgs
    FROM products p
    JOIN eligible e ON e.id = p.store_id
    WHERE p.is_active
    GROUP BY p.store_id
  ),
  revs AS (
    SELECT r.store_id, round(avg(r.rating)::numeric, 1) AS rating, count(*)::int AS n
    FROM reviews r
    JOIN eligible e ON e.id = r.store_id
    WHERE r.is_approved
    GROUP BY r.store_id
  )
  SELECT e.id, e.name, e.slug, e.description, e.logo_url, e.banner_url, e.primary_color,
         COALESCE(e.niches, '{}'), COALESCE(e.is_verified, false), e.storefront_look,
         -- only the look fields needed to draw the store's name
         jsonb_strip_nulls(jsonb_build_object(
           'wordmark_dark', e.look_settings->'wordmark_dark',
           'wordmark_accent', e.look_settings->'wordmark_accent',
           'tagline', e.look_settings->'tagline',
           'headline', e.look_settings->'headline',
           'bio', e.look_settings->'bio')),
         p.n, p.imgs, rv.rating, COALESCE(rv.n, 0), e.created_at
  FROM eligible e
  JOIN prods p ON p.store_id = e.id AND p.n >= 5   -- 5+ active products
  LEFT JOIN revs rv ON rv.store_id = e.id
  ORDER BY COALESCE(e.is_verified, false) DESC, p.n DESC, e.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.marketplace_stores() FROM public;
GRANT EXECUTE ON FUNCTION public.marketplace_stores() TO anon, authenticated;
