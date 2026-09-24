create or replace function public.create_china_import_shipment(
  p_order_id uuid,
  p_items jsonb,
  p_manager_id uuid default null,
  p_delivery_mode text default null,
  p_delivery_address jsonb default null,
  p_notes text default null
)
returns public.china_import_shipments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.china_import_orders%rowtype;
  v_item jsonb;
  v_fulfillment public.china_import_fulfillment_items%rowtype;
  v_qty integer;
  v_shipment public.china_import_shipments%rowtype;
  v_total integer := 0;
  v_available integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one fulfillment item is required';
  end if;

  select * into v_order
  from public.china_import_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status in ('cancelled','refunded') then
    raise exception 'Cancelled or refunded orders cannot be shipped';
  end if;

  if not exists (
    select 1 from public.china_import_consolidation_bills b
    where b.order_id = p_order_id
      and b.kind = 'consolidation_shipping'
      and b.status = 'paid'
  ) then
    raise exception 'Shipping bill is not paid for this order';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if not (v_item ? 'fulfillment_item_id') or not (v_item ? 'quantity') then
      raise exception 'Each shipment item needs fulfillment_item_id and quantity';
    end if;

    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Shipment quantities must be positive integers';
    end if;

    select * into v_fulfillment
    from public.china_import_fulfillment_items
    where id = (v_item->>'fulfillment_item_id')::uuid
      and order_id = p_order_id
    for update;

    if not found then
      raise exception 'Fulfillment item does not belong to this order';
    end if;

    v_available := v_fulfillment.received_quantity - v_fulfillment.allocated_quantity;
    if v_qty > v_available then
      raise exception 'Requested quantity exceeds available received quantity for %', v_fulfillment.product_name;
    end if;

    v_total := v_total + v_qty;
  end loop;

  insert into public.china_import_shipments (
    order_id, customer_id, batch_id, status, delivery_mode, delivery_address, notes, created_by
  )
  values (
    v_order.id, v_order.user_id, v_order.batch_id, 'draft',
    nullif(trim(p_delivery_mode), ''), p_delivery_address,
    nullif(trim(p_notes), ''), p_manager_id
  )
  returning * into v_shipment;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;

    select * into v_fulfillment
    from public.china_import_fulfillment_items
    where id = (v_item->>'fulfillment_item_id')::uuid
      and order_id = p_order_id
    for update;

    insert into public.china_import_shipment_items (shipment_id, fulfillment_item_id, quantity)
    values (v_shipment.id, v_fulfillment.id, v_qty);

    update public.china_import_fulfillment_items
    set allocated_quantity = allocated_quantity + v_qty,
        status = case
          when received_quantity <= allocated_quantity + v_qty then 'fully_allocated'
          when allocated_quantity + v_qty > 0 then 'partially_allocated'
          else status
        end,
        updated_at = now()
    where id = v_fulfillment.id;

    insert into public.china_import_fulfillment_events (
      shipment_id, fulfillment_item_id, event_type, status, location, note, metadata, created_by
    )
    values (
      v_shipment.id, v_fulfillment.id, 'allocated', 'draft', 'QAfrica HQ',
      nullif(trim(p_notes), ''),
      jsonb_build_object('quantity', v_qty, 'shipment_code', v_shipment.shipment_code),
      p_manager_id
    );
  end loop;

  insert into public.china_import_fulfillment_events (
    shipment_id, event_type, status, location, note, metadata, created_by
  )
  values (
    v_shipment.id, 'shipment_created', 'draft', 'QAfrica HQ',
    nullif(trim(p_notes), ''),
    jsonb_build_object('shipment_code', v_shipment.shipment_code, 'quantity', v_total),
    p_manager_id
  );

  return v_shipment;
end;
$$;

revoke all on function public.create_china_import_shipment(uuid,jsonb,uuid,text,jsonb,text) from public;
grant execute on function public.create_china_import_shipment(uuid,jsonb,uuid,text,jsonb,text) to service_role;
