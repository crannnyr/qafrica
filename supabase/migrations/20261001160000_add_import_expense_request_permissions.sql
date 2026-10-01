-- Payment requests need explicit RBAC permissions in the Import Admin permission catalogue.
-- Super admins and operations managers receive all three workflow permissions.
insert into public.import_admin_permissions (key, name, section, action, description)
values
  ('import.expenses.create', 'Create Payment Requests', 'Expenses', 'Create payment requests', 'Create and submit payment requests or reimbursements.'),
  ('import.expenses.approve', 'Approve Payment Requests', 'Expenses', 'Approve payment requests', 'Approve pending payment requests.'),
  ('import.expenses.reject', 'Reject Payment Requests', 'Expenses', 'Reject payment requests', 'Reject pending payment requests with a reason.')
on conflict (key) do update
set name = excluded.name,
    section = excluded.section,
    action = excluded.action,
    description = excluded.description;

insert into public.import_admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.import_admin_roles r
cross join public.import_admin_permissions p
where r.key in ('super_admin', 'operations_manager')
  and p.key in ('import.expenses.create', 'import.expenses.approve', 'import.expenses.reject')
on conflict do nothing;
