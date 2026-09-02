-- Capture manual bank-transfer sender name/bank (UI already collected this,
-- backend just wasn't storing it). Also adds get_import_analytics(), a
-- server-side aggregation RPC that fixes an Analytics undercount caused by
-- PostgREST's per-request row cap silently truncating raw-row fetches once
-- total orders passed 1000.

alter table china_import_orders
  add column if not exists manual_sender_name text,
  add column if not exists manual_sender_bank text;

alter table china_import_consolidation_bills
  add column if not exists manual_sender_name text,
  add column if not exists manual_sender_bank text;

create or replace function public.get_import_analytics(
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns jsonb
language sql
stable
as $function$
  with scoped_orders as (
    select o.*
    from china_import_orders o
    where (p_date_from is null or o.created_at >= p_date_from)
      and (p_date_to is null or o.created_at <= p_date_to)
  ),
  paid_orders as (
    select * from scoped_orders where payment_status = 'paid'
  ),
  paid_items as (
    select
      po.id as order_id,
      po.created_at,
      (item->>'id')::uuid as product_id,
      (item->>'quantity')::numeric as qty,
      (item->>'price_ngn')::numeric as price_ngn
    from paid_orders po,
         jsonb_array_elements(po.items) as item
    where item->>'id' is not null
  ),
  items_with_cost as (
    select
      pi.*,
      coalesce(p.cost_ngn, 0) as cost_ngn
    from paid_items pi
    left join china_import_products p on p.id = pi.product_id
  ),
  totals as (
    select
      coalesce(sum(price_ngn * qty), 0) as revenue_ngn,
      coalesce(sum(cost_ngn * qty), 0) as cost_ngn,
      coalesce(sum(qty), 0) as units_sold
    from items_with_cost
  ),
  daily as (
    select
      to_char(created_at, 'YYYY-MM-DD') as date,
      count(*) as orders,
      coalesce(sum(total_ngn), 0) as revenue_ngn
    from paid_orders
    group by 1
    order by 1
  ),
  payment_method as (
    select
      coalesce(payment_method, 'unknown') as method,
      count(*) as orders,
      coalesce(sum(total_ngn), 0) as revenue_ngn
    from scoped_orders
    group by 1
  ),
  delivery_type as (
    select
      coalesce(delivery_type, 'unknown') as type,
      count(*) as orders,
      coalesce(sum(total_ngn), 0) as revenue_ngn
    from scoped_orders
    group by 1
  ),
  status_breakdown as (
    select
      coalesce(status, 'unknown') as status,
      count(*) as count
    from scoped_orders
    group by 1
  )
  select jsonb_build_object(
    'orders_count', (select count(*) from paid_orders),
    'units_sold', (select units_sold from totals),
    'revenue_ngn', round((select revenue_ngn from totals)::numeric, 2),
    'cost_ngn', round((select cost_ngn from totals)::numeric, 2),
    'profit_ngn', round(((select revenue_ngn from totals) - (select cost_ngn from totals))::numeric, 2),
    'margin_pct', case when (select revenue_ngn from totals) > 0
      then round((((select revenue_ngn from totals) - (select cost_ngn from totals)) / (select revenue_ngn from totals) * 100)::numeric, 2)
      else 0 end,
    'daily_trend', coalesce((select jsonb_agg(jsonb_build_object('date', date, 'orders', orders, 'revenue_ngn', round(revenue_ngn::numeric, 2))) from daily), '[]'::jsonb),
    'payment_method_breakdown', coalesce((select jsonb_agg(jsonb_build_object('method', method, 'orders', orders, 'revenue_ngn', round(revenue_ngn::numeric, 2))) from payment_method), '[]'::jsonb),
    'delivery_type_breakdown', coalesce((select jsonb_agg(jsonb_build_object('type', type, 'orders', orders, 'revenue_ngn', round(revenue_ngn::numeric, 2))) from delivery_type), '[]'::jsonb),
    'status_breakdown', coalesce((select jsonb_agg(jsonb_build_object('status', status, 'count', count)) from status_breakdown), '[]'::jsonb)
  );
$function$;
