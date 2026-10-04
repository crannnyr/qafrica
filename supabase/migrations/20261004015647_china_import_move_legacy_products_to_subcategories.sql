-- Applied to production on 2026-10-04 (already live; committed so git matches the database).
-- Depends on rows in public.china_import_category_migration_map (the reviewed product -> subcategory
-- mapping), which were loaded as data and are not part of this file.
-- 1. Category text now comes from the product's subcategory (fixes the "Other" default).
create or replace function public.set_parent_category()
returns trigger language plpgsql set search_path to 'public','pg_temp' as $$
declare v_cat_id text; v_cat text; v_sub text;
begin
  if new.subcategory_id is not null then
    select ns.category_id, nc.name, ns.name into v_cat_id, v_cat, v_sub
    from public.niche_subcategories ns
    join public.niche_categories nc on nc.id = ns.category_id and nc.niche_id = ns.niche_id
    where ns.id = new.subcategory_id;
    if found then
      new.category_id := v_cat_id;
      new.parent_category := v_cat;
      new.category := v_sub;
      return new;
    end if;
  end if;
  new.parent_category := public.derive_parent_category(new.category);
  return new;
end $$;

create or replace trigger trg_set_parent_category
  before insert or update on public.china_import_products
  for each row execute function public.set_parent_category();

-- Keep product category text in step when a category/subcategory is renamed or moved.
create or replace function public.sync_import_product_category_names()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if tg_table_name = 'niche_subcategories' then
    update public.china_import_products set updated_at = now() where subcategory_id = new.id;
  else
    update public.china_import_products set updated_at = now()
    where subcategory_id in (select id from public.niche_subcategories where category_id = new.id and niche_id = new.niche_id);
  end if;
  return new;
end $$;
revoke all on function public.sync_import_product_category_names() from public, anon, authenticated;

create or replace trigger trg_sync_import_products_on_subcategory
  after update of name, category_id, niche_id on public.niche_subcategories
  for each row execute function public.sync_import_product_category_names();
create or replace trigger trg_sync_import_products_on_category
  after update of name on public.niche_categories
  for each row execute function public.sync_import_product_category_names();

-- 2. Backfill products already on the new structure (were showing under "Other").
update public.china_import_products set updated_at = now() where subcategory_id is not null;

-- 3. Move the 358 legacy products: subcategory + category markup.
--    Price never drops; legacy bags use 40% instead of the subcategory's 100%; no volume/weight.
with s as (select usd_to_ngn_rate usd, cny_to_usd_rate cny from public.import_admin_credentials limit 1),
calc as (
  select p.id, m.subcategory_id, p.cost_ngn cost, p.price_ngn old_price,
         case when ns.category_id = 'accessories' and ns.name = 'Bags' then 40 else ns.markup_percent end eff
  from public.china_import_category_migration_map m
  join public.china_import_products p on p.id = m.product_id
  join public.niche_subcategories ns on ns.id = m.subcategory_id
  where p.subcategory_id is null
), priced as (
  select c.*, greatest(c.old_price, round(c.cost * (1 + c.eff / 100), 2)) new_price from calc c
)
update public.china_import_products p set
  subcategory_id = x.subcategory_id,
  price_ngn = x.new_price,
  price_usd = round(x.new_price / s.usd, 2),
  price_cny = round(x.new_price / s.usd / s.cny, 2),
  original_price_usd = round(x.cost / s.usd, 2),
  usd_to_ngn_rate = s.usd,
  markup_percent = case when x.new_price > x.old_price then x.eff
                        else greatest(round((x.old_price - x.cost) / nullif(x.cost, 0) * 100, 2), 0) end,
  markup_amount_ngn = greatest(x.new_price - x.cost, 0)
from priced x, s
where p.id = x.id;

-- 4. Saved carts: shift each affected line by the same amount the product moved.
with d as (
  select p.id, p.price_ngn - b.price_ngn diff, p.price_usd, p.price_cny
  from public.china_import_products p
  join public.china_import_products_backup_20261004 b on b.id = p.id
  where b.subcategory_id is null and p.price_ngn <> b.price_ngn
)
update public.import_customer_carts c set items = (
  select jsonb_agg(
    case when d.id is not null and (e.it->>'price_ngn') ~ '^[0-9]+(\.[0-9]+)?$'
      then e.it || jsonb_build_object(
        'price_ngn', (e.it->>'price_ngn')::numeric + d.diff,
        'price_usd', d.price_usd, 'price_cny', d.price_cny)
      else e.it end order by e.ord)
  from jsonb_array_elements(c.items) with ordinality e(it, ord)
  left join d on d.id::text = e.it->>'id'
)
where jsonb_typeof(c.items) = 'array'
  and exists (select 1 from jsonb_array_elements(c.items) it join d on d.id::text = it->>'id');

-- 5. Abort everything if the result is not what was approved.
do $$
declare bad int;
begin
  select count(*) into bad from public.china_import_products where subcategory_id is null;
  if bad > 0 then raise exception '% products still have no subcategory', bad; end if;
  select count(*) into bad from public.china_import_products where parent_category = 'Other' or parent_category is null or category_id is null;
  if bad > 0 then raise exception '% products still under Other / missing category', bad; end if;
  select count(*) into bad from public.china_import_products p join public.china_import_products_backup_20261004 b on b.id = p.id where p.price_ngn < b.price_ngn;
  if bad > 0 then raise exception '% products dropped in price', bad; end if;
  select count(*) into bad from public.china_import_products p join public.china_import_products_backup_20261004 b on b.id = p.id where b.subcategory_id is not null and p.price_ngn <> b.price_ngn;
  if bad > 0 then raise exception '% already-migrated products changed price', bad; end if;
  select count(*) into bad from public.import_customer_carts where items is null;
  if bad > 0 then raise exception '% carts emptied', bad; end if;
end $$;
