-- China import product identifiers only.
-- One QAfrica-owned barcode per product, shared by all variants.
alter table public.china_import_products add column if not exists china_import_barcode text;

create or replace function public.china_import_generate_product_barcode()
returns text
language plpgsql
volatile
as $$
declare
  v_barcode text;
begin
  loop
    v_barcode := 'IMP-PRD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    exit when not exists (
      select 1 from public.china_import_products where china_import_barcode = v_barcode
    );
  end loop;
  return v_barcode;
end;
$$;

create or replace function public.china_import_products_assign_barcode()
returns trigger
language plpgsql
as $$
begin
  if new.china_import_barcode is null or btrim(new.china_import_barcode) = '' then
    new.china_import_barcode := public.china_import_generate_product_barcode();
  end if;
  return new;
end;
$$;

drop trigger if exists china_import_products_assign_barcode on public.china_import_products;
create trigger china_import_products_assign_barcode
before insert on public.china_import_products
for each row execute function public.china_import_products_assign_barcode();

-- Backfill existing products once; never replace an existing identifier.
update public.china_import_products
set china_import_barcode = public.china_import_generate_product_barcode()
where china_import_barcode is null or btrim(china_import_barcode) = '';

create unique index if not exists china_import_products_barcode_uidx
on public.china_import_products(china_import_barcode)
where china_import_barcode is not null;

-- Keep existing invoice rows aligned with the product-level identifier.
update public.china_import_supplier_invoice_items sii
set china_import_barcode = p.china_import_barcode
from public.china_import_products p
where sii.product_id = p.id
  and (sii.china_import_barcode is null or btrim(sii.china_import_barcode) = '');

create or replace function public.china_import_ensure_product_barcode(p_product_id uuid)
returns text
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_barcode text;
begin
  update public.china_import_products
  set china_import_barcode = public.china_import_generate_product_barcode()
  where id = p_product_id
    and (china_import_barcode is null or btrim(china_import_barcode) = '')
  returning china_import_barcode into v_barcode;

  if v_barcode is null then
    select china_import_barcode into v_barcode
    from public.china_import_products
    where id = p_product_id;
  end if;

  if v_barcode is null then
    raise exception 'China-import product not found';
  end if;

  return v_barcode;
end;
$$;

revoke all on function public.china_import_generate_product_barcode() from public;
revoke all on function public.china_import_products_assign_barcode() from public;
revoke all on function public.china_import_ensure_product_barcode(uuid) from public;
