-- China import sourcing must only expose orders that are still in the sourcing stage.
-- Once an order reaches shipped_and_closed (or received), its sourcing lines
-- are historical and must not remain visible on the sourcing share page.

create or replace function public.china_import_get_sourcing_commitment_lines(p_batch_key text)
returns table(
  allocation_id uuid,
  customer_id uuid,
  customer_name text,
  order_id uuid,
  order_code text,
  product_id uuid,
  product_name text,
  product_image text,
  source_url text,
  variant_options jsonb,
  quantity integer,
  status text,
  supplier_id uuid,
  supplier_name text,
  supplier_invoice_id uuid,
  supplier_invoice_code text,
  china_import_barcode text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
select
  a.id,
  o.user_id,
  coalesce(o.customer_name, 'Customer')::text,
  o.id,
  o.code,
  a.product_id,
  coalesce(p.name, 'Unnamed product')::text,
  p.image_url,
  p.source_url,
  a.variant_options,
  a.quantity,
  a.status,
  a.supplier_id,
  s.name,
  si.id,
  si.invoice_code,
  p.china_import_barcode,
  a.created_at,
  a.updated_at
from public.import_sourcing_allocations a
join public.china_import_orders o on o.id = a.order_id
left join public.china_import_products p on p.id = a.product_id
left join public.china_import_suppliers s on s.id = a.supplier_id
left join public.china_import_supplier_invoice_allocations sia on sia.allocation_id = a.id
left join public.china_import_supplier_invoice_items sii on sii.id = sia.invoice_item_id
left join public.china_import_supplier_invoices si on si.id = sii.invoice_id
where a.batch_key = p_batch_key
  and a.status <> 'cancelled'
  and o.status = 'ordered_and_closed'
order by a.status,
         coalesce(p.name, 'Unnamed product'),
         coalesce(o.customer_name, 'Customer'),
         a.created_at;
$function$;
