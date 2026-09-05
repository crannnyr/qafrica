-- Phase 4: everything the closed-batch "by customer" drill-down needs, in one
-- query rather than the frontend stitching several together.
--
-- Beyond the existing product breakdown this adds, per line:
--   * the price the customer actually paid (from the order's item snapshot)
--   * the admin-only 1688 link and the ship_only flag
--   * how many OTHER customers in this closed batch bought the same product
--   * how many customers in the currently OPEN batch have bought it
--
-- The open-batch count is what tells admin whether it is worth ordering extra
-- units now: those orders are paid but not yet staged into a batch, so they
-- are the demand already queued behind this one.
--
-- product_image falls back to the product's current image when the order's
-- snapshot is missing or blank, because a card with no photo is not
-- acceptable in this view.
create or replace function public.get_batch_customer_breakdown(p_batch_key text)
returns table (
  customer_id             uuid,
  customer_name           text,
  first_order_at          timestamptz,
  order_count             int,
  shipping_method         text,
  order_id                uuid,
  order_code              text,
  product_id              uuid,
  product_name            text,
  product_image           text,
  source_url              text,
  ship_only               boolean,
  variant_options         jsonb,
  qty                     int,
  unit_price_ngn          numeric,
  others_in_batch         int,
  customers_in_open_batch int
)
language sql
stable
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
      item->'variant_options'                   as variant_options
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
  -- The open batch: paid, but not yet staged into any closed batch.
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
    coalesce(obp.customers_in_open_batch, 0)::int             as customers_in_open_batch
  from batch_items bi
  left join public.china_import_products p on p.id = bi.product_id
  left join batch_product_customers bpc     on bpc.product_id = bi.product_id
  left join open_batch_products obp         on obp.product_id = bi.product_id
  left join customer_totals ct              on ct.customer_id = bi.customer_id
  -- Oldest buyer first is the default the admin asked for.
  order by ct.first_order_at asc nulls last, bi.customer_name asc, bi.product_name asc;
$function$;

-- Admin-only, reached through the edge function's service role.
revoke execute on function public.get_batch_customer_breakdown(text) from public, anon, authenticated;
grant  execute on function public.get_batch_customer_breakdown(text) to service_role;
