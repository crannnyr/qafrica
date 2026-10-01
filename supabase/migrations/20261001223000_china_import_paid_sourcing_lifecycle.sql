-- China import only.
-- Paid shipment-fee orders are sourcing-eligible until cancelled/refunded.
-- Sourcing status, not the customer order shipment lifecycle, controls the tabs.

create or replace function public.china_import_get_sourcing_commitment_lines(p_batch_key text)
returns table(
  allocation_id uuid, customer_id uuid, customer_name text, order_id uuid, order_code text,
  product_id uuid, product_name text, product_image text, source_url text, variant_options jsonb,
  quantity integer, status text, supplier_id uuid, supplier_name text, supplier_invoice_id uuid,
  supplier_invoice_code text, china_import_barcode text, created_at timestamptz, updated_at timestamptz
)
language plpgsql stable security definer set search_path=public,pg_temp
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
  from public.china_import_orders o
  cross join lateral jsonb_array_elements(o.items) item
  where o.staged_at = p_batch_key::timestamptz
    and o.user_id is not null
    and o.status not in ('cancelled', 'refunded')
    and item->>'id' is not null
    and greatest(coalesce((item->>'quantity')::integer, 0), 0) > 0
    and exists (
      select 1 from public.china_import_consolidation_bills b
      where b.order_id = o.id
        and b.user_id = o.user_id
        and b.kind = 'consolidation_shipping'
        and b.status = 'paid'
    )
  on conflict (batch_key, order_id, product_id, variant_key) do nothing;

  return query
  select a.id, o.user_id, coalesce(o.customer_name,'Customer')::text, o.id, o.code,
         a.product_id, coalesce(p.name,'Unnamed product')::text, p.image_url, p.source_url,
         a.variant_options, a.quantity, a.status, a.supplier_id, s.name,
         si.id, si.invoice_code, p.china_import_barcode, a.created_at, a.updated_at
  from public.import_sourcing_allocations a
  join public.china_import_orders o on o.id=a.order_id
  left join public.china_import_products p on p.id=a.product_id
  left join public.china_import_suppliers s on s.id=a.supplier_id
  left join public.china_import_supplier_invoice_allocations sia on sia.allocation_id=a.id
  left join public.china_import_supplier_invoice_items sii on sii.id=sia.invoice_item_id
  left join public.china_import_supplier_invoices si on si.id=sii.invoice_id
  where a.batch_key=p_batch_key
    and a.status<>'cancelled'
    and o.status not in ('cancelled','refunded')
  order by case a.status when 'uncommitted' then 1 when 'committed' then 2 when 'purchased' then 3 else 4 end,
           coalesce(p.name,'Unnamed product'), coalesce(o.customer_name,'Customer'), a.created_at;
end;
$$;

revoke all on function public.china_import_get_sourcing_commitment_lines(text) from public;
