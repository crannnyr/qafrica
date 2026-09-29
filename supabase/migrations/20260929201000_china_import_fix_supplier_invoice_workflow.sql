-- China import only: normalized_name is generated and must be omitted from inserts.
create or replace function public.china_import_assign_sourcing_supplier(p_batch_key text,p_product_id uuid,p_supplier_name text)
returns table(supplier_id uuid,supplier_name text)
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_id uuid; v_name text; v_normalized text;
begin
  if not exists(select 1 from public.import_sourcing_allocations where batch_key=p_batch_key and product_id=p_product_id and status<>'cancelled') then
    raise exception 'Product is not part of this sourcing batch';
  end if;
  v_name=trim(p_supplier_name);
  if v_name='' then raise exception 'Supplier name is required'; end if;
  v_normalized=lower(regexp_replace(v_name,'\s+',' ','g'));
  select id,name into v_id,v_name from public.china_import_suppliers where normalized_name=v_normalized limit 1;
  if v_id is null then
    insert into public.china_import_suppliers(name) values(v_name) returning id,name into v_id,v_name;
  end if;
  update public.import_sourcing_allocations set supplier_id=v_id,updated_at=now()
  where batch_key=p_batch_key and product_id=p_product_id and status<>'cancelled';
  return query select v_id,v_name;
end;
$$;
revoke all on function public.china_import_assign_sourcing_supplier(text,uuid,text) from public;
grant execute on function public.china_import_assign_sourcing_supplier(text,uuid,text) to anon,authenticated;
