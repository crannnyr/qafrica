create table if not exists public.china_import_inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.china_import_products(id) on delete cascade,
  quantity integer not null default 0,
  updated_by uuid references public.import_admin_managers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint china_import_inventory_product_unique unique (product_id),
  constraint china_import_inventory_quantity_check check (quantity >= 0)
);

create index if not exists idx_china_import_inventory_product
  on public.china_import_inventory(product_id);

alter table public.china_import_inventory enable row level security;
revoke all on table public.china_import_inventory from anon, authenticated;

create or replace function public.receive_china_import_fulfillment_item_from_stock(
  p_fulfillment_item_id uuid,
  p_manager_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.china_import_fulfillment_items%rowtype;
  v_inventory public.china_import_inventory%rowtype;
  v_order_status text;
  v_now timestamptz := now();
  v_remaining integer;
  v_received_now integer;
  v_stock_before integer;
begin
  select fi.* into v_item
  from public.china_import_fulfillment_items fi
  where fi.id = p_fulfillment_item_id
  for update;

  if not found then raise exception 'Fulfillment item not found'; end if;
  if v_item.product_id is null then raise exception 'This fulfillment item is not linked to an inventory product'; end if;

  if not exists (
    select 1 from public.china_import_consolidation_bills b
    where b.order_id = v_item.order_id
      and b.kind = 'consolidation_shipping'
      and b.status = 'paid'
  ) then raise exception 'This order does not have a paid consolidation shipping bill'; end if;

  select o.status into v_order_status
  from public.china_import_orders o where o.id = v_item.order_id;

  if v_order_status is null then raise exception 'Parent import order not found'; end if;
  if lower(v_order_status) in ('cancelled', 'canceled', 'refunded') then
    raise exception 'Cancelled or refunded orders cannot be received';
  end if;

  v_remaining := v_item.ordered_quantity - v_item.received_quantity;
  if v_remaining <= 0 then
    return jsonb_build_object(
      'success', true,
      'received_now', 0,
      'stock_remaining', coalesce((select quantity from public.china_import_inventory where product_id = v_item.product_id), 0),
      'fulfillment_item', to_jsonb(v_item)
    );
  end if;

  select i.* into v_inventory
  from public.china_import_inventory i
  where i.product_id = v_item.product_id
  for update;

  if not found then raise exception 'No inventory has been registered for this product'; end if;
  if v_inventory.quantity <= 0 then raise exception 'No stock available for this product'; end if;

  v_stock_before := v_inventory.quantity;
  v_received_now := least(v_remaining, v_inventory.quantity);

  update public.china_import_inventory
  set quantity = quantity - v_received_now,
      updated_by = p_manager_id,
      updated_at = v_now
  where id = v_inventory.id;

  update public.china_import_fulfillment_items
  set received_quantity = received_quantity + v_received_now,
      received_at = coalesce(received_at, v_now),
      status = 'at_qafrica_hq',
      updated_at = v_now
  where id = v_item.id
  returning * into v_item;

  insert into public.china_import_fulfillment_events (
    fulfillment_item_id, event_type, status, location, note, metadata, created_by
  ) values (
    v_item.id, 'received_at_hq', v_item.status, 'QAfrica HQ',
    nullif(trim(coalesce(p_note, '')), ''),
    jsonb_build_object(
      'received_quantity', v_item.received_quantity,
      'received_now', v_received_now,
      'ordered_quantity', v_item.ordered_quantity,
      'stock_before', v_stock_before,
      'stock_after', v_stock_before - v_received_now
    ),
    p_manager_id
  );

  return jsonb_build_object(
    'success', true,
    'received_now', v_received_now,
    'stock_remaining', v_stock_before - v_received_now,
    'fulfillment_item', to_jsonb(v_item)
  );
end;
$$;

revoke all on function public.receive_china_import_fulfillment_item_from_stock(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.receive_china_import_fulfillment_item_from_stock(uuid, uuid, text) to service_role;
