-- Step 3: HQ receiving for China import fulfillment items.
-- Atomically records received quantity and an audit event without changing
-- the parent china_import_orders status.

create or replace function public.receive_china_import_fulfillment_item(
  p_fulfillment_item_id uuid,
  p_received_quantity integer,
  p_manager_id uuid default null,
  p_note text default null
)
returns public.china_import_fulfillment_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.china_import_fulfillment_items%rowtype;
  v_order_status text;
  v_now timestamptz := now();
begin
  if p_received_quantity is null or p_received_quantity < 0 then
    raise exception 'Received quantity must be zero or greater';
  end if;

  select fi.*
    into v_item
  from public.china_import_fulfillment_items fi
  where fi.id = p_fulfillment_item_id
  for update;

  if not found then
    raise exception 'Fulfillment item not found';
  end if;

  if not exists (
    select 1
    from public.china_import_consolidation_bills b
    where b.order_id = v_item.order_id
      and b.kind = 'consolidation_shipping'
      and b.status = 'paid'
  ) then
    raise exception 'This order does not have a paid consolidation shipping bill';
  end if;

  select o.status
    into v_order_status
  from public.china_import_orders o
  where o.id = v_item.order_id;

  if v_order_status is null then
    raise exception 'Parent import order not found';
  end if;

  if lower(v_order_status) in ('cancelled', 'canceled', 'refunded') then
    raise exception 'Cancelled or refunded orders cannot be received';
  end if;

  if p_received_quantity < v_item.received_quantity then
    raise exception 'Received quantity cannot be reduced from % to %', v_item.received_quantity, p_received_quantity;
  end if;

  if p_received_quantity > v_item.ordered_quantity then
    raise exception 'Received quantity cannot exceed ordered quantity of %', v_item.ordered_quantity;
  end if;

  if p_received_quantity = v_item.received_quantity then
    return v_item;
  end if;

  update public.china_import_fulfillment_items
  set received_quantity = p_received_quantity,
      received_at = coalesce(received_at, v_now),
      status = case
        when status = 'awaiting_arrival' then 'at_qafrica_hq'
        else status
      end,
      updated_at = v_now
  where id = v_item.id
  returning * into v_item;

  insert into public.china_import_fulfillment_events (
    fulfillment_item_id,
    event_type,
    status,
    location,
    note,
    metadata,
    created_by
  ) values (
    v_item.id,
    'received_at_hq',
    v_item.status,
    'QAfrica HQ',
    nullif(trim(coalesce(p_note, '')), ''),
    jsonb_build_object(
      'received_quantity', v_item.received_quantity,
      'ordered_quantity', v_item.ordered_quantity
    ),
    p_manager_id
  );

  return v_item;
end;
$$;

revoke all on function public.receive_china_import_fulfillment_item(uuid, integer, uuid, text) from public;
grant execute on function public.receive_china_import_fulfillment_item(uuid, integer, uuid, text) to service_role;
