-- /stores-v2 category source: union eligible normal marketplace products and China Import products.
-- Intentionally separate from marketplace_categories() so /stores remains unchanged.
CREATE OR REPLACE FUNCTION public.marketplace_v2_categories()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH normal AS (
    SELECT
      lower(trim(p.category)) AS value,
      initcap(regexp_replace(lower(trim(p.category)), '[-_]+', ' ', 'g')) AS name,
      p.images[1] AS image,
      p.niche
    FROM public.products p
    WHERE p.store_id IN (SELECT public.marketplace_store_ids())
      AND p.is_active
      AND NOT COALESCE(p.is_out_of_stock, false)
      AND COALESCE(array_length(p.images, 1), 0) > 0
      AND p.selling_price > 0
      AND p.category IS NOT NULL
      AND trim(p.category) <> ''
  ),
  china AS (
    SELECT
      lower(trim(c.category)) AS value,
      initcap(regexp_replace(lower(trim(c.category)), '[-_]+', ' ', 'g')) AS name,
      c.images[1] AS image,
      NULL::text AS niche
    FROM public.china_import_products c
    WHERE c.is_active
      AND c.flight_shipping_cost_ngn IS NOT NULL
      AND c.flight_shipping_cost_ngn > 0
      AND COALESCE(array_length(c.images, 1), 0) > 0
      AND c.price_ngn > 0
      AND c.category IS NOT NULL
      AND trim(c.category) <> ''
  ),
  all_products AS (
    SELECT * FROM normal
    UNION ALL
    SELECT * FROM china
  ),
  categories AS (
    SELECT
      value,
      max(name) AS name,
      count(*)::int AS count,
      (array_agg(image) FILTER (WHERE image IS NOT NULL))[1] AS image,
      to_jsonb(array_remove(array_agg(DISTINCT niche), NULL)) AS niches
    FROM all_products
    GROUP BY value
  ),
  niches AS (
    SELECT
      niche AS id,
      count(*)::int AS count,
      (array_agg(image) FILTER (WHERE image IS NOT NULL))[1] AS image
    FROM normal
    WHERE niche IS NOT NULL AND niche <> ''
    GROUP BY niche
  )
  SELECT jsonb_build_object(
    'niches',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(n) ORDER BY n.count DESC) FROM niches n),
        '[]'::jsonb
      ),
    'categories',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.count DESC, c.name ASC) FROM categories c),
        '[]'::jsonb
      )
  );
$function$;

GRANT EXECUTE ON FUNCTION public.marketplace_v2_categories() TO anon, authenticated;
