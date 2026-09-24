create or replace function public.update_china_import_shipment_status(
  p_shipment_id uuid,
  p_status text,
  p_manager_id uuid default null,
  p_carrier_name text default null,
  p_tracking_number text default null,
  p_tracking_url text default null,
  p_waybill_url text default null,
  p_delivery_mode text default null,
  p_note text default null
)
returns public.china_import_shipments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shipment public.china_import_shipments%rowtype;
  v_item record;
  v_now timestamptz := now();
  v_event_type text;
begin
  if p_status not in (
    'draft',
    'ready_to_ship',
    'shipped',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'cancelled'
  ) then
    raise exception 'Invalid shipment status';
  end if;

  select *
  into v_shipment
  from public.china_import_shipments
  where id = p_shipment_id
  for update;

  if not found then
    raise exception 'Shipment not found';
  end if;

  if p_status = 'ready_to_ship' then
    if v_shipment.status not in ('draft', 'ready_to_ship') then
      raise exception 'Shipment cannot be marked ready from its current status';
    end if;

  elsif p_status = 'shipped' then
    if v_shipment.status not in ('draft', 'ready_to_ship') then
      raise exception 'Only draft or ready shipments can be dispatched';
    end if;

    for v_item in
      select
        si.quantity,
        fi.id,
        fi.received_quantity,
        fi.allocated_quantity,
        fi.shipped_quantity
      from public.china_import_shipment_items si
      join public.china_import_fulfillment_items fi
        on fi.id = si.fulfillment_item_id
      where si.shipment_id = v_shipment.id
      for update of fi
    loop
      if v_item.shipped_quantity + v_item.quantity > v_item.allocated_quantity
         or v_item.shipped_quantity + v_item.quantity > v_item.received_quantity then
        raise exception 'Shipment quantity exceeds available allocation';
      end if;

      update public.china_import_fulfillment_items
      set
        shipped_quantity = shipped_quantity + v_item.quantity,
        status = case
          when shipped_quantity + v_item.quantity >= allocated_quantity then 'shipped'
          else 'partially_shipped'
        end,
        updated_at = v_now
      where id = v_item.id;

      insert into public.china_import_fulfillment_events (
        shipment_id,
        fulfillment_item_id,
        event_type,
        status,
        location,
        note,
        metadata,
        created_by
      )
      values (
        v_shipment.id,
        v_item.id,
        'shipped',
        'shipped',
        'QAfrica HQ',
        nullif(trim(p_note), ''),
        jsonb_build_object(
          'quantity', v_item.quantity,
          'shipment_code', v_shipment.shipment_code
        ),
        p_manager_id
      );
    end loop;

  elsif p_status = 'in_transit' then
    if v_shipment.status <> 'shipped' then
      raise exception 'Shipment must be shipped before in transit';
    end if;

  elsif p_status = 'out_for_delivery' then
    if v_shipment.status <> 'in_transit' then
      raise exception 'Shipment must be in transit before out for delivery';
    end if;

  elsif p_status = 'delivered' then
    if v_shipment.status <> 'out_for_delivery' then
      raise exception 'Shipment must be out for delivery before delivery';
    end if;

    for v_item in
      select
        si.quantity,
        fi.id,
        fi.shipped_quantity,
        fi.delivered_quantity
      from public.china_import_shipment_items si
      join public.china_import_fulfillment_items fi
        on fi.id = si.fulfillment_item_id
      where si.shipment_id = v_shipment.id
      for update of fi
    loop
      if v_item.delivered_quantity + v_item.quantity > v_item.shipped_quantity then
        raise exception 'Delivered quantity cannot exceed shipped quantity';
      end if;

      update public.china_import_fulfillment_items
      set
        delivered_quantity = delivered_quantity + v_item.quantity,
        status = case
          when delivered_quantity + v_item.quantity >= ordered_quantity then 'delivered'
          when delivered_quantity + v_item.quantity > 0 then 'partially_delivered'
          else status
        end,
        updated_at = v_now
      where id = v_item.id;

      insert into public.china_import_fulfillment_events (
        shipment_id,
        fulfillment_item_id,
        event_type,
        status,
        location,
        note,
        metadata,
        created_by
      )
      values (
        v_shipment.id,
        v_item.id,
        'delivered',
        'delivered',
        'Customer',
        nullif(trim(p_note), ''),
        jsonb_build_object(
          'quantity', v_item.quantity,
          'shipment_code', v_shipment.shipment_code
        ),
        p_manager_id
      );
    end loop;

  elsif p_status = 'cancelled' then
    if v_shipment.status in ('delivered', 'cancelled') then
      raise exception 'Shipment cannot be cancelled now';
    end if;

    if v_shipment.status not in ('draft', 'ready_to_ship') then
      raise exception 'Only unshipped shipments can be cancelled';
    end if;

    for v_item in
      select
        si.quantity,
        fi.id,
        fi.allocated_quantity
      from public.china_import_shipment_items si
      join public.china_import_fulfillment_items fi
        on fi.id = si.fulfillment_item_id
      where si.shipment_id = v_shipment.id
      for update of fi
    loop
      update public.china_import_fulfillment_items
      set
        allocated_quantity = greatest(0, allocated_quantity - v_item.quantity),
        status = case
          when greatest(0, allocated_quantity - v_item.quantity) = 0 then 'at_qafrica_hq'
          when received_quantity <= greatest(0, allocated_quantity - v_item.quantity) then 'fully_allocated'
          else 'partially_allocated'
        end,
        updated_at = v_now
      where id = v_item.id;
    end loop;
  end if;

  v_event_type := case
    when p_status = 'shipped' then 'shipped'
    when p_status = 'in_transit' then 'in_transit'
    when p_status = 'out_for_delivery' then 'out_for_delivery'
    when p_status = 'delivered' then 'delivered'
    when p_status = 'cancelled' then 'cancelled'
    else 'note'
  end;

  update public.china_import_shipments
  set
    status = p_status,
    carrier_name = coalesce(nullif(trim(p_carrier_name), ''), carrier_name),
    tracking_number = coalesce(nullif(trim(p_tracking_number), ''), tracking_number),
    tracking_url = coalesce(nullif(trim(p_tracking_url), ''), tracking_url),
    waybill_url = coalesce(nullif(trim(p_waybill_url), ''), waybill_url),
    delivery_mode = coalesce(nullif(trim(p_delivery_mode), ''), delivery_mode),
    shipped_at = case
      when p_status = 'shipped' then coalesce(shipped_at, v_now)
      else shipped_at
    end,
    delivered_at = case
      when p_status = 'delivered' then coalesce(delivered_at, v_now)
      else delivered_at
    end,
    updated_at = v_now
  where id = v_shipment.id
  returning * into v_shipment;

  if p_status in ('in_transit', 'out_for_delivery', 'delivered', 'cancelled') then
    insert into public.china_import_fulfillment_events (
      shipment_id,
      event_type,
      status,
      location,
      note,
      metadata,
      created_by
    )
    values (
      v_shipment.id,
      v_event_type,
      p_status,
      case when p_status = 'delivered' then 'Customer' else 'Nigeria' end,
      nullif(trim(p_note), ''),
      jsonb_build_object('shipment_code', v_shipment.shipment_code),
      p_manager_id
    );
  end if;

  return v_shipment;
end;
$$;

revoke all on function public.update_china_import_shipment_status(
  uuid, text, uuid, text, text, text, text, text, text
) from public;

grant execute on function public.update_china_import_shipment_status(
  uuid, text, uuid, text, text, text, text, text, text
) to service_role;
