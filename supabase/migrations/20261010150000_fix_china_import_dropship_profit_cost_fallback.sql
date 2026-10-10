-- Correct China Import dropship earnings when order_items.dropship_price was
-- stored as zero by the marketplace finalizer. Zero means "not populated" here;
-- use the catalog landed cost instead of reporting the whole sale as profit.
create or replace function public.record_china_import_dropship_earning(p_order_id uuid, p_order_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  oi public.order_items%rowtype;
  o public.orders%rowtype;
  c public.china_import_dropship_catalog%rowtype;
  s public.stores%rowtype;
  v_id uuid;
  v_cost numeric;
  v_revenue numeric;
  v_gross numeric;
  v_platform_fee numeric;
  v_net numeric;
begin
  select * into oi from public.order_items where id = p_order_item_id and order_id = p_order_id for update;
  if not found then raise exception 'Invalid seller order item %', p_order_item_id; end if;
  if oi.source_type <> 'china_import' or oi.source_id is null then return null; end if;

  select * into o from public.orders where id = p_order_id for update;
  select * into s from public.stores where id = o.store_id;

  select * into c
  from public.china_import_dropship_catalog
  where seller_store_id = o.store_id and china_import_product_id = oi.source_id
  order by updated_at desc limit 1;

  if not found then raise exception 'China Import catalog mapping missing for order item %', p_order_item_id; end if;

  v_cost := round(coalesce(nullif(oi.dropship_price, 0), c.supplier_cost_ngn + c.shipping_cost_ngn) * oi.quantity, 2);
  v_revenue := round(coalesce(oi.unit_price, oi.price_at_time) * oi.quantity, 2);
  v_gross := round(v_revenue - v_cost, 2);
  v_platform_fee := round(greatest(v_gross, 0) * coalesce(o.dropship_commission_rate, 0) / 100, 2);
  v_net := greatest(round(v_gross - v_platform_fee, 2), 0);

  insert into public.china_import_dropship_earnings (
    seller_store_id, seller_owner_id, seller_order_id, seller_order_item_id,
    china_import_product_id, quantity_sold, unit_cost_ngn,
    unit_selling_price_ngn, total_revenue_ngn, total_cost_ngn,
    gross_profit_ngn, platform_fee_ngn, net_profit_ngn
  )
  values (
    o.store_id, s.owner_id, o.id, oi.id, oi.source_id, oi.quantity,
    round(v_cost / nullif(oi.quantity, 0), 2),
    round(v_revenue / nullif(oi.quantity, 0), 2),
    v_revenue, v_cost, v_gross, v_platform_fee, v_net
  )
  on conflict (seller_order_item_id) do update set
    unit_cost_ngn = excluded.unit_cost_ngn,
    unit_selling_price_ngn = excluded.unit_selling_price_ngn,
    total_revenue_ngn = excluded.total_revenue_ngn,
    total_cost_ngn = excluded.total_cost_ngn,
    gross_profit_ngn = excluded.gross_profit_ngn,
    platform_fee_ngn = excluded.platform_fee_ngn,
    net_profit_ngn = excluded.net_profit_ngn
  returning id into v_id;

  return v_id;
end;
$$;

-- Recalculate existing China Import seller earnings using the corrected cost
-- fallback. The function upserts by seller_order_item_id and cannot duplicate rows.
do $$
declare
  r record;
begin
  for r in
    select oi.order_id, oi.id
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.source_type = 'china_import'
      and oi.source_id is not null
      and exists (
        select 1 from public.china_import_dropship_catalog c
        where c.seller_store_id = o.store_id
          and c.china_import_product_id = oi.source_id
      )
  loop
    perform public.record_china_import_dropship_earning(r.order_id, r.id);
  end loop;
end;
$$;