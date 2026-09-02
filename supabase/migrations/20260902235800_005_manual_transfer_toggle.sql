-- Manual bank transfer toggle -- mirrors paystack_enabled but for the
-- other payment method. Currently set to false: manual transfer is blocked
-- at checkout, customers can only pay via Paystack.
alter table import_admin_credentials
  add column if not exists manual_transfer_enabled boolean not null default true;

comment on column import_admin_credentials.manual_transfer_enabled is 'When false, manual bank-transfer is blocked at checkout -- customers can only pay via Paystack. Mirrors paystack_enabled but for the other direction.';

update import_admin_credentials set manual_transfer_enabled = false where id = 1;
