-- Import fulfillment foundation.
-- Step 1 only: schema foundation for item-level receiving, shipment tracking,
-- and fulfillment events. No existing order statuses, billing, UI, or emails
-- are changed by this migration.

create table if not exists public.china_import_fulfillment_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references public.china_import_orders(id) on delete cascade,
  order_item_index integer not null,
  product_id uuid
    references public.china_import_products(id) on delete set null,
  product_name text not null,
  image_url text,
  variant_options jsonb not null default '{}'::jsonb,
  item_snapshot jsonb not null default '{}'::jsonb,
  ordered_quantity integer not null,
  received_quantity integer not null default 0,
  allocated_quantity integer not null default 0,
  shipped_quantity integer not null default 0,
  delivered_quantity integer not null default 0,
  status text not null default 'awaiting_arrival',
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint china_import_fulfillment_items_order_line_unique
    unique (order_id, order_item_index),

  constraint china_import_fulfillment_items_order_item_index_check
    check (order_item_index >= 0),

  constraint china_import_fulfillment_items_ordered_qty_check
    check (ordered_quantity > 0),

  constraint china_import_fulfillment_items_received_qty_check
    check (received_quantity >= 0),

  constraint china_import_fulfillment_items_allocated_qty_check
    check (allocated_quantity >= 0 and allocated_quantity <= received_quantity),

  constraint china_import_fulfillment_items_shipped_qty_check
    check (shipped_quantity >= 0 and shipped_quantity <= allocated_quantity),

  constraint china_import_fulfillment_items_delivered_qty_check
    check (delivered_quantity >= 0 and delivered_quantity <= shipped_quantity),

  constraint china_import_fulfillment_items_status_check
    check (
      status = any (array[
        'awaiting_arrival',
        'at_qafrica_hq',
        'partially_allocated',
        'fully_allocated',
        'partially_shipped',
        'shipped',
        'partially_delivered',
        'delivered'
      ])
    )
);

create index if not exists idx_china_import_fulfillment_items_order
  on public.china_import_fulfillment_items(order_id);

create index if not exists idx_china_import_fulfillment_items_status
  on public.china_import_fulfillment_items(status);

create index if not exists idx_china_import_fulfillment_items_product
  on public.china_import_fulfillment_items(product_id);

create table if not exists public.china_import_shipments (
  id uuid primary key default gen_random_uuid(),
  shipment_code text not null
    default ('QAF-SHP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  order_id uuid not null
    references public.china_import_orders(id) on delete cascade,
  customer_id uuid
    references public.customers(id) on delete set null,
  batch_id uuid
    references public.import_batches(id) on delete set null,
  status text not null default 'draft',
  delivery_mode text,
  carrier_name text,
  tracking_number text,
  tracking_url text,
  waybill_url text,
  delivery_address jsonb,
  notes text,
  created_by uuid
    references public.import_admin_managers(id) on delete set null,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint china_import_shipments_code_unique
    unique (shipment_code),

  constraint china_import_shipments_status_check
    check (
      status = any (array[
        'draft',
        'ready_to_ship',
        'shipped',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'cancelled'
      ])
    )
);

create index if not exists idx_china_import_shipments_order
  on public.china_import_shipments(order_id);

create index if not exists idx_china_import_shipments_customer
  on public.china_import_shipments(customer_id);

create index if not exists idx_china_import_shipments_batch
  on public.china_import_shipments(batch_id);

create index if not exists idx_china_import_shipments_status
  on public.china_import_shipments(status);

create table if not exists public.china_import_shipment_items (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null
    references public.china_import_shipments(id) on delete cascade,
  fulfillment_item_id uuid not null
    references public.china_import_fulfillment_items(id) on delete restrict,
  quantity integer not null,
  created_at timestamptz not null default now(),

  constraint china_import_shipment_items_unique_line
    unique (shipment_id, fulfillment_item_id),

  constraint china_import_shipment_items_quantity_check
    check (quantity > 0)
);

create index if not exists idx_china_import_shipment_items_shipment
  on public.china_import_shipment_items(shipment_id);

create index if not exists idx_china_import_shipment_items_fulfillment
  on public.china_import_shipment_items(fulfillment_item_id);

create table if not exists public.china_import_fulfillment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid
    references public.china_import_shipments(id) on delete cascade,
  fulfillment_item_id uuid
    references public.china_import_fulfillment_items(id) on delete cascade,
  event_type text not null,
  status text,
  location text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid
    references public.import_admin_managers(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint china_import_fulfillment_events_target_check
    check (shipment_id is not null or fulfillment_item_id is not null),

  constraint china_import_fulfillment_events_type_check
    check (
      event_type = any (array[
        'received_at_hq',
        'allocated',
        'shipment_created',
        'shipped',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'note'
      ])
    )
);

create index if not exists idx_china_import_fulfillment_events_shipment
  on public.china_import_fulfillment_events(shipment_id);

create index if not exists idx_china_import_fulfillment_events_item
  on public.china_import_fulfillment_events(fulfillment_item_id);

create index if not exists idx_china_import_fulfillment_events_created_at
  on public.china_import_fulfillment_events(created_at desc);

-- Keep these tables closed to direct client access until the management and
-- customer-facing policies are implemented in a later step. Service-role
-- backend operations are unaffected.
alter table public.china_import_fulfillment_items enable row level security;
alter table public.china_import_shipments enable row level security;
alter table public.china_import_shipment_items enable row level security;
alter table public.china_import_fulfillment_events enable row level security;
