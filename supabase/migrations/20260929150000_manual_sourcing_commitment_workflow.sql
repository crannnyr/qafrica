-- Manual sourcing release workflow.
-- Payment makes an order eligible; it does NOT automatically commit it to China sourcing.
-- Admin explicitly commits paid lines. Committed lines can then be marked purchased.

create or replace function public.prepare_paid_sourcing(p_batch_key text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_paid_customers integer := 0;
  v_waiting_customers integer := 0;
  v_committed_lines integer := 0;
begin
  if p_batch_key is null or btrim(p_batch_key) = '' then
    return jsonb_build_object('error', 'Missing batch key', 'status', 400);
  end if;

  select count(distinct o.user_id)::integer into v_paid_customers
  from public.china_import_orders o
  where o.staged_at = p_batch_key::timestamptz
    and o.user_id is not null
    and o.status not in ('cancelled', 'refunded')
    and exists (
      select 1 from public.china_import_consolidation_bills b
      where b.order_id = o.id and b.user_id = o.user_id
        and b.kind = 'consolidation_shipping' and b.status = 'paid'
    );

  select count(distinct o.user_id)::integer into v_waiting_customers
  from public.china_import_orders o
  where o.staged_at = p_batch_key::timestamptz
    and o.user_id is not null
    and o.status not in ('cancelled', 'refunded')
    and not exists (
      select 1 from public.china_import_consolidation_bills b
      where b.order_id = o.id and b.user_id = o.user_id
        and b.kind = 'consolidation_shipping' and b.status = 'paid'
    );

  select count(*)::integer into v_committed_lines
  from public.import_sourcing_allocations a
  where a.batch_key = p_batch_key and a.status <> 'cancelled';

  return jsonb_build_object(
    'batch_key', p_batch_key,
    'new_allocations', 0,
    'customers_added', 0,
    'paid_customers', v_paid_customers,
    'waiting_payment_customers', v_waiting_customers,
    'committed_lines', v_committed_lines,
    'requires_manual_commit', true
  );
end;
$$;

grant execute on function public.prepare_paid_sourcing(text) to service_role;

create or replace function public.commit_paid_sourcing_line(
  p_batch_key text,
  p_order_id uuid,
  p_product_id uuid,
  p_variant_options jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_order public.china_import_orders%rowtype;
  v_qty integer;
  v_customer uuid;
  v_id uuid;
begin
  if p_batch_key is null or p_order_id is null or p_product_id is null then
    raise exception 'Batch, order and product are required';
  end if;

  select * into v_order
  from public.china_import_orders
  where id = p_order_id and staged_at = p_batch_key::timestamptz
  for update;

  if not found then raise exception 'Order is not in this batch'; end if;
  if v_order.user_id is null then raise exception 'Order has no customer'; end if;
  if v_order.status in ('cancelled', 'refunded', 'shipped_and_closed', 'clearance_and_closed', 'received') then
    raise exception 'Order is no longer eligible for sourcing';
  end if;

  if not exists (
    select 1 from public.china_import_consolidation_bills b
    where b.order_id = v_order.id and b.user_id = v_order.user_id
      and b.kind = 'consolidation_shipping' and b.status = 'paid'
  ) then
    raise exception 'Customer has not paid the consolidation and shipping bill';
  end if;

  select greatest(coalesce((item->>'quantity')::integer, 0), 0)
  into v_qty
  from jsonb_array_elements(v_order.items) item
  where (item->>'id')::uuid = p_product_id
    and md5(coalesce(item->'variant_options', '{}'::jsonb)::text) = md5(coalesce(p_variant_options, '{}'::jsonb)::text)
  limit 1;

  if coalesce(v_qty, 0) <= 0 then raise exception 'Product line was not found on the order'; end if;

  insert into public.import_sourcing_allocations(
    batch_key, order_id, customer_id, product_id, variant_options, quantity, status
  ) values (
    p_batch_key, v_order.id, v_order.user_id, p_product_id,
    coalesce(p_variant_options, '{}'::jsonb), v_qty, 'committed'
  )
  on conflict (batch_key, order_id, product_id, variant_key)
  do update set updated_at = now()
  returning id into v_id;

  return jsonb_build_object('success', true, 'allocation_id', v_id, 'quantity', v_qty, 'status', 'committed');
end;
$$;

grant execute on function public.commit_paid_sourcing_line(text, uuid, uuid, jsonb) to service_role;

grant execute on function public.get_paid_sourcing_allocations(text) to anon, authenticated, service_role;
