-- Batch 1 (import-admin overhaul): Jumia pickup stations synced from the
-- Optimal Supabase project, and a per-customer address book scoped to
-- import customers only.

create extension if not exists pg_trgm;

create table public.pickup_stations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid unique, -- id of the matching row in Optimal's public.pickup_stations, for upsert-on-sync
  name text not null,
  state text not null,
  address text not null,
  landmark text,
  latitude numeric not null,
  longitude numeric not null,
  is_active boolean not null default true,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index pickup_stations_state_idx on public.pickup_stations (state) where is_active;
create index pickup_stations_name_trgm_idx on public.pickup_stations using gin (name gin_trgm_ops);

alter table public.pickup_stations enable row level security;

-- Public read of active stations (checkout needs this for the searchable picker)
create policy "pickup_stations_public_read" on public.pickup_stations
  for select using (is_active = true);

comment on table public.pickup_stations is 'Jumia pickup stations synced from the Optimal Supabase project (public.pickup_stations there). Used by the import checkout for delivery-method selection. source_id is the row id in Optimal, used to upsert on each sync run.';

create table public.import_customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text, -- e.g. "House", "Workplace"
  name text not null,
  phone text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  landmark text,
  is_default boolean not null default false,
  preferred_pickup_station_id uuid references public.pickup_stations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index import_customer_addresses_customer_idx on public.import_customer_addresses (customer_id);

-- Only one default address per customer
create unique index import_customer_addresses_one_default_idx
  on public.import_customer_addresses (customer_id)
  where is_default;

alter table public.import_customer_addresses enable row level security;
-- No public policies: this table is written/read exclusively through the
-- china-import edge function (service role), which validates customer_id
-- the same way every other customer-scoped action in that function does.

comment on table public.import_customer_addresses is 'Address book for import (china_import) customers only — separate from the marketplace''s customer_addresses table, which belongs to the unrelated store checkout. Each address can carry a preferred Jumia pickup station.';
