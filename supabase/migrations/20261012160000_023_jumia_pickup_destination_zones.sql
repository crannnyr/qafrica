-- Destination-zone mapping for Jumia pickup pricing.
-- Origin is fixed to Zone 1 (Lagos); each destination state must be mapped
-- to the zone assigned by the official Jumia rate card before pricing is enabled.

create table if not exists public.import_pickup_destination_zones (
  destination_state text primary key,
  destination_zone text not null
    check (destination_zone in ('Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5', 'Zone 6', 'Zone 7')),
  is_active boolean not null default true,
  source_note text,
  updated_at timestamptz not null default now()
);

create index if not exists import_pickup_destination_zones_zone_idx
  on public.import_pickup_destination_zones (destination_zone)
  where is_active;

alter table public.import_pickup_destination_zones enable row level security;

comment on table public.import_pickup_destination_zones is
  'Admin-managed destination state to Jumia zone mapping. Must be verified against the official Jumia rate card before activating pickup pricing.';
