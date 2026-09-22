create table if not exists public.import_customer_carts (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.import_customer_carts enable row level security;

revoke all on table public.import_customer_carts from anon, authenticated;
grant select, insert, update, delete on table public.import_customer_carts to authenticated;

drop policy if exists "Customers can view their import cart" on public.import_customer_carts;
create policy "Customers can view their import cart"
on public.import_customer_carts
for select
to authenticated
using ((select auth.uid()) = customer_id);

drop policy if exists "Customers can create their import cart" on public.import_customer_carts;
create policy "Customers can create their import cart"
on public.import_customer_carts
for insert
to authenticated
with check ((select auth.uid()) = customer_id);

drop policy if exists "Customers can update their import cart" on public.import_customer_carts;
create policy "Customers can update their import cart"
on public.import_customer_carts
for update
to authenticated
using ((select auth.uid()) = customer_id)
with check ((select auth.uid()) = customer_id);

drop policy if exists "Customers can delete their import cart" on public.import_customer_carts;
create policy "Customers can delete their import cart"
on public.import_customer_carts
for delete
to authenticated
using ((select auth.uid()) = customer_id);

create index if not exists import_customer_carts_updated_at_idx
on public.import_customer_carts(updated_at desc);