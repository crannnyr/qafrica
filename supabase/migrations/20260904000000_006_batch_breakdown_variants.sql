-- get_batch_product_breakdown didn't return variant_options, so every
-- variant of a product (different size/color) got silently merged into one
-- undifferentiated line in the batch admin page.
drop function if exists public.get_batch_product_breakdown(text);

create function public.get_batch_product_breakdown(p_batch_key text)
 returns table(product_id uuid, product_name text, product_image text, customer_id uuid, customer_name text, qty integer, order_id uuid, order_code text, order_created_at timestamp with time zone, variant_options jsonb)
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
    o.created_at AS order_created_at,
    item->'variant_options' AS variant_options
  FROM public.china_import_orders o,
       jsonb_array_elements(o.items) AS item
  WHERE o.staged_at IS NOT NULL
    AND o.staged_at = p_batch_key::timestamptz
    AND item->>'id' IS NOT NULL;
$function$;
