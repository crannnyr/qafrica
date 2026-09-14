-- Auto-billing overhaul, Step 1:
-- 1. get_batch_customer_breakdown now also returns item_shipping_method,
--    the per-item shipping method (falls back to the order-level field for
--    orders placed before per-item shipping existed) -- needed for accurate
--    air/sea counts, since the order-level field can be 'mixed'.
-- 2. get_batch_sourcing_totals now excludes any customer already billed
--    (consolidation_shipping, status='sent') for this batch, and adds
--    flight_qty/sea_qty per product.
-- 3. New get_batch_product_shipping_breakdown(batch_key, product_id): variant
--    x shipping-method breakdown for one product, unbilled customers only --
--    feeds the Sourcing item drill-down.

drop function if exists public.get_batch_customer_breakdown(text);

create function public.get_batch_customer_breakdown(p_batch_key text)
returns table(
  customer_id uuid, customer_name text, first_order_at timestamptz, order_count integer,
  shipping_method text, order_id uuid, order_code text,
  product_id uuid, product_name text, product_image text, source_url text, ship_only boolean,
  variant_options jsonb, qty integer, unit_price_ngn numeric,
  others_in_batch integer, customers_in_open_batch integer,
  item_shipping_method text
)
language sql stable
set search_path to 'public', 'pg_temp'
as $function$
  with batch_items as (
    select
      o.user_id                                 as customer_id,
      o.customer_name,
      o.shipping_method,
      o.id                                      as order_id,
      o.code                                    as order_code,
      o.created_at                              as order_created_at,
      (item->>'id')::uuid                       as product_id,
      item->>'name'                             as product_name,
      nullif(item->>'image_url', '')            as product_image,
      coalesce((item->>'quantity')::int, 1)     as qty,
      coalesce((item->>'price_ngn')::numeric, 0) as unit_price_ngn,
      item->'variant_options'                   as variant_options,
      coalesce(item->>'shipping_method', o.shipping_method) as item_shipping_method
    from public.china_import_orders o,
         jsonb_array_elements(o.items) as item
    where o.staged_at is not null
      and o.staged_at = p_batch_key::timestamptz
      and item->>'id' is not null
  ),
  batch_product_customers as (
    select product_id, count(distinct customer_id) as customers_in_batch
    from batch_items
    group by product_id
  ),
  open_batch_products as (
    select (item->>'id')::uuid as product_id,
           count(distinct o.user_id) as customers_in_open_batch
    from public.china_import_orders o,
         jsonb_array_elements(o.items) as item
    where o.staged_at is null
      and o.payment_status = 'paid'
      and item->>'id' is not null
    group by 1
  ),
  customer_totals as (
    select customer_id,
           min(order_created_at)      as first_order_at,
           count(distinct order_id)   as order_count
    from batch_items
    group by customer_id
  )
  select
    bi.customer_id,
    bi.customer_name,
    ct.first_order_at,
    ct.order_count::int,
    bi.shipping_method,
    bi.order_id,
    bi.order_code,
    bi.product_id,
    bi.product_name,
    coalesce(bi.product_image, p.image_url)              as product_image,
    p.source_url,
    coalesce(p.ship_only, false)                          as ship_only,
    bi.variant_options,
    bi.qty,
    bi.unit_price_ngn,
    greatest(coalesce(bpc.customers_in_batch, 1) - 1, 0)::int as others_in_batch,
    coalesce(obp.customers_in_open_batch, 0)::int             as customers_in_open_batch,
    bi.item_shipping_method
  from batch_items bi
  left join public.china_import_products p on p.id = bi.product_id
  left join batch_product_customers bpc     on bpc.product_id = bi.product_id
  left join open_batch_products obp         on obp.product_id = bi.product_id
  left join customer_totals ct              on ct.customer_id = bi.customer_id
  order by ct.first_order_at asc nulls last, bi.customer_name asc, bi.product_name asc;
$function$;

drop function if exists public.get_batch_sourcing_totals(text);

create function public.get_batch_sourcing_totals(p_batch_key text)
returns table(
  product_id uuid, product_name text, product_image text, source_url text,
  total_qty bigint, customers_count bigint, flight_qty bigint, sea_qty bigint
)
language sql stable
set search_path to 'public', 'pg_temp'
as $function$
  select
    b.product_id, b.product_name,
    coalesce(b.product_image, p.image_url) as product_image,
    p.source_url,
    sum(b.qty)::bigint as total_qty,
    count(distinct b.customer_id)::bigint as customers_count,
    sum(b.qty) filter (where b.item_shipping_method = 'flight')::bigint as flight_qty,
    sum(b.qty) filter (where b.item_shipping_method = 'sea_freight')::bigint as sea_qty
  from get_batch_customer_breakdown(p_batch_key) b
  left join china_import_products p on p.id = b.product_id
  where b.customer_id is not null
    -- Exclude anyone already billed for consolidation_shipping in this batch --
    -- their items no longer need sourcing decisions/quantities re-counted.
    and not exists (
      select 1 from import_batch_bill_status s
      where s.batch_key = p_batch_key and s.kind = 'consolidation_shipping'
        and s.customer_id = b.customer_id and s.status = 'sent'
    )
  group by b.product_id, b.product_name, coalesce(b.product_image, p.image_url), p.source_url
  order by total_qty desc, product_name asc;
$function$;

create function public.get_batch_product_shipping_breakdown(p_batch_key text, p_product_id uuid)
returns table(
  variant_options jsonb, shipping_method text, qty bigint, customers_count bigint
)
language sql stable
set search_path to 'public', 'pg_temp'
as $function$
  select
    b.variant_options,
    b.item_shipping_method as shipping_method,
    sum(b.qty)::bigint as qty,
    count(distinct b.customer_id)::bigint as customers_count
  from get_batch_customer_breakdown(p_batch_key) b
  where b.customer_id is not null
    and b.product_id = p_product_id
    and not exists (
      select 1 from import_batch_bill_status s
      where s.batch_key = p_batch_key and s.kind = 'consolidation_shipping'
        and s.customer_id = b.customer_id and s.status = 'sent'
    )
  group by b.variant_options, b.item_shipping_method
  order by qty desc;
$function$;
