-- Batch 4a: customer default delivery preference (Home vs Jumia pickup +
-- default station), read by the import checkout to decide what opens by
-- default, and settable from the import dashboard's Settings sheet.

alter table public.customers
  add column import_default_delivery_mode text not null default 'pickup_station'
    check (import_default_delivery_mode in ('home', 'pickup_station')),
  add column import_default_pickup_station_id uuid references public.pickup_stations(id);

comment on column public.customers.import_default_delivery_mode is 'Import checkout only. Which delivery mode opens by default at checkout. Defaults to pickup_station (Jumia) — the fastest/cheapest option — until the customer sets a preference from Settings.';
comment on column public.customers.import_default_pickup_station_id is 'Import checkout only. Pre-selected when import_default_delivery_mode = pickup_station.';
