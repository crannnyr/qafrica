-- Phase 2: China Import seller pricing semantics.
-- Seller catalog price is based only on china_import_products.price_ngn.
-- Air shipping is charged separately at checkout from air_shipping_customer_ngn.

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

  if v_product.air_shipping_customer_ngn is null
     or v_product.air_shipping_customer_ngn <= 0 then
    raise exception 'China Import product must have a valid air shipping customer cost';
  end if;

  if auth.uid() is not null and not public.is_admin() then
    -- The seller catalog's landed/base cost is the product price only.
    -- Shipping is intentionally excluded and is charged separately at checkout.
    new.supplier_cost_ngn := greatest(coalesce(v_product.price_ngn, 0), 0);
    new.shipping_cost_ngn := 0;
  end if;

  new.landed_cost_ngn := greatest(
    coalesce(new.supplier_cost_ngn, 0) + coalesce(new.shipping_cost_ngn, 0),
    0
  );

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

-- Reconcile existing seller catalog rows to the new price-only semantics.
update public.china_import_dropship_catalog c
set
  supplier_cost_ngn = greatest(coalesce(p.price_ngn, 0), 0),
  shipping_cost_ngn = 0,
  landed_cost_ngn = greatest(coalesce(p.price_ngn, 0), 0),
  updated_at = now()
from public.china_import_products p
where p.id = c.china_import_product_id;

comment on function public.set_china_import_dropship_catalog_cost_snapshot() is
  'Snapshots china_import_products.price_ngn as the seller catalog base cost; shipping is charged separately at checkout.';
