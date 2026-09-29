-- China import sourcing additions only.
alter table public.china_import_products add column if not exists china_import_barcode text;
alter table public.china_import_supplier_invoice_items add column if not exists china_import_barcode text;

create or replace function public.china_import_get_sourcing_commitment_lines(p_batch_key text)
returns table(
  allocation_id uuid, customer_id uuid, customer_name text, order_id uuid, order_code text,
  product_id uuid, product_name text, product_image text, source_url text, variant_options jsonb,
  quantity integer, status text, supplier_id uuid, supplier_name text, supplier_invoice_id uuid,
  supplier_invoice_code text, china_import_barcode text, created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path=public,pg_temp
as $$
select a.id,o.user_id,coalesce(o.customer_name,'Customer')::text,o.id,o.code,a.product_id,
       coalesce(p.name,'Unnamed product')::text,p.image_url,p.source_url,a.variant_options,a.quantity,a.status,
       a.supplier_id,s.name,si.id,si.invoice_code,p.china_import_barcode,a.created_at,a.updated_at
from public.import_sourcing_allocations a
join public.china_import_orders o on o.id=a.order_id
left join public.china_import_products p on p.id=a.product_id
left join public.china_import_suppliers s on s.id=a.supplier_id
left join public.china_import_supplier_invoice_allocations sia on sia.allocation_id=a.id
left join public.china_import_supplier_invoice_items sii on sii.id=sia.invoice_item_id
left join public.china_import_supplier_invoices si on si.id=sii.invoice_id
where a.batch_key=p_batch_key and a.status<>'cancelled' and o.status not in ('cancelled','refunded')
order by a.status,coalesce(p.name,'Unnamed product'),coalesce(o.customer_name,'Customer'),a.created_at;
$$;

create or replace function public.china_import_set_sourcing_product_barcode(p_batch_key text,p_product_id uuid,p_barcode text)
returns text language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if not exists(select 1 from public.import_sourcing_allocations where batch_key=p_batch_key and product_id=p_product_id and status<>'cancelled') then raise exception 'Product is not part of this sourcing batch'; end if;
  update public.china_import_products set china_import_barcode=nullif(trim(p_barcode),'') where id=p_product_id;
  return (select china_import_barcode from public.china_import_products where id=p_product_id);
end;
$$;

create or replace function public.china_import_assign_sourcing_supplier(p_batch_key text,p_product_id uuid,p_supplier_name text)
returns table(supplier_id uuid,supplier_name text) language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_id uuid; v_name text;
begin
  if not exists(select 1 from public.import_sourcing_allocations where batch_key=p_batch_key and product_id=p_product_id and status<>'cancelled') then raise exception 'Product is not part of this sourcing batch'; end if;
  v_name=trim(p_supplier_name); if v_name='' then raise exception 'Supplier name is required'; end if;
  select id,name into v_id,v_name from public.china_import_suppliers where normalized_name=lower(regexp_replace(v_name,'\s+',' ','g')) limit 1;
  if v_id is null then insert into public.china_import_suppliers(name,normalized_name) values(v_name,lower(regexp_replace(v_name,'\s+',' ','g'))) returning id,name into v_id,v_name; end if;
  update public.import_sourcing_allocations set supplier_id=v_id,updated_at=now() where batch_key=p_batch_key and product_id=p_product_id and status<>'cancelled';
  return query select v_id,v_name;
end;
$$;

create or replace function public.china_import_create_sourcing_supplier_invoice(p_batch_key text,p_supplier_id uuid)
returns table(invoice_id uuid,invoice_code text,created boolean) language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_invoice_id uuid; v_code text; v_count integer;
begin
  if not exists(select 1 from public.china_import_suppliers where id=p_supplier_id) then raise exception 'Supplier not found'; end if;
  select count(*)::int into v_count from public.import_sourcing_allocations a join public.china_import_orders o on o.id=a.order_id
  where a.batch_key=p_batch_key and a.supplier_id=p_supplier_id and a.status in ('committed','purchased') and o.status not in ('cancelled','refunded')
    and not exists(select 1 from public.china_import_supplier_invoice_allocations ia where ia.allocation_id=a.id);
  if coalesce(v_count,0)=0 then raise exception 'No new committed products are waiting for a supplier invoice'; end if;
  insert into public.china_import_supplier_invoices(batch_key,supplier_id,invoice_code)
  values(p_batch_key,p_supplier_id,'SI-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))) returning id,invoice_code into v_invoice_id,v_code;
  insert into public.china_import_supplier_invoice_items(invoice_id,product_id,product_name,product_image,variant_options,quantity,receiving_code,qr_payload,china_import_barcode)
  select v_invoice_id,x.product_id,x.product_name,x.product_image,x.variant_options,x.qty,'IMP-RCV-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),'',x.china_import_barcode
  from (select a.product_id,coalesce(p.name,'Unnamed product') product_name,p.image_url product_image,a.variant_options,sum(a.quantity)::int qty,p.china_import_barcode
    from public.import_sourcing_allocations a join public.china_import_orders o on o.id=a.order_id left join public.china_import_products p on p.id=a.product_id
    where a.batch_key=p_batch_key and a.supplier_id=p_supplier_id and a.status in ('committed','purchased') and o.status not in ('cancelled','refunded')
      and not exists(select 1 from public.china_import_supplier_invoice_allocations ia where ia.allocation_id=a.id)
    group by a.product_id,coalesce(p.name,'Unnamed product'),p.image_url,a.variant_options,p.china_import_barcode) x;
  insert into public.china_import_supplier_invoice_allocations(invoice_item_id,allocation_id,quantity)
  select i.id,a.id,a.quantity from public.china_import_supplier_invoice_items i join public.import_sourcing_allocations a on a.batch_key=p_batch_key and a.supplier_id=p_supplier_id and a.status in ('committed','purchased')
  join public.china_import_orders o on o.id=a.order_id where i.invoice_id=v_invoice_id and i.product_id is not distinct from a.product_id and i.variant_options is not distinct from a.variant_options
    and not exists(select 1 from public.china_import_supplier_invoice_allocations ia where ia.allocation_id=a.id);
  return query select v_invoice_id,v_code,true;
end;
$$;

create or replace function public.china_import_get_sourcing_supplier_invoice(p_invoice_id uuid,p_batch_key text)
returns table(invoice_id uuid,invoice_code text,batch_key text,supplier_name text,product_id uuid,product_name text,product_image text,variant_options jsonb,quantity integer,receiving_code text,china_import_barcode text)
language sql stable security definer set search_path=public,pg_temp
as $$
select i.id,i.invoice_code,i.batch_key,s.name,ii.product_id,ii.product_name,ii.product_image,ii.variant_options,ii.quantity,ii.receiving_code,ii.china_import_barcode
from public.china_import_supplier_invoices i join public.china_import_suppliers s on s.id=i.supplier_id join public.china_import_supplier_invoice_items ii on ii.invoice_id=i.id
where i.id=p_invoice_id and i.batch_key=p_batch_key order by ii.product_name,ii.variant_options;
$$;

create or replace function public.china_import_get_sourcing_receiving_code(p_code text)
returns table(receiving_code text,invoice_id uuid,invoice_code text,supplier_name text,product_id uuid,product_name text,product_image text,variant_options jsonb,quantity integer,china_import_barcode text)
language sql stable security definer set search_path=public,pg_temp
as $$
select ii.receiving_code,i.id,i.invoice_code,s.name,ii.product_id,ii.product_name,ii.product_image,ii.variant_options,ii.quantity,ii.china_import_barcode
from public.china_import_supplier_invoice_items ii join public.china_import_supplier_invoices i on i.id=ii.invoice_id join public.china_import_suppliers s on s.id=i.supplier_id
where ii.receiving_code=trim(p_code) or ii.china_import_barcode=trim(p_code);
$$;

create or replace function public.china_import_set_sourcing_allocation_status(p_allocation_id uuid,p_batch_key text,p_status text)
returns table(id uuid,status text) language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if p_status not in ('uncommitted','committed','purchased') then raise exception 'Invalid sourcing status'; end if;
  update public.import_sourcing_allocations set status=p_status,updated_at=now() where id=p_allocation_id and batch_key=p_batch_key and status<>'cancelled';
  if not found then raise exception 'Sourcing allocation not found'; end if;
  return query select a.id,a.status from public.import_sourcing_allocations a where a.id=p_allocation_id;
end;
$$;

revoke all on function public.china_import_get_sourcing_commitment_lines(text) from public;
revoke all on function public.china_import_set_sourcing_product_barcode(text,uuid,text) from public;
revoke all on function public.china_import_assign_sourcing_supplier(text,uuid,text) from public;
revoke all on function public.china_import_create_sourcing_supplier_invoice(text,uuid) from public;
revoke all on function public.china_import_get_sourcing_supplier_invoice(uuid,text) from public;
revoke all on function public.china_import_get_sourcing_receiving_code(text) from public;
revoke all on function public.china_import_set_sourcing_allocation_status(uuid,text,text) from public;

drop function if exists public.assign_sourcing_supplier(text,uuid,text);
drop function if exists public.create_sourcing_supplier_invoice(text,uuid);
drop function if exists public.get_sourcing_supplier_invoice(uuid,text);
drop function if exists public.get_sourcing_receiving_code(text);
drop function if exists public.set_sourcing_allocation_status(uuid,text,text);
drop function if exists public.get_sourcing_commitment_lines(text);
drop function if exists public.get_or_create_sourcing_supplier(text);
drop function if exists public.prepare_paid_sourcing(text);
drop function if exists public.get_paid_sourcing_allocations(text);
drop function if exists public.commit_paid_sourcing_line(text,uuid,uuid,jsonb);
