-- Batch 2 (import-admin overhaul): delivery mode (home vs Jumia pickup
-- station) and saved-address linkage on china_import_orders. Per-item
-- shipping method needed no schema change — items is jsonb and each item
-- object now carries its own shipping_method key, handled entirely in the
-- china-import edge function (checkout-init action).

alter table public.china_import_orders
  add column delivery_mode text not null default 'home' check (delivery_mode in ('home', 'pickup_station')),
  add column pickup_station_id uuid references public.pickup_stations(id),
  add column pickup_station_name text,   -- snapshot at order time, survives station edits/removal
  add column pickup_station_address text,
  add column address_id uuid references public.import_customer_addresses(id); -- which saved address was used, if any

comment on column public.china_import_orders.delivery_mode is 'Only meaningful when delivery_type = to_me. home = shipped to delivery_address. pickup_station = customer collects from pickup_station_id.';
