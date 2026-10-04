-- Phase 2: China Import dropship bridge foundation.
-- This migration does not change /stores or the legacy dropship flow.
--
-- Design:
--   china_import_dropship_catalog = seller/store -> China Import product mapping.
--   order_items.source_type/source_id = source-aware order identity.
--   china_import_order_links = seller order item -> China fulfillment handoff.
--
-- China Import UUIDs are never written into products/order_items.product_id.

create table if not exists public.china_import_dropship_catalog (
  id uuid primary key default gen_random_uuid(),
  seller_store_id uuid not null references public.stores(id) on delete cascade,
  seller_owner_id uuid not null references public.profiles(id) on delete cascade,
  china_import_product_id uuid not null references public.china_import_products(id) on delete restrict,
  seller_price_ngn numeric(14,2) not null check (seller_price_ngn > 0),
  supplier_cost_ngn numeric(14,2) not null check (supplier_cost_ngn >= 0),
  shipping_cost_ngn numeric(14,2) not null default 0 check (shipping_cost_ngn >= 0),
  landed_cost_ngn numeric(14,2) generated always as
    (supplier_cost_ngn + shipping_cost_ngn) stored,
  status text not null default 'active'
    check (status in ('active','paused','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_store_id, china_import_product_id)
);

create index if not exists idx_ci_dropship_catalog_store
  on public.china_import_dropship_catalog(seller_store_id, status);
create index if not exists idx_ci_dropship_catalog_owner
  on public.china_import_dropship_catalog(seller_owner_id, status);
create index if not exists idx_ci_dropship_catalog_product
  on public.china_import_dropship_catalog(china_import_product_id, status);

create or replace function public.validate_china_import_dropship_catalog_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store_owner uuid;
begin
  select owner_id into v_store_owner
  from public.stores
  where id = new.seller_store_id;

  if v_store_owner is null or v_store_owner <> new.seller_owner_id then
    raise exception 'Seller owner does not own the selected store';
  end if;

  if not exists (
    select 1
    from public.china_import_products p
    where p.id = new.china_import_product_id
  ) then
    raise exception 'China Import product not found';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_ci_dropship_catalog_owner
  on public.china_import_dropship_catalog;

create trigger trg_validate_ci_dropship_catalog_owner
before insert or update of seller_store_id, seller_owner_id, china_import_product_id
on public.china_import_dropship_catalog
for each row
execute function public.validate_china_import_dropship_catalog_owner();

alter table public.china_import_dropship_catalog enable row level security;

drop policy if exists "China dropship catalog owners can view their catalog"
  on public.china_import_dropship_catalog;
create policy "China dropship catalog owners can view their catalog"
on public.china_import_dropship_catalog
for select
to authenticated
using (
  seller_owner_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "China dropship catalog owners can insert"
  on public.china_import_dropship_catalog;
create policy "China dropship catalog owners can insert"
on public.china_import_dropship_catalog
for insert
to authenticated
with check (
  seller_owner_id = auth.uid()
  and exists (
    select 1 from public.stores s
    where s.id = seller_store_id
      and s.owner_id = auth.uid()
  )
);

drop policy if exists "China dropship catalog owners can update"
  on public.china_import_dropship_catalog;
create policy "China dropship catalog owners can update"
on public.china_import_dropship_catalog
for update
to authenticated
using (seller_owner_id = auth.uid() or public.is_admin())
with check (
  seller_owner_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "China dropship catalog owners can delete"
  on public.china_import_dropship_catalog;
create policy "China dropship catalog owners can delete"
on public.china_import_dropship_catalog
for delete
to authenticated
using (seller_owner_id = auth.uid() or public.is_admin());


-- Make order_items source-aware without putting China UUIDs into product_id.
alter table public.order_items
  add column if not exists source_type text not null default 'product',
  add column if not exists source_id uuid;

update public.order_items
set source_id = product_id
where source_id is null;

alter table public.order_items
  alter column product_id drop not null;

alter table public.order_items
  drop constraint if exists order_items_source_identity_check;

alter table public.order_items
  add constraint order_items_source_identity_check
  check (
    (source_type = 'product' and source_id is not null and source_id = product_id)
    or
    (source_type = 'china_import' and source_id is not null and product_id is null)
  );

alter table public.order_items
  drop constraint if exists order_items_source_type_check;

alter table public.order_items
  add constraint order_items_source_type_check
  check (source_type in ('product','china_import'));

create index if not exists idx_order_items_source
  on public.order_items(source_type, source_id);


-- Explicit seller-order -> China fulfillment handoff.
create table if not exists public.china_import_order_links (
  id uuid primary key default gen_random_uuid(),
  seller_order_id uuid not null references public.orders(id) on delete cascade,
  seller_order_item_id uuid not null references public.order_items(id) on delete cascade,
  china_import_order_id uuid not null references public.china_import_orders(id) on delete restrict,
  china_import_fulfillment_item_id uuid references public.china_import_fulfillment_items(id) on delete restrict,
  china_import_dropship_catalog_id uuid references public.china_import_dropship_catalog(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (seller_order_item_id),
  unique (china_import_fulfillment_item_id)
);

create index if not exists idx_ci_order_links_seller_order
  on public.china_import_order_links(seller_order_id);
create index if not exists idx_ci_order_links_china_order
  on public.china_import_order_links(china_import_order_id);

alter table public.china_import_order_links enable row level security;

drop policy if exists "Store owners can view their China fulfillment links"
  on public.china_import_order_links;
create policy "Store owners can view their China fulfillment links"
on public.china_import_order_links
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    join public.stores s on s.id = o.store_id
    where o.id = seller_order_id
      and s.owner_id = auth.uid()
  )
  or public.is_admin()
);

-- No client INSERT/UPDATE/DELETE policy is intentionally created.
-- The service-role checkout/fulfillment bridge is the only writer.

comment on table public.china_import_dropship_catalog is
  'Seller-owned catalog mappings for China Import dropshipping. Keeps China products out of products/import_catalog.';
comment on column public.china_import_dropship_catalog.supplier_cost_ngn is
  'Authoritative China Import supplier/product cost snapshot used for seller margin accounting.';
comment on column public.china_import_dropship_catalog.shipping_cost_ngn is
  'Authoritative China Import shipping cost snapshot used in landed-cost accounting.';
comment on table public.china_import_order_links is
  'Explicit handoff from a seller order item to the existing China Import fulfillment pipeline.';
comment on column public.order_items.source_type is
  'Source identity: product for normal marketplace products, china_import for China Import dropship items.';
comment on column public.order_items.source_id is
  'UUID of the source record identified by source_type.';
