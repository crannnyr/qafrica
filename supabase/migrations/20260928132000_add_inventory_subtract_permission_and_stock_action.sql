-- Add a dedicated permission and server-side action for reducing import inventory.
insert into public.import_admin_permissions (key, name, section, action, description)
values (
  'import.inventory.subtract',
  'Subtract Inventory Stock',
  'Inventory',
  'Subtract stock',
  'Reduce available inventory stock for a product or variant.'
)
on conflict (key) do update
set name = excluded.name,
    section = excluded.section,
    action = excluded.action,
    description = excluded.description;

insert into public.import_admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.import_admin_roles r
cross join public.import_admin_permissions p
where r.key in ('super_admin', 'product_manager')
  and p.key = 'import.inventory.subtract'
on conflict do nothing;

create or replace function public.subtract_china_import_inventory_stock(
  p_product_id uuid,
  p_variant_options jsonb default '{}'::jsonb,
  p_quantity_to_subtract integer default 0,
  p_manager_id uuid default null
)
returns public.china_import_inventory
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.china_import_inventory%rowtype;
  v_variant_options jsonb := coalesce(p_variant_options, '{}'::jsonb);
begin
  if p_quantity_to_subtract is null or p_quantity_to_subtract <= 0 then
    raise exception 'Stock to subtract must be greater than zero';
  end if;

  select *
  into v_row
  from public.china_import_inventory
  where product_id = p_product_id
    and variant_options = v_variant_options
  for update;

  if not found then
    raise exception 'No inventory is registered for this product or variant';
  end if;

  if v_row.quantity < p_quantity_to_subtract then
    raise exception 'Cannot subtract % units. Only % units are currently in stock',
      p_quantity_to_subtract, v_row.quantity;
  end if;

  update public.china_import_inventory
  set quantity = quantity - p_quantity_to_subtract,
      updated_by = p_manager_id,
      updated_at = now()
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.subtract_china_import_inventory_stock(uuid, jsonb, integer, uuid)
from public, anon, authenticated;
grant execute on function public.subtract_china_import_inventory_stock(uuid, jsonb, integer, uuid)
to service_role;