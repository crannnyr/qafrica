-- Configurable Jumia pickup-station delivery pricing for China Import checkout.
-- Rates and package thresholds intentionally start unconfigured: published
-- example prices are not a complete rate card and package-size thresholds
-- have not been confirmed by Jumia. Do not activate until verified.

create table if not exists public.import_pickup_delivery_settings (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default false,
  classification_method text not null default 'weight_or_volume'
    check (classification_method in ('weight', 'volume', 'weight_or_volume')),
  updated_at timestamptz not null default now()
);

insert into public.import_pickup_delivery_settings (id, enabled, classification_method)
values (1, false, 'weight_or_volume')
on conflict (id) do nothing;

create table if not exists public.import_pickup_package_rules (
  package_size text primary key check (package_size in ('small', 'medium', 'large')),
  max_weight_grams numeric,
  max_volume_cbm numeric,
  is_configured boolean not null default false,
  updated_at timestamptz not null default now(),
  check (max_weight_grams is null or max_weight_grams > 0),
  check (max_volume_cbm is null or max_volume_cbm > 0)
);

create table if not exists public.import_pickup_delivery_rates (
  id uuid primary key default gen_random_uuid(),
  destination_state text not null,
  package_size text not null references public.import_pickup_package_rules(package_size),
  fee_ngn integer not null check (fee_ngn >= 0),
  is_active boolean not null default true,
  source_note text,
  updated_at timestamptz not null default now(),
  unique (destination_state, package_size)
);

create index if not exists import_pickup_delivery_rates_state_idx
  on public.import_pickup_delivery_rates (lower(destination_state), package_size)
  where is_active;

alter table public.import_pickup_delivery_settings enable row level security;
alter table public.import_pickup_package_rules enable row level security;
alter table public.import_pickup_delivery_rates enable row level security;

comment on table public.import_pickup_delivery_settings is
  'Feature switch and classification method for Jumia pickup delivery. Disabled until Jumia confirms rates and package thresholds.';
comment on table public.import_pickup_package_rules is
  'Admin-configured maximum parcel weight/volume thresholds. No default thresholds are seeded because Jumia thresholds are not verified.';
comment on table public.import_pickup_delivery_rates is
  'Verified Jumia pickup delivery fees by destination state and package size. Rates must be sourced and verified before activation.';

alter table public.china_import_orders
  add column if not exists jumia_pickup_fee_ngn integer not null default 0
    check (jumia_pickup_fee_ngn >= 0),
  add column if not exists pickup_package_size text
    check (pickup_package_size is null or pickup_package_size in ('small', 'medium', 'large')),
  add column if not exists pickup_package_weight_grams numeric,
  add column if not exists pickup_package_volume_cbm numeric,
  add column if not exists pickup_delivery_rate_state text;

comment on column public.china_import_orders.jumia_pickup_fee_ngn is
  'Snapshot of the separate Jumia pickup-station delivery fee; not the legacy to_qafrica per-item Jumia fee.';
