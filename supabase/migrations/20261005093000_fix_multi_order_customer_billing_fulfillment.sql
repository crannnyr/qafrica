-- Fix multi-order customer billing -> fulfillment.
--
-- Consolidation billing is customer-scoped: one bill represents every order
-- belonging to that customer in the closed batch, while china_import_consolidation_bills
-- keeps a single anchor order_id for compatibility. Fulfillment must therefore
-- materialize lines for every order in the anchored order's batch.
--
-- This is idempotent and also fires for future paid bills.

create or replace function public.sync_china_import_fulfillment_for_paid_bill()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_staged_at timestamptz;
  v_customer_id uuid;
begin
  if new.kind <> 'consolidation_shipping' or new.status <> 'paid' or new.order_id is null then
    return new;
  end if;

  select o.staged_at, o.user_id
    into v_staged_at, v_customer_id
  from public.china_import_orders o
  where o.id = new.order_id;

  if v_staged_at is null or v_customer_id is null then
    return new;
  end if;

  insert into public.china_import_fulfillment_items (
    order_id,
    order_item_index,
    product_id,
    product_name,
    image_url,
    variant_options,
    item_snapshot,
    ordered_quantity,
    status
  )
  select
    o.id,
    (item.ordinality - 1)::integer,
    (item.value->>'id')::uuid,
    coalesce(nullif(item.value->>'name', ''), 'Unnamed import item'),
    nullif(item.value->>'image_url', ''),
    case
      when jsonb_typeof(item.value->'variant_options') = 'object'
        then item.value->'variant_options'
      else '{}'::jsonb
    end,
    item.value,
    greatest(coalesce((item.value->>'quantity')::integer, 1), 1),
    'awaiting_arrival'
  from public.china_import_orders o
  cross join lateral jsonb_array_elements(o.items) with ordinality as item(value, ordinality)
  where o.staged_at = v_staged_at
    and o.user_id = v_customer_id
    and jsonb_typeof(o.items) = 'array'
  on conflict (order_id, order_item_index) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_sync_china_import_fulfillment_for_paid_bill
  on public.china_import_consolidation_bills;

create trigger trg_sync_china_import_fulfillment_for_paid_bill
after insert or update of status
on public.china_import_consolidation_bills
for each row
when (new.kind = 'consolidation_shipping' and new.status = 'paid')
execute function public.sync_china_import_fulfillment_for_paid_bill();

-- Repair all historical multi-order customer bills. A paid bill's anchor order
-- identifies the customer + closed batch; all sibling orders in that batch are
-- materialized exactly once.
insert into public.china_import_fulfillment_items (
  order_id,
  order_item_index,
  product_id,
  product_name,
  image_url,
  variant_options,
  item_snapshot,
  ordered_quantity,
  status
)
select
  o.id,
  (item.ordinality - 1)::integer,
  (item.value->>'id')::uuid,
  coalesce(nullif(item.value->>'name', ''), 'Unnamed import item'),
  nullif(item.value->>'image_url', ''),
  case
    when jsonb_typeof(item.value->'variant_options') = 'object'
      then item.value->'variant_options'
    else '{}'::jsonb
  end,
  item.value,
  greatest(coalesce((item.value->>'quantity')::integer, 1), 1),
  'awaiting_arrival'
from public.china_import_orders o
cross join lateral jsonb_array_elements(o.items) with ordinality as item(value, ordinality)
where jsonb_typeof(o.items) = 'array'
  and exists (
    select 1
    from public.china_import_consolidation_bills b
    join public.china_import_orders anchor on anchor.id = b.order_id
    where b.kind = 'consolidation_shipping'
      and b.status = 'paid'
      and anchor.staged_at = o.staged_at
      and anchor.user_id = o.user_id
  )
on conflict (order_id, order_item_index) do nothing;\nrevoke all on function public.sync_china_import_fulfillment_for_paid_bill() from public;\n
