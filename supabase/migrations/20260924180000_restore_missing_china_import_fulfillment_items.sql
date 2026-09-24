-- Restore fulfillment lines for the two paid shipping orders that were
-- created/paid after the original bulk backfill migration ran.
-- Idempotent: existing fulfillment lines are left untouched.

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
where o.code in ('6GB4CH', 'BQRY4Q')
  and jsonb_typeof(o.items) = 'array'
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

do $$
declare
  expected_lines integer;
  actual_lines integer;
begin
  select coalesce(sum(jsonb_array_length(o.items)), 0)
  into expected_lines
  from public.china_import_orders o
  where o.code in ('6GB4CH', 'BQRY4Q')
    and exists (
      select 1
      from public.china_import_consolidation_bills b
      where b.order_id = o.id
        and b.kind = 'consolidation_shipping'
        and b.status = 'paid'
    );

  select count(*)
  into actual_lines
  from public.china_import_fulfillment_items fi
  join public.china_import_orders o on o.id = fi.order_id
  where o.code in ('6GB4CH', 'BQRY4Q');

  if actual_lines <> expected_lines then
    raise exception
      'Targeted fulfillment restore failed: expected % lines, found %',
      expected_lines, actual_lines;
  end if;
end $$;
