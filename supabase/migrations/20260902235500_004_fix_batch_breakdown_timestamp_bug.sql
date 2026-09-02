-- get_batch_product_breakdown compared o.staged_at::text = p_batch_key,
-- which casts to Postgres's default text format ("2026-09-01 21:06:32.542+00").
-- The frontend always sends ISO 8601 ("2026-09-01T21:06:32.542+00:00", with
-- a T separator), so the string comparison never matched and the RPC
-- silently returned zero rows for every batch -- the "no orders" bug seen
-- on the new closed-batch page. Comparing as actual timestamptz values
-- instead of text is immune to formatting differences.
create or replace function public.get_batch_product_breakdown(p_batch_key text)
 returns table(product_id uuid, product_name text, product_image text, customer_id uuid, customer_name text, qty integer, order_id uuid, order_code text, order_created_at timestamp with time zone)
 language sql
 stable
as $function$
  SELECT
    (item->>'id')::uuid AS product_id,
    item->>'name' AS product_name,
    item->>'image_url' AS product_image,
    o.user_id AS customer_id,
    o.customer_name,
    (item->>'quantity')::int AS qty,
    o.id AS order_id,
    o.code AS order_code,
    o.created_at AS order_created_at
  FROM public.china_import_orders o,
       jsonb_array_elements(o.items) AS item
  WHERE o.staged_at IS NOT NULL
    AND o.staged_at = p_batch_key::timestamptz
    AND item->>'id' IS NOT NULL;
$function$;
