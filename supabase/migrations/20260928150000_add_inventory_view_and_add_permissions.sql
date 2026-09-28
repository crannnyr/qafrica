-- Add dedicated inventory permissions so viewing inventory and adding stock
-- are separate from product management and stock subtraction.
insert into public.import_admin_permissions (key, name, section, action, description)
values
  (
    'import.inventory.view',
    'View Inventory',
    'Inventory',
    'View',
    'View import inventory levels, variants, stock history metadata, and inventory filters.'
  ),
  (
    'import.inventory.add',
    'Add Inventory Stock',
    'Inventory',
    'Add stock',
    'Increase available inventory stock for a product or variant.'
  )
on conflict (key) do update
set name = excluded.name,
    section = excluded.section,
    action = excluded.action,
    description = excluded.description;

-- Inventory is part of both product and operational workflows.
-- Super admins receive both permissions; product and operations managers
-- receive the inventory permissions without gaining unrelated access.
insert into public.import_admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.import_admin_roles r
cross join public.import_admin_permissions p
where r.key in ('super_admin', 'product_manager', 'operations_manager')
  and p.key in ('import.inventory.view', 'import.inventory.add')
on conflict do nothing;
