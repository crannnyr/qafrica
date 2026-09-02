-- Import batch lifecycle: real batch table, extended order statuses,
-- merged consolidation+shipping billing kind, clearance kind, Paystack
-- fields on bills, per-order received tracking, reminder-count for the
-- clearance 7-day cutoff. Mirrors the migration applied directly via
-- Supabase MCP on 2026-09-02.

create table if not exists import_batches (
  id uuid primary key default gen_random_uuid(),
  opened_at timestamptz not null default now(),
  ordered_closed_at timestamptz,
  shipped_closed_at timestamptz,
  clearance_closed_at timestamptz,
  shipping_method_final text check (shipping_method_final = any (array['flight'::text, 'sea_freight'::text])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table china_import_orders
  add column if not exists batch_id uuid references import_batches(id) on delete set null,
  add column if not exists received_at timestamptz;

do $$
declare
  r record;
  new_batch_id uuid;
begin
  for r in
    select distinct staged_at from china_import_orders where staged_at is not null
  loop
    if not exists (select 1 from import_batches where opened_at = r.staged_at) then
      insert into import_batches (opened_at, shipped_closed_at)
      values (
        r.staged_at,
        (select min(shipped_at) from china_import_orders where staged_at = r.staged_at and shipped_at is not null)
      )
      returning id into new_batch_id;

      update china_import_orders
        set batch_id = new_batch_id
        where staged_at = r.staged_at;
    end if;
  end loop;
end $$;

alter table china_import_orders drop constraint if exists china_import_orders_status_check;
alter table china_import_orders add constraint china_import_orders_status_check
  check (status = any (array[
    'pending', 'confirmed', 'billed', 'to_review',
    'ordered', 'ordered_and_closed', 'shipped_and_closed', 'clearance_and_closed', 'received'
  ]::text[]));

update china_import_consolidation_bills set kind = 'consolidation_shipping' where kind = 'consolidation';
update china_import_consolidation_bills set kind = 'consolidation_shipping' where kind = 'shipping';

alter table china_import_consolidation_bills drop constraint if exists china_import_consolidation_bills_kind_check;
alter table china_import_consolidation_bills add constraint china_import_consolidation_bills_kind_check
  check (kind = any (array['consolidation_shipping', 'clearance']::text[]));

alter table china_import_consolidation_bills alter column kind set default 'consolidation_shipping';
alter table china_import_consolidation_bills alter column reason set default 'Consolidation & shipping fee';

alter table import_batch_item_bills drop constraint if exists import_batch_item_bills_kind_check;
alter table import_batch_item_bills add constraint import_batch_item_bills_kind_check
  check (kind = any (array['consolidation_shipping', 'clearance']::text[]));
alter table import_batch_item_bills alter column kind set default 'consolidation_shipping';

alter table import_batch_bill_status drop constraint if exists import_batch_bill_status_kind_check;
alter table import_batch_bill_status add constraint import_batch_bill_status_kind_check
  check (kind = any (array['consolidation_shipping', 'clearance']::text[]));
alter table import_batch_bill_status alter column kind set default 'consolidation_shipping';

alter table china_import_consolidation_bills
  add column if not exists paystack_reference text,
  add column if not exists paystack_access_code text;

alter table china_import_consolidation_bills
  add column if not exists reminder_count integer not null default 0;

create index if not exists idx_china_import_orders_batch_id on china_import_orders(batch_id);
create index if not exists idx_china_import_orders_status on china_import_orders(status);
