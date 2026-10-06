-- Fix China Import seller catalog inserts for admin/staff-authenticated users.
-- The procurement snapshot must always be populated from the authoritative
-- China Import product. It must not depend on whether the caller is admin.

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

  -- Always derive authoritative catalog accounting values from the product.
  -- Seller/admin clients never need to supply these NOT NULL fields.
  -- Base catalog cost is price_ngn only; shipping is charged separately at checkout.
  new.supplier_cost_ngn := greatest(coalesce(v_product.price_ngn, 0), 0);
  new.shipping_cost_ngn := 0;

  return new;
end;
$$;

comment on function public.set_china_import_dropship_catalog_cost_snapshot() is
  'Always snapshots china_import_products.price_ngn as seller catalog base cost; shipping is charged separately at checkout for all authenticated caller roles.';
