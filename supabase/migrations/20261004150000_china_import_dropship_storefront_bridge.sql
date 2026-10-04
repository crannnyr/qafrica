-- Phase 2 storefront bridge.
-- Seller-owned China Import listings are read from the bridge catalog.
-- The China source UUID remains the source_id; seller_store_id is carried
-- through the listing identity and product-detail selection.

create or replace function public.marketplace_unified_products(
  p_tab text,
  p_niche text,
  p_category text,
  p_search text,
  p_limit integer,
  p_offset integer,
  p_viewer_seed text
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
      coalesce((select sum(oi.quantity)::int from order_items oi join orders o on o.id = oi.order_id where oi.product_id = p.id and o.payment_status = 'paid'), 0) as sold,
      (select round(avg(r.rating)::numeric, 1) from reviews r where r.product_id = p.id and r.is_approved) as rating,
      (select count(*)::int from reviews r where r.product_id = p.id and r.is_approved) as review_count,
      p.created_at,
      'store'::text as seller_type,
      s.id as seller_id,
      s.name as seller_name,
      s.slug as seller_slug,
      coalesce(s.is_verified, false) as seller_verified,
      coalesce(p.tags, '{}'::text[]) as tags,
      false as is_china_import,
      null::numeric as flight_shipping_cost_ngn,
      case when p.compare_at_price > p.selling_price and p.compare_at_price > 0
        then round((1 - p.selling_price / p.compare_at_price) * 100)::int else 0 end as discount_pct
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
      and (p_search is null or p.name ilike '%' || p_search || '%' or coalesce(p.category, '') ilike '%' || p_search || '%'
        or exists (select 1 from unnest(coalesce(p.tags, '{}')) t where t ilike '%' || p_search || '%'))
      and (p_tab <> 'deals' or p.compare_at_price > p.selling_price)
  ),
  qafrica_china as (
    select
      'china_import:qafrica:' || cip.id::text as id,
      cip.id as source_id,
      'china_import'::text as source_type,
      cip.name,
      cip.description,
      case when coalesce(array_length(cip.image_urls, 1), 0) > 0 then cip.image_urls
           when cip.image_url is not null then array[cip.image_url]::text[] else '{}'::text[] end as images,
      cip.price_ngn,
      null::numeric,
      cip.category,
      n.name as niche,
      coalesce(cip.has_variants, false),
      coalesce(cip.variants, '[]'::jsonb),
      true,
      null::integer,
      coalesce(cip.units_sold, 0),
      null::numeric,
      0::integer,
      cip.created_at,
      'qafrica'::text,
      null::uuid,
      'QAFRICA'::text,
      null::text,
      true,
      array['China Import']::text[],
      true,
      cip.air_shipping_customer_ngn,
      0::int
    from china_import_products cip
    left join niche_categories nc on nc.id = cip.category_id
    left join niches n on n.id = nc.niche_id
    where cip.is_active
      and cip.air_shipping_customer_ngn is not null
      and cip.air_shipping_customer_ngn > 0
      and coalesce(cip.price_ngn, 0) > 0
      and (p_niche is null or n.id = p_niche)
      and (p_category is null or lower(trim(cip.category)) = lower(trim(p_category)))
      and (p_search is null or cip.name ilike '%' || p_search || '%' or coalesce(cip.category, '') ilike '%' || p_search || '%' or 'China Import' ilike '%' || p_search || '%')
      and p_tab <> 'deals'
  ),
  seller_china as (
    select
      'china_import:' || c.id::text || ':store:' || c.seller_store_id::text as id,
      cip.id as source_id,
      'china_import'::text as source_type,
      cip.name,
      cip.description,
      case when coalesce(array_length(cip.image_urls, 1), 0) > 0 then cip.image_urls
           when cip.image_url is not null then array[cip.image_url]::text[] else '{}'::text[] end as images,
      c.seller_price_ngn,
      null::numeric,
      cip.category,
      n.name as niche,
      coalesce(cip.has_variants, false),
      coalesce(cip.variants, '[]'::jsonb),
      true,
      null::integer,
      coalesce(cip.units_sold, 0),
      null::numeric,
      0::integer,
      c.updated_at,
      'store'::text,
      s.id,
      s.name,
      s.slug,
      coalesce(s.is_verified, false),
      array['China Import']::text[],
      true,
      null::numeric,
      0::int
    from china_import_dropship_catalog c
    join china_import_products cip on cip.id = c.china_import_product_id
    join stores s on s.id = c.seller_store_id
    left join niche_categories nc on nc.id = cip.category_id
    left join niches n on n.id = nc.niche_id
    where c.status = 'active'
      and cip.is_active
      and cip.air_shipping_customer_ngn is not null
      and cip.air_shipping_customer_ngn > 0
      and coalesce(c.seller_price_ngn, 0) > 0
      and coalesce(s.is_active, false)
      and not coalesce(s.is_blocked, false)
      and coalesce(s.marketplace_enabled, false)
      and (p_niche is null or n.id = p_niche)
      and (p_category is null or lower(trim(cip.category)) = lower(trim(p_category)))
      and (p_search is null or cip.name ilike '%' || p_search || '%' or coalesce(cip.category, '') ilike '%' || p_search || '%' or 'China Import' ilike '%' || p_search || '%')
      and p_tab <> 'deals'
  ),
  unified as (
    select * from normal_products
    union all select * from qafrica_china
    union all select * from seller_china
  )
  select
    u.id, u.source_id, u.source_type, u.name, u.description, u.images,
    u.price_ngn, u.compare_at_price_ngn, u.category, u.niche, u.has_variants,
    u.variants, u.is_available, u.stock_quantity, u.sold, u.rating,
    u.review_count, u.created_at, u.seller_type, u.seller_id, u.seller_name,
    u.seller_slug, u.seller_verified, u.tags, u.is_china_import,
    u.flight_shipping_cost_ngn
  from unified u
  order by
    case when p_tab = 'new' then extract(epoch from u.created_at) end desc nulls last,
    case when p_tab = 'bestsellers' then u.sold end desc nulls last,
    case when p_tab = 'deals' then 0 end desc nulls last,
    md5(coalesce(p_viewer_seed, '') || ':' || u.id)
  limit least(greatest(p_limit, 1), 60)
  offset greatest(p_offset, 0);
$function$;

-- Keep the six-argument storefront client contract, but return the
-- source-aware shape consumed by /stores-v2.
drop function if exists public.marketplace_unified_products(text, text, text, text, integer, integer);
create function public.marketplace_unified_products(
  p_tab text default 'for_you',
  p_niche text default null,
  p_category text default null,
  p_search text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id text, source_id uuid, source_type text, name text, description text,
  images text[], price_ngn numeric, compare_at_price_ngn numeric,
  category text, niche text, has_variants boolean, variants jsonb,
  is_available boolean, stock_quantity integer, sold integer, rating numeric,
  review_count integer, created_at timestamptz, seller_type text,
  seller_id uuid, seller_name text, seller_slug text, seller_verified boolean,
  tags text[], is_china_import boolean, flight_shipping_cost_ngn numeric
)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
  select * from public.marketplace_unified_products(
    p_tab, p_niche, p_category, p_search, p_limit, p_offset, null
  );
$$;

grant execute on function public.marketplace_unified_products(text,text,text,text,integer,integer) to anon, authenticated;
grant execute on function public.marketplace_unified_products(text,text,text,text,integer,integer,text) to anon, authenticated;

-- Seller-aware product detail. Existing two-argument function remains intact
-- for QAFRICA/direct listings; this overload resolves a seller catalog row.
create or replace function public.marketplace_unified_product(
  p_source_type text,
  p_source_id uuid,
  p_store_id uuid
)
returns table (
  id text, source_id uuid, source_type text, name text, description text,
  images text[], price_ngn numeric, compare_at_price_ngn numeric,
  category text, niche text, has_variants boolean, variants jsonb,
  is_available boolean, stock_quantity integer, sold integer, rating numeric,
  review_count integer, created_at timestamptz, seller_type text,
  seller_id uuid, seller_name text, seller_slug text, seller_verified boolean,
  tags text[], is_china_import boolean, flight_shipping_cost_ngn numeric
)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
  select
    'china_import:' || cip.id::text || ':store:' || c.seller_store_id::text,
    cip.id, 'china_import', cip.name, cip.description,
    case when coalesce(array_length(cip.image_urls, 1), 0) > 0 then cip.image_urls
         when cip.image_url is not null then array[cip.image_url]::text[] else '{}'::text[] end,
    c.seller_price_ngn, null::numeric, cip.category, n.name,
    coalesce(cip.has_variants, false), coalesce(cip.variants, '[]'::jsonb),
    true, null::integer, coalesce(cip.units_sold, 0), null::numeric, 0::integer,
    cip.created_at, 'store', s.id, s.name, s.slug, coalesce(s.is_verified, false),
    array['China Import']::text[], true, null::numeric
  from china_import_dropship_catalog c
  join china_import_products cip on cip.id = c.china_import_product_id
  join stores s on s.id = c.seller_store_id
  left join niche_categories nc on nc.id = cip.category_id
  left join niches n on n.id = nc.niche_id
  where p_source_type = 'china_import'
    and c.china_import_product_id = p_source_id
    and c.seller_store_id = p_store_id
    and c.status = 'active'
    and cip.is_active
    and cip.air_shipping_customer_ngn is not null
    and cip.air_shipping_customer_ngn > 0
    and coalesce(c.seller_price_ngn, 0) > 0
    and coalesce(s.is_active, false)
    and not coalesce(s.is_blocked, false)
    and coalesce(s.marketplace_enabled, false)
  limit 1;
$$;

grant execute on function public.marketplace_unified_product(text,uuid,uuid) to anon, authenticated;
