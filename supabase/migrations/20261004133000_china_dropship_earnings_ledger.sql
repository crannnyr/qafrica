-- Phase 2 Step 12: source-aware earnings ledger for China Import dropship.
-- Keep the legacy product_earnings table untouched because its product_id FK
-- intentionally points to products. China Import earnings are represented by
-- a separate ledger keyed to order_items.source_id.

create table if not exists public.china_import_dropship_earnings (
  id uuid primary key default gen_random_uuid(),
  seller_store_id uuid not null references public.stores(id) on delete cascade,
  seller_owner_id uuid not null references public.profiles(id) on delete restrict,
  seller_order_id uuid not null references public.orders(id) on delete cascade,
  seller_order_item_id uuid not null references public.order_items(id) on delete cascade,
  china_import_product_id uuid not null references public.china_import_products(id) on delete restrict,
  quantity_sold integer not null default 0 check (quantity_sold > 0),
  unit_cost_ngn numeric not null default 0 check (unit_cost_ngn >= 0),
  unit_selling_price_ngn numeric not null default 0 check (unit_selling_price_ngn >= 0),
  total_revenue_ngn numeric not null default 0 check (total_revenue_ngn >= 0),
  total_cost_ngn numeric not null default 0 check (total_cost_ngn >= 0),
  gross_profit_ngn numeric not null default 0,
  platform_fee_ngn numeric not null default 0,
  net_profit_ngn numeric not null default 0,
  earned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(seller_order_item_id)
);

create index if not exists idx_ci_dropship_earnings_store
  on public.china_import_dropship_earnings(seller_store_id, earned_at desc);
create index if not exists idx_ci_dropship_earnings_owner
  on public.china_import_dropship_earnings(seller_owner_id, earned_at desc);
create index if not exists idx_ci_dropship_earnings_product
  on public.china_import_dropship_earnings(china_import_product_id);

alter table public.china_import_dropship_earnings enable row level security;

drop policy if exists "ci dropship earnings seller read" on public.china_import_dropship_earnings;
create policy "ci dropship earnings seller read"
on public.china_import_dropship_earnings
for select to authenticated
using (
  seller_owner_id = auth.uid()
  or public.is_admin()
);

revoke all on public.china_import_dropship_earnings from anon, authenticated;

grant select on public.china_import_dropship_earnings to authenticated;

-- Service-role-only writes keep financial records tied to the paid-order
-- finalization boundary rather than allowing a seller to manufacture profit.
create or replace function public.record_china_import_dropship_earning(
  p_order_id uuid,
  p_order_item_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  oi public.order_items%rowtype;
  o public.orders%rowtype;
  c public.china_import_dropship_catalog%rowtype;
  p public.china_import_products%rowtype;
  s public.stores%rowtype;
  v_id uuid;
  v_cost numeric;
  v_revenue numeric;
  v_gross numeric;
  v_platform_fee numeric;
  v_net numeric;
begin
  select * into oi
  from public.order_items
  where id = p_order_item_id and order_id = p_order_id
  for update;

  if not found or oi.source_type <> 'china_import' or oi.source_id is null then
    raise exception 'Invalid China Import seller order item %', p_order_item_id;
  end if;

  select * into o from public.orders where id = p_order_id for update;
  select * into s from public.stores where id = o.store_id;
  select * into p from public.china_import_products where id = oi.source_id;

  select * into c
  from public.china_import_dropship_catalog
  where seller_store_id = o.store_id
    and china_import_product_id = oi.source_id
  order by updated_at desc
  limit 1;

  if not found then
    raise exception 'China Import catalog mapping missing for order item %', p_order_item_id;
  end if;

  v_cost := round(coalesce(oi.dropship_price, c.supplier_cost_ngn + c.shipping_cost_ngn) * oi.quantity, 2);
  v_revenue := round(coalesce(oi.unit_price, oi.price_at_time) * oi.quantity, 2);
  v_gross := round(v_revenue - v_cost, 2);

  -- dropship_commission_rate is the existing percentage applied to markup.
  v_platform_fee := round(
    greatest(v_gross, 0) * coalesce(o.dropship_commission_rate, 0) / 100,
    2
  );
  v_net := greatest(round(v_gross - v_platform_fee, 2), 0);

  insert into public.china_import_dropship_earnings (
    seller_store_id, seller_owner_id, seller_order_id, seller_order_item_id,
    china_import_product_id, quantity_sold, unit_cost_ngn,
    unit_selling_price_ngn, total_revenue_ngn, total_cost_ngn,
    gross_profit_ngn, platform_fee_ngn, net_profit_ngn
  )
  values (
    o.store_id,
    s.owner_id,
    o.id,
    oi.id,
    oi.source_id,
    oi.quantity,
    round(v_cost / nullif(oi.quantity, 0), 2),
    round(v_revenue / nullif(oi.quantity, 0), 2),
    v_revenue,
    v_cost,
    v_gross,
    v_platform_fee,
    v_net
  )
  on conflict (seller_order_item_id) do update set
    unit_cost_ngn = excluded.unit_cost_ngn,
    unit_selling_price_ngn = excluded.unit_selling_price_ngn,
    total_revenue_ngn = excluded.total_revenue_ngn,
    total_cost_ngn = excluded.total_cost_ngn,
    gross_profit_ngn = excluded.gross_profit_ngn,
    platform_fee_ngn = excluded.platform_fee_ngn,
    net_profit_ngn = excluded.net_profit_ngn
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_china_import_dropship_earning(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.record_china_import_dropship_earning(uuid, uuid)
to service_role;

comment on table public.china_import_dropship_earnings is
  'Seller earnings ledger for China Import dropship items. Kept separate from product_earnings because China products are not rows in products.';
