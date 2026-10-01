-- Fix the sourcing workflow initializer used by new public sourcing links.
-- The RETURNS TABLE output column `order_id` conflicted with the
-- import_sourcing_allocations.order_id name inside ON CONFLICT.
-- Use the existing unique constraint explicitly so PostgreSQL cannot
-- resolve `order_id` as the PL/pgSQL output variable.
-- This function also initializes sourcing allocations, so it must be VOLATILE.

create or replace function public.china_import_get_sourcing_commitment_lines(p_batch_key text)
returns table(
  allocation_id uuid, customer_id uuid, customer_name text, order_id uuid, order_code text,
  product_id uuid, product_name text, product_image text, source_url text, variant_options jsonb,
  quantity integer, status text, supplier_id uuid, supplier_name text, supplier_invoice_id uuid,
  supplier_invoice_code text, china_import_barcode text, created_at timestamptz, updated_at timestamptz
)
language plpgsql volatile security definer set search_path=public,pg_temp
as $$
begin
  if p_batch_key is null or btrim(p_batch_key) = '' then
    raise exception 'Batch key is required';
  end if;

  insert into public.import_sourcing_allocations(
    batch_key, order_id, customer_id, product_id, variant_options, quantity, status
  )
  select p_batch_key, o.id, o.user_id, (item->>'id')::uuid,
         coalesce(item->'variant_options', '{}'::jsonb),
         greatest(coalesce((item->>'quantity')::integer, 0), 0),
         'uncommitted'
  from public.china_import_orders as o
  cross join lateral jsonb_array_elements(o.items) as item
  where o.staged_at = p_batch_key::timestamptz
    and o.user_id is not null
    and o.status not in ('cancelled', 'refunded')
    and item->>'id' is not null
    and greatest(coalesce((item->>'quantity')::integer, 0), 0) > 0
    and exists (
      select 1
      from public.china_import_consolidation_bills as b
      where b.order_id = o.id
        and b.user_id = o.user_id
        and b.kind = 'consolidation_shipping'
        and b.status = 'paid'
    )
  on conflict on constraint import_sourcing_allocations_batch_key_order_id_product_id_v_key do nothing;

  return query
  select a.id, o.user_id, coalesce(o.customer_name,'Customer')::text, o.id, o.code,
         a.product_id, coalesce(p.name,'Unnamed product')::text, p.image_url, p.source_url,
         a.variant_options, a.quantity, a.status, a.supplier_id, s.name,
         si.id, si.invoice_code, p.china_import_barcode, a.created_at, a.updated_at
  from public.import_sourcing_allocations as a
  join public.china_import_orders as o on o.id=a.order_id
  left join public.china_import_products as p on p.id=a.product_id
  left join public.china_import_suppliers as s on s.id=a.supplier_id
  left join public.china_import_supplier_invoice_allocations as sia on sia.allocation_id=a.id
  left join public.china_import_supplier_invoice_items as sii on sii.id=sia.invoice_item_id
  left join public.china_import_supplier_invoices as si on si.id=sii.invoice_id
  where a.batch_key=p_batch_key
    and a.status<>'cancelled'
    and o.status not in ('cancelled','refunded')
  order by case a.status when 'uncommitted' then 1 when 'committed' then 2 when 'purchased' then 3 else 4 end,
           coalesce(p.name,'Unnamed product'), coalesce(o.customer_name,'Customer'), a.created_at;
end;
$$;
