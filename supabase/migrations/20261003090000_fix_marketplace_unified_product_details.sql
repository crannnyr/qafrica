-- Unified marketplace product-detail contract.
-- The catalog RPC was upgraded to a source-aware contract, but the
-- single-product RPC was still returning the legacy marketplace shape.
-- Keep the public function name/signature stable for the storefront and
-- replace its return contract so the detail page receives the same fields
-- as the unified feed.

drop function if exists public.marketplace_unified_product(text, uuid);

create or replace function public.marketplace_unified_product(
  p_source_type text,
  p_source_id uuid
)
returns table(
  id text,
  source_id uuid,
  source_type text,
  name text,
  description text,
  images text[],
  price_ngn numeric,
  compare_at_price_ngn numeric,
  category text,
  niche text,
  has_variants boolean,
  variants jsonb,
  is_available boolean,
  stock_quantity integer,
  sold integer,
  rating numeric,
  review_count integer,
  created_at timestamptz,
  seller_type text,
  seller_id uuid,
  seller_name text,
  seller_slug text,
  seller_verified boolean,
  tags text[],
  is_china_import boolean,
  flight_shipping_cost_ngn numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    'product:' || p.id::text,
    p.id,
    'product',
    p.name,
    p.description,
    coalesce(p.images, '{}'::text[]),
    p.selling_price,
    p.compare_at_price,
    p.category,
    p.niche,
    coalesce(p.has_variants, false),
    coalesce(p.variants, '[]'::jsonb),
    (
      coalesce(p.is_active, false)
      and not coalesce(p.is_out_of_stock, false)
      and (p.has_variants or coalesce(p.stock_quantity, 1) > 0)
      and p.selling_price > 0
    ),
    p.stock_quantity,
    coalesce((
      select sum(oi.quantity)::int
      from order_items oi
      join orders o on o.id = oi.order_id
      where oi.product_id = p.id
        and o.payment_status = 'paid'
    ), 0),
    (
      select round(avg(r.rating)::numeric, 1)
      from reviews r
      where r.product_id = p.id
        and r.is_approved
    ),
    (
      select count(*)::int
      from reviews r
      where r.product_id = p.id
        and r.is_approved
    ),
    p.created_at,
    'store',
    s.id,
    s.name,
    s.slug,
    coalesce(s.is_verified, false),
    coalesce(p.tags, '{}'::text[]),
    false,
    null::numeric
  from products p
  join stores s on s.id = p.store_id
  where p_source_type = 'product'
    and p.id = p_source_id
    and coalesce(p.is_active, false) = true
    and coalesce(s.is_active, false) = true
    and coalesce(s.is_blocked, false) = false
    and coalesce(s.marketplace_enabled, false) = true

  union all

  select
    'china_import:' || cip.id::text,
    cip.id,
    'china_import',
    cip.name,
    cip.description,
    case
      when coalesce(array_length(cip.image_urls, 1), 0) > 0
        then cip.image_urls
      when cip.image_url is not null
        then array[cip.image_url]::text[]
      else '{}'::text[]
    end,
    cip.price_ngn,
    null::numeric,
    cip.category,
    null::text,
    coalesce(cip.has_variants, false),
    coalesce(cip.variants, '[]'::jsonb),
    (
      coalesce(cip.is_active, false)
      and cip.flight_shipping_cost_ngn is not null
      and cip.flight_shipping_cost_ngn > 0
      and coalesce(cip.price_ngn, 0) > 0
    ),
    null::integer,
    coalesce(cip.units_sold, 0),
    null::numeric,
    0::integer,
    cip.created_at,
    'qafrica',
    null::uuid,
    'QAFRICA',
    null::text,
    true,
    array['China Import']::text[],
    true,
    cip.flight_shipping_cost_ngn
  from china_import_products cip
  where p_source_type = 'china_import'
    and cip.id = p_source_id
    and coalesce(cip.is_active, false) = true
    and cip.flight_shipping_cost_ngn is not null
    and cip.flight_shipping_cost_ngn > 0
    and coalesce(cip.price_ngn, 0) > 0

  limit 1;
$$;

revoke all on function public.marketplace_unified_product(text, uuid) from public;
grant execute on function public.marketplace_unified_product(text, uuid) to anon, authenticated;
