create or replace function public.marketplace_unified_products(
  p_tab text default 'for_you',
  p_niche text default null,
  p_category text default null,
  p_search text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table(
  id text, source_id uuid, source_type text, name text, image text, image2 text,
  price numeric, compare_at_price numeric, discount_pct integer, category text,
  niche text, has_variants boolean, store_id uuid, store_name text, store_slug text,
  store_verified boolean, sold integer, rating numeric, review_count integer,
  created_at timestamptz, is_china_import boolean, flight_shipping_cost_ngn numeric,
  tags text[]
)
language sql stable security definer set search_path = public
as $$
  with ok_stores as (select marketplace_store_ids() as id),
  normal_products as (
    select 'product:' || p.id::text, p.id, 'product'::text, p.name, p.images[1], p.images[2],
      p.selling_price, p.compare_at_price,
      case when p.compare_at_price > p.selling_price and p.compare_at_price > 0
        then round((1 - p.selling_price / p.compare_at_price) * 100)::int else 0 end,
      p.category, p.niche, coalesce(p.has_variants, false), p.store_id, s.name, s.slug,
      coalesce(s.is_verified, false),
      coalesce((select sum(oi.quantity) from order_items oi join orders o on o.id = oi.order_id
        where oi.product_id = p.id and o.payment_status = 'paid'), 0)::int,
      (select round(avg(r.rating)::numeric, 1) from reviews r where r.product_id = p.id and r.is_approved),
      (select count(*) from reviews r where r.product_id = p.id and r.is_approved)::int,
      p.created_at, false, null::numeric, coalesce(p.tags, '{}'::text[])
    from products p join stores s on s.id = p.store_id
    where p.store_id in (select id from ok_stores) and p.is_active
      and not coalesce(p.is_out_of_stock, false)
      and (p.has_variants or coalesce(p.stock_quantity, 1) > 0)
      and coalesce(array_length(p.images, 1), 0) > 0 and p.selling_price > 0
      and (p_niche is null or p.niche = p_niche)
      and (p_category is null or lower(trim(p.category)) = lower(trim(p_category)))
      and (p_search is null or p.name ilike '%' || p_search || '%' or p.category ilike '%' || p_search || '%'
        or exists (select 1 from unnest(coalesce(p.tags, '{}')) t where t ilike '%' || p_search || '%'))
      and (p_tab <> 'deals' or p.compare_at_price > p.selling_price)
  ),
  china_products as (
    select 'china_import:' || cip.id::text, cip.id, 'china_import'::text, cip.name,
      coalesce(cip.image_urls[1], cip.image_url), cip.image_urls[2], cip.price_ngn, null::numeric, 0::int,
      cip.category, cip.parent_category, coalesce(cip.has_variants, false), null::uuid,
      'QAFRICA'::text, 'qafrica'::text, true, coalesce(cip.units_sold, 0), null::numeric, 0::int,
      cip.created_at, true, cip.flight_shipping_cost_ngn, array['China Import']::text[]
    from china_import_products cip
    where cip.is_active and cip.flight_shipping_cost_ngn is not null and cip.flight_shipping_cost_ngn > 0
      and coalesce(cip.price_ngn, 0) > 0 and coalesce(cip.image_urls[1], cip.image_url) is not null
      and (p_niche is null or cip.parent_category = p_niche)
      and (p_category is null or lower(trim(cip.category)) = lower(trim(p_category)))
      and (p_search is null or cip.name ilike '%' || p_search || '%' or cip.category ilike '%' || p_search || '%')
      and p_tab <> 'deals'
  ),
  combined as (select * from normal_products union all select * from china_products)
  select * from combined c
  order by
    case when p_tab = 'new' then extract(epoch from c.created_at) end desc nulls last,
    case when p_tab = 'bestsellers' then c.sold end desc nulls last,
    case when p_tab = 'deals' then c.discount_pct end desc nulls last,
    c.is_china_import asc, c.created_at desc
  limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0);
$$;

grant execute on function public.marketplace_unified_products(text,text,text,text,integer,integer) to anon, authenticated;
