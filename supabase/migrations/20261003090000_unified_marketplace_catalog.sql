-- Unified marketplace experiment.
--
-- This does NOT modify products or china_import_products. It exposes both
-- sources through a single read-only catalog contract for the new marketplace.
-- China-import items are marketplace-owned (QAFRICA) for this phase.
--
-- Visibility rule for China imports:
--   is_active = true
--   AND flight_shipping_cost_ngn IS NOT NULL
--   AND flight_shipping_cost_ngn > 0

create or replace function public.marketplace_unified_products(
  p_tab text default 'for_you',
  p_niche text default null,
  p_category text default null,
  p_search text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
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
set search_path to 'public', 'pg_temp'
as $function$
  with ok_stores as (
    select marketplace_store_ids() as id
  ),
  normal_products as (
    select
      'product:' || p.id::text as id,
      p.id as source_id,
      'product'::text as source_type,
      p.name,
      p.description,
      coalesce(p.images, '{}'::text[]) as images,
      p.selling_price as price_ngn,
      p.compare_at_price as compare_at_price_ngn,
      p.category,
      p.niche,
      coalesce(p.has_variants, false) as has_variants,
      coalesce(p.variants, '[]'::jsonb) as variants,
      true as is_available,
      p.stock_quantity,
      coalesce((
        select sum(oi.quantity)::int
        from order_items oi
        join orders o on o.id = oi.order_id
        where oi.product_id = p.id
          and o.payment_status = 'paid'
      ), 0) as sold,
      (
        select round(avg(r.rating)::numeric, 1)
        from reviews r
        where r.product_id = p.id
          and r.is_approved
      ) as rating,
      (
        select count(*)::int
        from reviews r
        where r.product_id = p.id
          and r.is_approved
      ) as review_count,
      p.created_at,
      'store'::text as seller_type,
      s.id as seller_id,
      s.name as seller_name,
      s.slug as seller_slug,
      coalesce(s.is_verified, false) as seller_verified,
      coalesce(p.tags, '{}'::text[]) as tags,
      false as is_china_import,
      null::numeric as flight_shipping_cost_ngn,
      case
        when p.compare_at_price > p.selling_price and p.compare_at_price > 0
          then round((1 - p.selling_price / p.compare_at_price) * 100)::int
        else 0
      end as discount_pct,
      md5(p.id::text || current_date::text) as shuffle_key
    from products p
    join stores s on s.id = p.store_id
    where p.store_id in (select id from ok_stores)
      and p.is_active
      and not coalesce(p.is_out_of_stock, false)
      and (p.has_variants or coalesce(p.stock_quantity, 1) > 0)
      and coalesce(array_length(p.images, 1), 0) > 0
      and p.selling_price > 0
      and (p_niche is null or p.niche = p_niche)
      and (p_category is null or lower(trim(p.category)) = lower(trim(p_category)))
      and (
        p_search is null
        or p.name ilike '%' || p_search || '%'
        or coalesce(p.category, '') ilike '%' || p_search || '%'
        or exists (
          select 1
          from unnest(coalesce(p.tags, '{}')) t
          where t ilike '%' || p_search || '%'
        )
      )
      and (p_tab <> 'deals' or p.compare_at_price > p.selling_price)
  ),
  china_products as (
    select
      'china_import:' || cip.id::text as id,
      cip.id as source_id,
      'china_import'::text as source_type,
      cip.name,
      cip.description,
      case
        when coalesce(array_length(cip.image_urls, 1), 0) > 0 then cip.image_urls
        else array[cip.image_url]
      end as images,
      cip.price_ngn,
      null::numeric as compare_at_price_ngn,
      cip.category,
      null::text as niche,
      coalesce(cip.has_variants, false) as has_variants,
      coalesce(cip.variants, '[]'::jsonb) as variants,
      true as is_available,
      null::integer as stock_quantity,
      coalesce(cip.units_sold, 0) as sold,
      null::numeric as rating,
      0::integer as review_count,
      cip.created_at,
      'qafrica'::text as seller_type,
      null::uuid as seller_id,
      'QAFRICA'::text as seller_name,
      null::text as seller_slug,
      true as seller_verified,
      array['China Import']::text[] as tags,
      true as is_china_import,
      cip.flight_shipping_cost_ngn,
      0::int as discount_pct,
      md5(cip.id::text || current_date::text) as shuffle_key
    from china_import_products cip
    where cip.is_active
      and cip.flight_shipping_cost_ngn is not null
      and cip.flight_shipping_cost_ngn > 0
      and (p_niche is null)
      and (p_category is null or lower(trim(cip.category)) = lower(trim(p_category)))
      and (
        p_search is null
        or cip.name ilike '%' || p_search || '%'
        or coalesce(cip.category, '') ilike '%' || p_search || '%'
        or 'China Import' ilike '%' || p_search || '%'
      )
      -- China-import products do not participate in the normal-store deals
      -- definition until the marketplace has a real comparison-price policy.
      and p_tab <> 'deals'
  ),
  unified as (
    select * from normal_products
    union all
    select * from china_products
  )
  select
    u.id,
    u.source_id,
    u.source_type,
    u.name,
    u.description,
    u.images,
    u.price_ngn,
    u.compare_at_price_ngn,
    u.category,
    u.niche,
    u.has_variants,
    u.variants,
    u.is_available,
    u.stock_quantity,
    u.sold,
    u.rating,
    u.review_count,
    u.created_at,
    u.seller_type,
    u.seller_id,
    u.seller_name,
    u.seller_slug,
    u.seller_verified,
    u.tags,
    u.is_china_import,
    u.flight_shipping_cost_ngn
  from unified u
  order by
    case when p_tab = 'new' then extract(epoch from u.created_at) end desc nulls last,
    case when p_tab = 'bestsellers' then u.sold end desc nulls last,
    case when p_tab = 'deals' then u.discount_pct end desc nulls last,
    case when p_tab = 'for_you' then u.sold end desc nulls last,
    u.shuffle_key
  limit least(greatest(p_limit, 1), 60)
  offset greatest(p_offset, 0);
$function$;

comment on function public.marketplace_unified_products(text, text, text, text, integer, integer)
is 'Read-only unified marketplace catalog for the isolated marketplace experiment. Combines products with eligible China-import products without copying or merging the source tables.';
