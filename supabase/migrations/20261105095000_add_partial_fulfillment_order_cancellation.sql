-- Partial cancellation for China-import orders with existing fulfillment history.
-- Refund only the ordered units not yet received, shipped, or delivered.
-- Retain fulfillment counters and status; record each cancelled quantity as an audit event.

create or replace function public.cancel_china_import_unfulfilled_balance(
  p_order_id uuid,
  p_reason text,
  p_manager_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_order public.china_import_orders%rowtype;
  v_fi public.china_import_fulfillment_items%rowtype;
  v_bill record;
  v_refund_id uuid;
  v_order_items jsonb;
  v_refund_items jsonb := '[]'::jsonb;
  v_cancelled_summary jsonb := '[]'::jsonb;
  v_line_item jsonb;
  v_line_price numeric;
  v_line_qty integer;
  v_protected_qty integer;
  v_cancel_qty integer;
  v_line_value numeric;
  v_jumia_fee numeric := 0;
  v_refund_base numeric := 0;
  v_refund_amount numeric := 0;
  v_cancellation_fee numeric := 0;
  v_is_product_issue boolean := false;
  v_policy text;
  v_bill_id uuid := null;
  v_bill_is_unpaid boolean := false;
  v_total_lines integer;
  v_fulfillment_lines integer;
  v_now timestamptz := now();
  v_event_count integer := 0;
begin
  perform public.assert_admin_or_service();

  if p_order_id is null then raise exception 'Order ID is required'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'A cancellation reason is required';
  end if;

  select * into v_order
  from public.china_import_orders
  where id = p_order_id
  for update;
  if not found then raise exception 'Order not found'; end if;

  if lower(coalesce(v_order.status, '')) in ('cancelled', 'canceled', 'refunded') then
    raise exception 'This order has already been cancelled or refunded';
  end if;
  if coalesce(v_order.payment_status, '') <> 'paid' then
    raise exception 'Only paid orders can be cancelled through the refund workflow';
  end if;

  v_order_items := coalesce(v_order.items, '[]'::jsonb);
  select count(*) into v_total_lines from jsonb_array_elements(v_order_items);
  select count(*) into v_fulfillment_lines
  from public.china_import_fulfillment_items where order_id = p_order_id;

  if v_total_lines = 0 or v_fulfillment_lines <> v_total_lines then
    raise exception 'Fulfillment records do not match this order. Reconcile the fulfillment items before cancelling the remaining balance.';
  end if;

  if exists (
    select 1 from public.china_import_fulfillment_items fi
    where fi.order_id = p_order_id
      and (fi.order_item_index < 0 or fi.order_item_index >= v_total_lines)
  ) then
    raise exception 'Fulfillment records contain an unmatched order line. Reconcile before cancelling.';
  end if;

  if exists (
    select 1 from public.china_import_refunds r
    where r.original_order_id = p_order_id
      and r.status in ('pending', 'submitted')
  ) then
    raise exception 'A refund for this order is already in progress';
  end if;

  select b.id, b.status, b.amount_ngn into v_bill
  from public.china_import_consolidation_bills b
  where b.order_id = p_order_id
    and b.kind = 'consolidation_shipping'
    and b.status <> 'cancelled'
  order by b.created_at desc
  limit 1;

  if found then
    v_bill_id := v_bill.id;
    v_bill_is_unpaid := v_bill.status <> 'paid';
  end if;

  v_is_product_issue :=
    lower(trim(p_reason)) like '%defective%'
    or lower(trim(p_reason)) like '%faulty%'
    or lower(trim(p_reason)) like '%damaged%'
    or lower(trim(p_reason)) like '%incorrect%'
    or lower(trim(p_reason)) like '%wrong item%'
    or lower(trim(p_reason)) like '%materially different%';

  for v_fi in
    select * from public.china_import_fulfillment_items
    where order_id = p_order_id
    order by order_item_index
    for update
  loop
    v_line_item := v_order_items -> v_fi.order_item_index;
    if v_line_item is null or jsonb_typeof(v_line_item) <> 'object' then
      raise exception 'An order item is missing from the fulfillment snapshot. Reconcile before cancelling.';
    end if;

    v_line_qty := coalesce(
      nullif(v_line_item ->> 'quantity', '')::integer,
      v_fi.ordered_quantity
    );
    if v_line_qty <> v_fi.ordered_quantity then
      raise exception 'Order quantity and fulfillment quantity differ for %; reconcile before cancelling.', v_fi.product_name;
    end if;

    v_line_price := coalesce(
      nullif(v_line_item ->> 'price_ngn', '')::numeric,
      nullif(v_fi.item_snapshot ->> 'price_ngn', '')::numeric
    );

    v_protected_qty := greatest(
      v_fi.received_quantity,
      v_fi.shipped_quantity,
      v_fi.delivered_quantity
    );
    v_cancel_qty := greatest(v_line_qty - v_protected_qty, 0);

    if v_cancel_qty > 0 then
      if v_line_price is null or v_line_price < 0 then
        raise exception 'The unit price for % cannot be verified. Correct the order snapshot before cancelling.', v_fi.product_name;
      end if;

      v_line_value := round(v_line_price * v_cancel_qty, 2);
      v_refund_base := v_refund_base + v_line_value;
      if coalesce(v_order.delivery_type, '') = 'to_qafrica' then
        v_jumia_fee := v_jumia_fee + (200 * v_cancel_qty);
      end if;

      v_refund_items := v_refund_items || jsonb_build_array(
        jsonb_set(
          jsonb_set(v_line_item, '{quantity}', to_jsonb(v_cancel_qty), true),
          '{cancellation_type}', to_jsonb('unfulfilled_balance'), true
        )
      );

      v_cancelled_summary := v_cancelled_summary || jsonb_build_array(jsonb_build_object(
        'fulfillment_item_id', v_fi.id,
        'order_item_index', v_fi.order_item_index,
        'product_id', v_fi.product_id,
        'product_name', v_fi.product_name,
        'cancelled_quantity', v_cancel_qty,
        'received_quantity', v_fi.received_quantity,
        'shipped_quantity', v_fi.shipped_quantity,
        'delivered_quantity', v_fi.delivered_quantity,
        'unit_price_ngn', v_line_price,
        'refund_base_ngn', v_line_value
      ));

      insert into public.china_import_fulfillment_events (
        fulfillment_item_id,event_type,status,location,note,metadata,created_by
      ) values (
        v_fi.id,'balance_cancelled',v_fi.status,'QAfrica HQ',trim(p_reason),
        jsonb_build_object(
          'cancelled_quantity',v_cancel_qty,
          'ordered_quantity',v_line_qty,
          'received_quantity',v_fi.received_quantity,
          'allocated_quantity',v_fi.allocated_quantity,
          'shipped_quantity',v_fi.shipped_quantity,
          'delivered_quantity',v_fi.delivered_quantity,
          'reason',trim(p_reason)
        ),
        p_manager_id
      );
      v_event_count := v_event_count + 1;
    end if;
    -- Fulfillment counters/status are not mutated; the cancellation event and
    -- parent order status record the outstanding balance cancellation.
  end loop;

  if v_refund_base <= 0 then
    raise exception 'There are no remaining unreceived, unshipped units eligible for cancellation';
  end if;

  v_refund_base := round(v_refund_base + v_jumia_fee, 2);

  if v_is_product_issue then
    v_refund_amount := v_refund_base;
    v_cancellation_fee := 0;
    v_policy := '7.3';
  elsif v_bill_id is null then
    v_refund_amount := v_refund_base;
    v_cancellation_fee := 0;
    v_policy := '7.1';
  elsif v_bill_is_unpaid then
    v_cancellation_fee := round(v_refund_base * 0.20, 2);
    v_refund_amount := round(v_refund_base - v_cancellation_fee, 2);
    v_policy := '7.2';
  else
    -- Do not charge a second 20% fee against an already-paid consolidation bill.
    v_cancellation_fee := 0;
    v_refund_amount := v_refund_base;
    v_policy := '7.1';
  end if;

  insert into public.china_import_refunds (
    original_order_id,code,customer_name,user_id,items,total_ngn,
    refund_amount_ngn,cancellation_fee_ngn,refund_policy,billing_bill_id,
    payment_method,payment_reference,refund_method,cancel_reason,cancellation_type
  ) values (
    v_order.id,v_order.code,v_order.customer_name,v_order.user_id,v_refund_items,
    v_refund_base,v_refund_amount,v_cancellation_fee,v_policy,v_bill_id,
    v_order.payment_method,v_order.payment_reference,
    case when v_order.payment_method = 'paystack' then 'paystack' else 'bank' end,
    trim(p_reason),'partial_balance'
  )
  returning id into v_refund_id;

  update public.china_import_orders
  set status = 'cancelled', updated_at = v_now
  where id = p_order_id;

  perform public.reconcile_import_batch_after_order_cancel(p_order_id);

  return jsonb_build_object(
    'success',true,'refund_id',v_refund_id,'order_id',p_order_id,
    'order_code',v_order.code,'cancelled_items',v_cancelled_summary,
    'refund_base_ngn',v_refund_base,'refund_amount_ngn',v_refund_amount,
    'cancellation_fee_ngn',v_cancellation_fee,'refund_policy',v_policy,
    'billing_bill_id',v_bill_id,'fulfilled_quantities_preserved',true,
    'fulfillment_events_created',v_event_count
  );
end;
$function$;

revoke all on function public.cancel_china_import_unfulfilled_balance(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.cancel_china_import_unfulfilled_balance(uuid, text, uuid) to service_role;
