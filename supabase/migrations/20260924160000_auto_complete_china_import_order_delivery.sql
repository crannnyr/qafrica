create or replace function public.mark_china_import_order_delivered_if_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.china_import_fulfillment_items
    where order_id = new.order_id
  )
  and not exists (
    select 1
    from public.china_import_fulfillment_items
    where order_id = new.order_id
      and delivered_quantity < ordered_quantity
  ) then
    update public.china_import_orders
    set
      status = 'received',
      received_at = coalesce(received_at, now()),
      updated_at = now()
    where id = new.order_id
      and status not in ('cancelled', 'refunded', 'received');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_china_import_fulfillment_order_completion
on public.china_import_fulfillment_items;

create trigger trg_china_import_fulfillment_order_completion
after insert or update of delivered_quantity
on public.china_import_fulfillment_items
for each row
execute function public.mark_china_import_order_delivered_if_complete();

revoke all on function public.mark_china_import_order_delivered_if_complete() from public;
grant execute on function public.mark_china_import_order_delivered_if_complete() to service_role;