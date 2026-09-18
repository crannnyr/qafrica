-- Step 5B: scope shipment payment notifications to the current batch.
-- Shipping itself remains gated only by the current batch's consolidation
-- bill status = sent. The paid/unpaid email split must also inspect the
-- consolidation bill belonging to this batch, not any older paid bill for
-- the same customer.

create or replace function ship_batch_customers(
  p_batch_key text,
  p_customer_id uuid default null,
  p_shipping_method_final text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_batch_id  uuid;
  v_now       timestamptz := now();
  v_paid      jsonb := '[]'::jsonb;
  v_unpaid    jsonb := '[]'::jsonb;
  v_count     int := 0;
  v_is_paid   boolean;
  r           record;
begin
  if p_shipping_method_final is not null and p_shipping_method_final not in ('flight', 'sea_freight') then
    return jsonb_build_object('error', 'Invalid shipping_method_final', 'status', 400);
  end if;

  for r in
    select distinct on (o.user_id)
      o.user_id as customer_id,
      coalesce(o.customer_name, c.full_name) as customer_name,
      c.email
    from china_import_orders o
    left join customers c on c.id = o.user_id
    join import_batch_bill_status bs
      on bs.batch_key = p_batch_key
     and bs.kind = 'consolidation_shipping'
     and bs.customer_id = o.user_id
     and bs.status = 'sent'
    where o.staged_at = p_batch_key::timestamptz
      and o.status = 'ordered_and_closed'
      and o.user_id is not null
      and (p_customer_id is null or o.user_id = p_customer_id)
    order by o.user_id, o.created_at
  loop
    update china_import_orders
    set status = 'shipped_and_closed', shipped_at = v_now, updated_at = v_now
    where staged_at = p_batch_key::timestamptz
      and user_id = r.customer_id
      and order_status_rank(status) < order_status_rank('shipped_and_closed');

    v_count := v_count + 1;

    if r.email is not null then
      -- IMPORTANT: only the consolidation bill attached to an order in
      -- this batch determines whether this shipment is a paid shipment.
      select exists(
        select 1
        from china_import_consolidation_bills b
        join china_import_orders bo on bo.id = b.order_id
        where b.user_id = r.customer_id
          and b.kind = 'consolidation_shipping'
          and b.status = 'paid'
          and bo.staged_at = p_batch_key::timestamptz
      ) into v_is_paid;

      if v_is_paid then
        v_paid := v_paid || jsonb_build_object(
          'customer_id', r.customer_id,
          'email', r.email,
          'name', coalesce(r.customer_name, 'there')
        );
      else
        v_unpaid := v_unpaid || jsonb_build_object(
          'customer_id', r.customer_id,
          'email', r.email,
          'name', coalesce(r.customer_name, 'there')
        );
      end if;
    end if;
  end loop;

  if v_count = 0 then
    return jsonb_build_object('error',
      case when p_customer_id is not null
        then 'This customer is not billed and at the ordered & closed stage, or has already shipped.'
        else 'No eligible customers to ship in this batch (must be billed and not yet shipped).'
      end, 'status', 400);
  end if;

  select id into v_batch_id
  from import_batches
  where opened_at = p_batch_key::timestamptz;

  if v_batch_id is not null then
    update import_batches
    set shipped_closed_at = case
          when not exists (
            select 1
            from china_import_orders
            where staged_at = p_batch_key::timestamptz
              and status = 'ordered_and_closed'
          ) then v_now
          else shipped_closed_at
        end,
        shipping_method_final = coalesce(p_shipping_method_final, shipping_method_final),
        updated_at = v_now
    where id = v_batch_id;
  end if;

  return jsonb_build_object(
    'shipped_count', v_count,
    'paid_recipients', v_paid,
    'unpaid_recipients', v_unpaid
  );
end;
$$;
