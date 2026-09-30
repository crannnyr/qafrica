-- Dedicated permissions for the Import Support Tickets workspace.
-- Keep ticket access separate from the live-message permission so ticket
-- management can be granted without granting message-sending access.
insert into public.import_admin_permissions (key, name, section, action, description)
values
  (
    'import.tickets.view',
    'View Support Tickets',
    'Support Tickets',
    'View tickets',
    'View Import AI support tickets, customer details and ticket history.'
  ),
  (
    'import.tickets.manage',
    'Manage Support Tickets',
    'Support Tickets',
    'Create and update tickets',
    'Create, assign, update, resolve and close Import AI support tickets.'
  )
on conflict (key) do update
set name = excluded.name,
    section = excluded.section,
    action = excluded.action,
    description = excluded.description;

-- Super admins and operations managers receive the dedicated ticket permissions.
insert into public.import_admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.import_admin_roles r
cross join public.import_admin_permissions p
where r.key in ('super_admin', 'operations_manager')
  and p.key in ('import.tickets.view', 'import.tickets.manage')
on conflict do nothing;
