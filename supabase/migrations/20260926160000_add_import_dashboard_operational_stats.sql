-- Add live operational KPIs to the import analytics payload used by the management dashboard.
-- This is intentionally a current snapshot; date range filters continue to apply
-- only to sales analytics.
create or replace function public.get_import_analytics(
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns jsonb
language sql
stable
as $function$
  with scoped_orders as (
    select o.* from china_import_orders o
    where (p_date_from is null or o.created_at >= p_date_from)
      and (p_date_to is null or o.created_at <= p_date_to)
  ),
  paid_orders as (select * from scoped_orders where payment_status = 'paid'),
  paid_items as (
    select po.id as order_id, po.created_at,
      (item->>'id')::uuid as product_id,
      (item->>'quantity')::numeric as qty,
      (item->>'price_ngn')::numeric as price_ngn
    from paid_orders po, jsonb_array_elements(po.items) as item
    where item->>'id' is not null
  ),
  items_with_cost as (
    select pi.*, coalesce(p.cost_ngn, 0) as cost_ngn
    from paid_items pi left join china_import_products p on p.id = pi.product_id
  ),
  totals as (
    select coalesce(sum(price_ngn * qty), 0) as revenue_ngn,
      coalesce(sum(cost_ngn * qty), 0) as cost_ngn,
      coalesce(sum(qty), 0) as units_sold
    from items_with_cost
  ),
  daily as (
    select to_char(created_at, 'YYYY-MM-DD') as date, count(*) as orders,
      coalesce(sum(total_ngn), 0) as revenue_ngn
    from paid_orders group by 1 order by 1
  ),
  payment_method as (
    select coalesce(payment_method, 'unknown') as method, count(*) as orders,
      coalesce(sum(total_ngn), 0) as revenue_ngn
    from scoped_orders group by 1
  ),
  delivery_type as (
    select coalesce(delivery_type, 'unknown') as type, count(*) as orders,
      coalesce(sum(total_ngn), 0) as revenue_ngn
    from scoped_orders group by 1
  ),
  status_breakdown as (
    select coalesce(status, 'unknown') as status, count(*) as count
    from scoped_orders group by 1
  ),
  live_ops as (
    select jsonb_build_object(
      'all_orders_count', (select count(*) from china_import_orders),
      'unpaid_orders_count', (select count(*) from china_import_orders where payment_status in ('unpaid', 'awaiting_confirmation') and lower(coalesce(status, '')) not in ('cancelled', 'canceled', 'refunded')),
      'unpaid_orders_value_ngn', (select coalesce(sum(total_ngn), 0) from china_import_orders where payment_status in ('unpaid', 'awaiting_confirmation') and lower(coalesce(status, '')) not in ('cancelled', 'canceled', 'refunded')),
      'units_awaiting_arrival', (select coalesce(sum(greatest(ordered_quantity - received_quantity, 0)), 0) from china_import_fulfillment_items where status not in ('delivered')),
      'inventory_units', (select coalesce(sum(quantity), 0) from china_import_inventory),
      'active_shipments_count', (select count(*) from china_import_shipments where status in ('ready_to_ship', 'shipped', 'in_transit', 'out_for_delivery')),
      'in_transit_shipments_count', (select count(*) from china_import_shipments where status = 'in_transit'),
      'pending_bills_count', (select count(*) from china_import_consolidation_bills where status in ('pending', 'awaiting_confirmation')),
      'pending_bills_value_ngn', (select coalesce(sum(amount_ngn), 0) from china_import_consolidation_bills where status in ('pending', 'awaiting_confirmation')),
      'pending_refunds_count', (select count(*) from order_refunds where status = 'pending'),
      'pending_refunds_value_ngn', (select coalesce(sum(amount), 0) from order_refunds where status = 'pending'),
      'active_batches_count', (select count(*) from import_batches where opened_at is not null and clearance_closed_at is null)
    ) as snapshot
  )
  select jsonb_build_object(
    'orders_count', (select count(*) from paid_orders),
    'units_sold', (select units_sold from totals),
    'revenue_ngn', round((select revenue_ngn from totals)::numeric, 2),
    'cost_ngn', round((select cost_ngn from totals)::numeric, 2),
    'profit_ngn', round(((select revenue_ngn from totals) - (select cost_ngn from totals))::numeric, 2),
    'margin_pct', case when (select revenue_ngn from totals) > 0 then round((((select revenue_ngn from totals) - (select cost_ngn from totals)) / (select revenue_ngn from totals) * 100)::numeric, 2) else 0 end,
    'daily_trend', coalesce((select jsonb_agg(jsonb_build_object('date', date, 'orders', orders, 'revenue_ngn', round(revenue_ngn::numeric, 2))) from daily), '[]'::jsonb),
    'payment_method_breakdown', coalesce((select jsonb_agg(jsonb_build_object('method', method, 'orders', orders, 'revenue_ngn', round(revenue_ngn::numeric, 2))) from payment_method), '[]'::jsonb),
    'delivery_type_breakdown', coalesce((select jsonb_agg(jsonb_build_object('type', type, 'orders', orders, 'revenue_ngn', round(revenue_ngn::numeric, 2))) from delivery_type), '[]'::jsonb),
    'status_breakdown', coalesce((select jsonb_agg(jsonb_build_object('status', status, 'count', count)) from status_breakdown), '[]'::jsonb),
    'live_operations', (select snapshot from live_ops)
  );
$function$;