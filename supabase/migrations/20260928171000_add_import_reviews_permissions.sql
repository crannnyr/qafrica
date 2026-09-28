-- Add dedicated permissions for managing import product mock reviews.
insert into public.import_admin_permissions (key, name, section, action, description)
values
  (
    'import.reviews.view',
    'View Reviews',
    'Reviews',
    'View',
    'View import product reviews and reviewer profiles.'
  ),
  (
    'import.reviews.manage',
    'Manage Reviews',
    'Reviews',
    'Manage',
    'Create, edit and delete import product reviews and reviewer profiles.'
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
  and p.key in ('import.reviews.view', 'import.reviews.manage')
on conflict do nothing;
