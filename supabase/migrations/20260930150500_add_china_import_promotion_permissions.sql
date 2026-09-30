insert into public.import_admin_permissions (key, name)
values
  ('import.promotions.view', 'View China Import Promotions'),
  ('import.promotions.manage', 'Manage China Import Promotions')
on conflict (key) do update set name = excluded.name;

insert into public.import_admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.import_admin_roles r
cross join public.import_admin_permissions p
where r.key = 'super_admin'
  and p.key in ('import.promotions.view', 'import.promotions.manage')
on conflict do nothing;
