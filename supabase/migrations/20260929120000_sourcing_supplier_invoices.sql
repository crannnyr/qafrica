create extension if not exists pgcrypto;

create table if not exists public.china_import_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text generated always as (lower(regexp_replace(trim(name), '\s+', ' ', 'g'))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists china_import_suppliers_normalized_name_uq on public.china_import_suppliers(normalized_name);

alter table public.import_sourcing_allocations add column if not exists supplier_id uuid references public.china_import_suppliers(id);

create table if not exists public.china_import_supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  batch_key text not null,
  supplier_id uuid not null references public.china_import_suppliers(id),
  invoice_code text not null unique,
  status text not null default 'open' check (status in ('open','issued','received','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists china_import_supplier_invoices_batch_idx on public.china_import_supplier_invoices(batch_key);

create table if not exists public.china_import_supplier_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.china_import_supplier_invoices(id) on delete cascade,
  product_id uuid,
  product_name text not null,
  product_image text,
  variant_options jsonb,
  quantity integer not null check (quantity > 0),
  receiving_code text not null unique,
  qr_payload text not null,
  created_at timestamptz not null default now()
);
create index if not exists china_import_supplier_invoice_items_invoice_idx on public.china_import_supplier_invoice_items(invoice_id);

create table if not exists public.china_import_supplier_invoice_allocations (
  invoice_item_id uuid not null references public.china_import_supplier_invoice_items(id) on delete cascade,
  allocation_id uuid not null references public.import_sourcing_allocations(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  primary key (invoice_item_id, allocation_id)
);
create index if not exists china_import_supplier_invoice_allocations_allocation_idx on public.china_import_supplier_invoice_allocations(allocation_id);

alter table public.china_import_suppliers enable row level security;
alter table public.china_import_supplier_invoices enable row level security;
alter table public.china_import_supplier_invoice_items enable row level security;
alter table public.china_import_supplier_invoice_allocations enable row level security;

create or replace function public.get_or_create_sourcing_supplier(p_name text)
returns table(id uuid, name text)
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_id uuid; v_name text := trim(p_name);
begin
  if v_name is null or v_name='' then raise exception 'Supplier name is required'; end if;
  insert into public.china_import_suppliers(name) values(v_name)
  on conflict (normalized_name) do update set updated_at=now()
  returning china_import_suppliers.id into v_id;
  return query select s.id,s.name from public.china_import_suppliers s where s.id=v_id;
end; $$;

create or replace function public.assign_sourcing_supplier(p_batch_key text,p_product_id uuid,p_supplier_name text)
returns table(updated_count integer,supplier_id uuid,supplier_name text)
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_supplier_id uuid; v_supplier_name text; v_count integer;
begin
  select s.id,s.name into v_supplier_id,v_supplier_name from public.get_or_create_sourcing_supplier(p_supplier_name) s;
  update public.import_sourcing_allocations a set supplier_id=v_supplier_id,updated_at=now()
  where a.batch_key=p_batch_key and a.product_id=p_product_id and a.status in ('uncommitted','committed') and a.status<>'cancelled';
  get diagnostics v_count=row_count;
  return query select v_count,v_supplier_id,v_supplier_name;
end; $$;

drop function if exists public.get_sourcing_commitment_lines(text);
create function public.get_sourcing_commitment_lines(p_batch_key text)
returns table(allocation_id uuid,customer_id uuid,customer_name text,order_id uuid,order_code text,product_id uuid,product_name text,product_image text,source_url text,variant_options jsonb,quantity integer,status text,supplier_id uuid,supplier_name text,supplier_invoice_id uuid,supplier_invoice_code text,created_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path=public,pg_temp
as $$
select a.id,o.user_id,coalesce(o.customer_name,'Customer')::text,o.id,o.code,a.product_id,coalesce(p.name,'Unnamed product')::text,p.image_url,p.source_url,a.variant_options,a.quantity,a.status,a.supplier_id,s.name,si.id,si.invoice_code,a.created_at,a.updated_at
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

create or replace function public.create_sourcing_supplier_invoice(p_batch_key text,p_supplier_id uuid)
returns table(invoice_id uuid,invoice_code text,created boolean)
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_invoice_id uuid; v_code text; v_count integer;
begin
  if not exists(select 1 from public.china_import_suppliers where id=p_supplier_id) then raise exception 'Supplier not found'; end if;
  select count(*)::int into v_count
  from public.import_sourcing_allocations a
  join public.china_import_orders o on o.id=a.order_id
  where a.batch_key=p_batch_key and a.supplier_id=p_supplier_id and a.status in ('committed','purchased')
    and o.status not in ('cancelled','refunded')
    and not exists(select 1 from public.china_import_supplier_invoice_allocations ia where ia.allocation_id=a.id);
  if coalesce(v_count,0)=0 then raise exception 'No new committed products are waiting for a supplier invoice'; end if;

  insert into public.china_import_supplier_invoices(batch_key,supplier_id,invoice_code)
  values(p_batch_key,p_supplier_id,'SI-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)))
  returning id,invoice_code into v_invoice_id,v_code;

  insert into public.china_import_supplier_invoice_items(invoice_id,product_id,product_name,product_image,variant_options,quantity,receiving_code,qr_payload)
  select v_invoice_id,x.product_id,x.product_name,x.product_image,x.variant_options,x.qty,x.receiving_code,x.receiving_code
  from (
    select a.product_id,coalesce(p.name,'Unnamed product') product_name,p.image_url product_image,a.variant_options,sum(a.quantity)::int qty,
      'QAF-RCV-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)) receiving_code
    from public.import_sourcing_allocations a
    join public.china_import_orders o on o.id=a.order_id
    left join public.china_import_products p on p.id=a.product_id
    where a.batch_key=p_batch_key and a.supplier_id=p_supplier_id and a.status in ('committed','purchased')
      and o.status not in ('cancelled','refunded')
      and not exists(select 1 from public.china_import_supplier_invoice_allocations ia where ia.allocation_id=a.id)
    group by a.product_id,coalesce(p.name,'Unnamed product'),p.image_url,a.variant_options
  ) x;

  insert into public.china_import_supplier_invoice_allocations(invoice_item_id,allocation_id,quantity)
  select i.id,a.id,a.quantity
  from public.china_import_supplier_invoice_items i
  join public.import_sourcing_allocations a on a.batch_key=p_batch_key and a.supplier_id=p_supplier_id and a.status in ('committed','purchased')
  join public.china_import_orders o on o.id=a.order_id
  where i.invoice_id=v_invoice_id and i.product_id is not distinct from a.product_id and i.variant_options is not distinct from a.variant_options
    and not exists(select 1 from public.china_import_supplier_invoice_allocations ia where ia.allocation_id=a.id);

  return query select v_invoice_id,v_code,true;
end; $$;

create or replace function public.get_sourcing_supplier_invoice(p_invoice_id uuid,p_batch_key text)
returns table(invoice_id uuid,invoice_code text,status text,supplier_id uuid,supplier_name text,batch_key text,item_id uuid,product_id uuid,product_name text,product_image text,variant_options jsonb,quantity integer,receiving_code text,qr_payload text)
language sql security definer stable set search_path=public,pg_temp
as $$
select i.id,i.invoice_code,i.status,s.id,s.name,i.batch_key,ii.id,ii.product_id,ii.product_name,ii.product_image,ii.variant_options,ii.quantity,ii.receiving_code,ii.qr_payload
from public.china_import_supplier_invoices i
join public.china_import_suppliers s on s.id=i.supplier_id
join public.china_import_supplier_invoice_items ii on ii.invoice_id=i.id
where i.id=p_invoice_id and i.batch_key=p_batch_key;
$$;

grant execute on function public.get_or_create_sourcing_supplier(text) to anon,authenticated;
grant execute on function public.assign_sourcing_supplier(text,uuid,text) to anon,authenticated;
grant execute on function public.create_sourcing_supplier_invoice(text,uuid) to anon,authenticated;
grant execute on function public.get_sourcing_supplier_invoice(uuid,text) to anon,authenticated;
