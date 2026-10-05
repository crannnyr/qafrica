alter table public.import_admin_credentials
  add column if not exists home_delivery_enabled boolean not null default false,
  add column if not exists pickup_station_delivery_enabled boolean not null default true,
  add column if not exists air_shipping_suggestion_threshold_ngn numeric not null default 500000;

update public.import_admin_credentials
set home_delivery_enabled = false,
    pickup_station_delivery_enabled = true,
    air_shipping_suggestion_threshold_ngn = 500000
where id = 1;
