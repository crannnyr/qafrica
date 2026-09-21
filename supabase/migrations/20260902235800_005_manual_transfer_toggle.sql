-- Manual bank transfer toggle.
-- Manual transfer is enabled so it can be used for orders at/above the
-- configured Paystack threshold.
alter table import_admin_credentials
  add column if not exists manual_transfer_enabled boolean not null default true;

comment on column import_admin_credentials.manual_transfer_enabled is 'When false, manual bank-transfer is blocked at checkout. When true, it is available where the checkout payment rules permit it.';

update import_admin_credentials set manual_transfer_enabled = true where id = 1;
