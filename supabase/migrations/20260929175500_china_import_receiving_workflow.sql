-- China import receiving workflow: product/receipt barcode receiving with audited quantities.
create table if not exists public.china_import_receiving_events (
  id uuid primary key default gen_random_uuid(),
  invoice_item_id uuid null references public.china_import_supplier_invoice_items(id) on delete restrict,
  product_id uuid not null references public.china_import_products(id) on delete restrict,
  variant_options jsonb not null default '{}'::jsonb,
  quantity_received integer not null check (quantity_received > 0),
  source text not null check (source in ('receiving_code','product_barcode','manual')),
  manager_id uuid not null references public.import_admin_managers(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists china_import_receiving_events_invoice_item_idx
  on public.china_import_receiving_events(invoice_item_id);
create index if not exists china_import_receiving_events_product_idx
  on public.china_import_receiving_events(product_id);

alter table public.china_import_receiving_events enable row level security;
revoke all on public.china_import_receiving_events from public, anon, authenticated;

create or replace function public.china_import_receive_invoice_item(
  p_invoice_item_id uuid,
  p_quantity integer,
  p_manager_id uuid,
  p_source text default 'receiving_code'
)
returns table(
  receiving_event_id uuid,
  invoice_item_id uuid,
  product_id uuid,
  variant_options jsonb,
  expected_quantity integer,
  previously_received integer,
  received_now integer,
  remaining_quantity integer,
  inventory_quantity integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.china_import_supplier_invoice_items%rowtype;
  v_received integer;
  v_remaining integer;
  v_inventory public.china_import_inventory%rowtype;
  v_event_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Received quantity must be greater than zero';
  end if;
  if p_manager_id is null then
    raise exception 'Manager is required';
  end if;
  if p_source not in ('receiving_code','product_barcode','manual') then
    raise exception 'Invalid receiving source';
  end if;

  select * into v_item
  from public.china_import_supplier_invoice_items
  where id = p_invoice_item_id
  for update;

  if not found then
    raise exception 'Receiving item not found';
  end if;
  if v_item.product_id is null then
    raise exception 'Receiving item has no product';
  end if;

  select coalesce(sum(e.quantity_received), 0)::integer
    into v_received
  from public.china_import_receiving_events e
  where e.invoice_item_id = p_invoice_item_id;

  v_remaining := greatest(v_item.quantity - v_received, 0);
  if p_quantity > v_remaining then
    raise exception 'Cannot receive % units. Only % remain on this receiving item.', p_quantity, v_remaining;
  end if;

  select * into v_inventory
  from public.add_china_import_inventory_stock(
    v_item.product_id,
    coalesce(v_item.variant_options, '{}'::jsonb),
    p_quantity,
    p_manager_id
  );

  insert into public.china_import_receiving_events(
    invoice_item_id, product_id, variant_options, quantity_received, source, manager_id
  )
  values (
    p_invoice_item_id, v_item.product_id, coalesce(v_item.variant_options, '{}'::jsonb),
    p_quantity, p_source, p_manager_id
  )
  returning id into v_event_id;

  return query
  select
    v_event_id,
    p_invoice_item_id,
    v_item.product_id,
    coalesce(v_item.variant_options, '{}'::jsonb),
    v_item.quantity,
    v_received,
    p_quantity,
    greatest(v_remaining - p_quantity, 0),
    v_inventory.quantity;
end;
$$;

revoke all on function public.china_import_receive_invoice_item(uuid, integer, uuid, text) from public, anon, authenticated;
grant execute on function public.china_import_receive_invoice_item(uuid, integer, uuid, text) to service_role;
