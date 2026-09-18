-- Step 5C: scope clearance payment checks to the current batch.
--
-- The receive gate must not use a customer's latest clearance bill globally:
-- an older paid clearance bill from another batch must never unlock receipt
-- for the current batch. The paid bill must belong to an order in this batch.

create or replace function mark_batch_customers_received(
  p_batch_key text,
  p_customer_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_updated_customers uuid[];
  v_count             int;
  v_recipients        jsonb;
  v_now               timestamptz := now();
begin
  with eligible as (
    select distinct o.user_id as customer_id
    from china_import_orders o
    where o.staged_at = p_batch_key::timestamptz
      and o.status = 'clearance_and_closed'
      and o.user_id is not null
      and (p_customer_id is null or o.user_id = p_customer_id)
      and exists (
        select 1
        from china_import_consolidation_bills b
        join china_import_orders bo
          on bo.id = b.order_id
        where b.user_id = o.user_id
          and b.kind = 'clearance'
          and b.status = 'paid'
          and bo.staged_at = p_batch_key::timestamptz
          and bo.user_id = o.user_id
      )
  ),
  updated as (
    update china_import_orders o
    set status = 'received', received_at = v_now, updated_at = v_now
    where o.staged_at = p_batch_key::timestamptz
      and o.status = 'clearance_and_closed'
      and o.user_id in (select customer_id from eligible)
    returning o.user_id
  )
  select array_agg(distinct user_id) into v_updated_customers from updated;

  v_count := coalesce(array_length(v_updated_customers, 1), 0);

  if v_count = 0 then
    return jsonb_build_object('error',
      case when p_customer_id is not null
        then 'This customer is not at clearance & closed with a paid clearance bill for this batch yet.'
        else 'No eligible customers to mark received in this batch.'
      end, 'status', 400);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'customer_id', c.id, 'email', c.email, 'name', coalesce(c.full_name, 'there')
  )), '[]'::jsonb)
  into v_recipients
  from customers c
  where c.id = any(v_updated_customers);

  return jsonb_build_object('received_count', v_count, 'recipients', v_recipients);
end;
$$;
