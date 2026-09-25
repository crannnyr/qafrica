-- Fix cancellation/batch synchronization.
-- Cancelled orders remain for audit, but must never participate in closed-batch
-- breakdowns or future billing.

alter table public.china_import_refunds
  drop constraint if exists china_import_refunds_status_check;

alter table public.china_import_refunds
  add constraint china_import_refunds_status_check
  check (status in ('pending', 'submitted', 'paid', 'voided'));

drop function if exists public.get_batch_customer_breakdown(text);

create function public.get_batch_customer_breakdown(p_batch_key text)
returns table(
  customer_id uuid, customer_name text, first_order_at timestamptz, order_count integer,
  shipping_method text, order_id uuid, order_code text,
  product_id uuid, product_name text, product_image text, source_url text, ship_only boolean,
  variant_options jsonb, qty integer, unit_price_ngn numeric,
  others_in_batch integer, customers_in_open_batch integer, item_shipping_method text
)
language sql stable set search_path to 'public','pg_temp'
as $function$
  with batch_items as (
    select o.user_id customer_id,o.customer_name,o.shipping_method,o.id order_id,o.code order_code,
      o.created_at order_created_at,(item->>'id')::uuid product_id,item->>'name' product_name,
      nullif(item->>'image_url','') product_image,coalesce((item->>'quantity')::int,1) qty,
      coalesce((item->>'price_ngn')::numeric,0) unit_price_ngn,item->'variant_options' variant_options,
      coalesce(item->>'shipping_method',o.shipping_method) item_shipping_method
    from public.china_import_orders o,jsonb_array_elements(o.items) item
    where o.staged_at is not null and o.staged_at=p_batch_key::timestamptz
      and o.status not in ('cancelled','refunded') and item->>'id' is not null
  ),
  batch_product_customers as (
    select product_id,count(distinct customer_id) customers_in_batch from batch_items group by product_id
  ),
  open_batch_products as (
    select (item->>'id')::uuid product_id,count(distinct o.user_id) customers_in_open_batch
    from public.china_import_orders o,jsonb_array_elements(o.items) item
    where o.staged_at is null and o.payment_status='paid'
      and o.status not in ('cancelled','refunded') and item->>'id' is not null group by 1
  ),
  customer_totals as (
    select customer_id,min(order_created_at) first_order_at,count(distinct order_id) order_count
    from batch_items group by customer_id
  )
  select bi.customer_id,bi.customer_name,ct.first_order_at,ct.order_count::int,bi.shipping_method,
    bi.order_id,bi.order_code,bi.product_id,bi.product_name,coalesce(bi.product_image,p.image_url),
    p.source_url,coalesce(p.ship_only,false),bi.variant_options,bi.qty,bi.unit_price_ngn,
    greatest(coalesce(bpc.customers_in_batch,1)-1,0)::int,coalesce(obp.customers_in_open_batch,0)::int,
    bi.item_shipping_method
  from batch_items bi
  left join public.china_import_products p on p.id=bi.product_id
  left join batch_product_customers bpc on bpc.product_id=bi.product_id
  left join open_batch_products obp on obp.product_id=bi.product_id
  left join customer_totals ct on ct.customer_id=bi.customer_id
  order by ct.first_order_at asc nulls last,bi.customer_name asc,bi.product_name asc;
$function$;

revoke execute on function public.get_batch_customer_breakdown(text) from public,anon,authenticated;
grant execute on function public.get_batch_customer_breakdown(text) to service_role;

create or replace function public.reconcile_import_batch_after_order_cancel(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare
  v_batch_key text; v_customer_id uuid; v_bill_status text; v_bill_id uuid; v_bill_paid boolean := false;
begin
  select staged_at::text,user_id into v_batch_key,v_customer_id
  from public.china_import_orders where id=p_order_id;

  if v_batch_key is null or v_customer_id is null then
    return jsonb_build_object('success',true,'reconciled',false,'reason','order_not_in_closed_batch');
  end if;

  select s.status into v_bill_status
  from public.import_batch_bill_status s
  where s.batch_key=v_batch_key and s.kind='consolidation_shipping' and s.customer_id=v_customer_id;

  select b.id,(b.status='paid') into v_bill_id,v_bill_paid
  from public.china_import_consolidation_bills b
  where b.user_id=v_customer_id and b.kind='consolidation_shipping'
    and b.order_id in (
      select id from public.china_import_orders
      where staged_at=v_batch_key::timestamptz and user_id=v_customer_id
    )
  order by b.created_at desc limit 1;

  if v_bill_id is not null and not v_bill_paid then
    update public.china_import_consolidation_bills
      set status='cancelled',updated_at=now()
    where id=v_bill_id and status <> 'cancelled';
  end if;

  if v_bill_status='sent' and not v_bill_paid then
    update public.import_batch_bill_status
      set status='draft',sent_at=null,recipients_count=0
    where batch_key=v_batch_key and kind='consolidation_shipping' and customer_id=v_customer_id;
  end if;

  return jsonb_build_object(
    'success',true,'reconciled',true,'batch_key',v_batch_key,
    'customer_id',v_customer_id,'bill_reset',(v_bill_status='sent' and not v_bill_paid)
  );
end;
$function$;

revoke execute on function public.reconcile_import_batch_after_order_cancel(uuid) from public,anon,authenticated;
grant execute on function public.reconcile_import_batch_after_order_cancel(uuid) to service_role;

-- Repair VFHT8P from the failed cancellation attempt.
update public.china_import_orders
set status='cancelled',updated_at=now()
where code='VFHT8P' and status not in ('cancelled','refunded');

update public.china_import_consolidation_bills
set status='cancelled',updated_at=now()
where order_id=(select id from public.china_import_orders where code='VFHT8P')
  and kind='consolidation_shipping' and status <> 'cancelled';

update public.import_batch_bill_status
set status='draft',sent_at=null,recipients_count=0
where batch_key=(select staged_at::text from public.china_import_orders where code='VFHT8P')
  and kind='consolidation_shipping'
  and customer_id=(select user_id from public.china_import_orders where code='VFHT8P')
  and status='sent';

-- The failed cancellation ran twice and decremented units_sold twice.
update public.china_import_products
set units_sold=units_sold+1
where id='887d9696-d8dc-482e-b4da-789d112337ad';

-- Keep the newest refund attempt; void the older duplicate so it cannot be paid.
update public.china_import_refunds
set status='voided',
    refund_error='Duplicate cancellation attempt superseded by the later refund attempt.'
where id='9dce2eca-729e-4477-bc8b-401d3bd7c0b5'
  and status='pending';

select public.reconcile_import_batch_after_order_cancel(
  (select id from public.china_import_orders where code='VFHT8P')
);
