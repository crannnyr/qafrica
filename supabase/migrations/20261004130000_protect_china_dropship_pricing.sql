-- Phase 2: protect authoritative China Import dropship pricing snapshots.
-- Sellers may control their selling price/status, but supplier cost, shipping
-- cost, source product, and ownership are server-controlled snapshots.

create or replace function public.protect_china_import_dropship_catalog_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Service-role/server-side writes are allowed to refresh authoritative
  -- procurement fields. Authenticated sellers are restricted to the
  -- customer-facing catalog fields.
  if auth.uid() is not null and not public.is_admin() then
    if new.seller_store_id is distinct from old.seller_store_id
       or new.seller_owner_id is distinct from old.seller_owner_id
       or new.china_import_product_id is distinct from old.china_import_product_id
       or new.supplier_cost_ngn is distinct from old.supplier_cost_ngn
       or new.shipping_cost_ngn is distinct from old.shipping_cost_ngn
    then
      raise exception 'Authoritative China Import catalog fields cannot be changed by sellers';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_ci_dropship_catalog_fields
  on public.china_import_dropship_catalog;

create trigger trg_protect_ci_dropship_catalog_fields
before update
on public.china_import_dropship_catalog
for each row
execute function public.protect_china_import_dropship_catalog_fields();

-- Keep the snapshot cost authoritative when a catalog row is first created.
-- Seller-created rows must match the current active China Import product's
-- procurement and flight-shipping values.
create or replace function public.set_china_import_dropship_catalog_cost_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.china_import_products%rowtype;
begin
  select *
  into v_product
  from public.china_import_products
  where id = new.china_import_product_id
    and is_active;

  if not found then
    raise exception 'China Import product is not active or does not exist';
  end if;

  if auth.uid() is not null and not public.is_admin() then
    new.supplier_cost_ngn := greatest(coalesce(v_product.cost_ngn, v_product.price_ngn, 0), 0);
    new.shipping_cost_ngn := greatest(coalesce(v_product.flight_shipping_cost_ngn, 0), 0);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_ci_dropship_catalog_cost_snapshot
  on public.china_import_dropship_catalog;

create trigger trg_set_ci_dropship_catalog_cost_snapshot
before insert
on public.china_import_dropship_catalog
for each row
execute function public.set_china_import_dropship_catalog_cost_snapshot();

comment on function public.protect_china_import_dropship_catalog_fields() is
  'Prevents seller clients from changing authoritative China Import procurement fields.';

comment on function public.set_china_import_dropship_catalog_cost_snapshot() is
  'Snapshots current China Import product cost and flight shipping for seller-created catalog rows.';
