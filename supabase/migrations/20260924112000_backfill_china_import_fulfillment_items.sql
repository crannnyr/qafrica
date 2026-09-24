-- Backfill item-level fulfillment rows for existing paid China import shipping.
-- Idempotent: only creates a fulfillment line when one does not already exist.
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
  coalesce(nullif(item.value->>'name',''), 'Unnamed import item'),
  nullif(item.value->>'image_url',''),
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
    where b.order_id = o.id
      and b.kind = 'consolidation_shipping'
      and b.status = 'paid'
  )
  and not exists (
    select 1
    from public.china_import_fulfillment_items fi
    where fi.order_id = o.id
      and fi.order_item_index = (item.ordinality - 1)::integer
  );

-- Safety check: every paid-shipping order now has the same number of
-- fulfillment lines as its order snapshot.
do $$
declare
  bad_orders integer;
begin
  select count(*)
  into bad_orders
  from public.china_import_orders o
  where exists (
    select 1
    from public.china_import_consolidation_bills b
    where b.order_id = o.id
      and b.kind = 'consolidation_shipping'
      and b.status = 'paid'
  )
  and (
    select count(*)
    from jsonb_array_elements(o.items)
  ) <> (
    select count(*)
    from public.china_import_fulfillment_items fi
    where fi.order_id = o.id
  );

  if bad_orders > 0 then
    raise exception 'Fulfillment backfill verification failed for % orders', bad_orders;
  end if;
end $$;
