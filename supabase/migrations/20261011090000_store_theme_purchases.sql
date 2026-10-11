-- Task 9: premium Black theme add-on purchases.
-- Payment rows are written only by the trusted Flutterwave edge function.
create table if not exists public.store_theme_purchases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  theme_id text not null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  payment_reference text not null unique,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'review')),
  payment_provider text not null default 'flutterwave',
  provider_charge_id text,
  payment_account jsonb,
  payment_expires_at timestamptz,
  paid_amount numeric(12,2),
  paid_at timestamptz,
  raw_confirm jsonb,
  payment_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, theme_id)
);

alter table public.store_theme_purchases enable row level security;

drop policy if exists "Store owners can view theme purchases" on public.store_theme_purchases;
create policy "Store owners can view theme purchases"
  on public.store_theme_purchases for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.stores s
      where s.id = store_theme_purchases.store_id
        and s.owner_id = auth.uid()
    )
  );

revoke insert, update, delete on public.store_theme_purchases from anon, authenticated;
grant select on public.store_theme_purchases to authenticated;
