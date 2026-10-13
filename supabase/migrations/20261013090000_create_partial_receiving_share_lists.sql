create table if not exists public.china_import_partial_receiving_shares (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  order_id uuid not null references public.china_import_orders(id) on delete cascade,
  order_code text not null,
  items jsonb not null default '[]'::jsonb,
  created_by uuid references public.import_admin_managers(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint china_import_partial_receiving_shares_items_array check (jsonb_typeof(items) = 'array')
);

create index if not exists idx_china_import_partial_receiving_shares_order
  on public.china_import_partial_receiving_shares(order_id);
create index if not exists idx_china_import_partial_receiving_shares_created_at
  on public.china_import_partial_receiving_shares(created_at desc);

alter table public.china_import_partial_receiving_shares enable row level security;
