-- Consolidation billing: batch item prices are shipping charges, not a second product charge.
--
-- Customers have already paid the product prices stored in
-- china_import_orders.items[].price_ngn. For the consolidation & shipping
-- bill, import_batch_item_bills.unit_amount_ngn (or the per-customer override)
-- is therefore used ONLY as the shipping price per unit.
--
-- Clearance keeps the existing per-product billing behavior.

create or replace function public.close_batch_billing(
  p_batch_key text, p_kind text, p_order_status_target text,
  p_batch_timestamp_column text, p_customer_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_bank         record;
  v_reason       text;
  v_recipients   jsonb := '[]'::jsonb;
  v_skipped      jsonb := '[]'::jsonb;
  v_customers    int   := 0;
  v_processed    int   := 0;
  v_expected     numeric := 0;
  v_batch_id     uuid;
  v_now          timestamptz := now();
  r              record;
begin
  if p_kind not in ('consolidation_shipping', 'clearance') then
    return jsonb_build_object('error', 'Invalid bill kind', 'status', 400);
  end if;

  if p_batch_timestamp_column not in ('ordered_closed_at', 'clearance_closed_at') then
    return jsonb_build_object('error', 'Invalid batch timestamp column', 'status', 400);
  end if;

  select bank_account_number, bank_account_name, bank_name
  into v_bank
  from import_admin_credentials
  where id = 1;

  v_reason := case
    when p_kind = 'clearance' then 'Clearance fee'
    else 'Consolidation & shipping fee'
  end;

  for r in
    with eligible as (
      select e.customer_id
      from get_batch_billing_eligible_customers(p_batch_key, p_kind) e
      where p_customer_id is null or e.customer_id = p_customer_id
    ),
    lines as (
      select
        b.customer_id,
        b.customer_name,

        -- Consolidation & shipping: NEVER bill the product price again.
        -- The batch item bill price is the shipping price per unit. Customer-specific overrides are ignored.
        sum(
          case
            when p_kind = 'clearance'
              then coalesce(cip.unit_amount_ngn, ib.unit_amount_ngn) * b.qty
            else 0
          end
        ) as items_total,

        sum(
          case
            when p_kind = 'consolidation_shipping'
              and coalesce(o.prepaid_shipping_ngn, 0) <= 0
              and b.item_shipping_method in ('sea_freight', 'flight')
              then ib.unit_amount_ngn * b.qty
            else 0
          end
        ) as shipping_total,

        jsonb_agg(
          jsonb_build_object(
            'label', b.product_name || ' × ' || b.qty,
            'amount_ngn', round(coalesce(cip.unit_amount_ngn, ib.unit_amount_ngn) * b.qty, 2),
            'shipping_method', b.item_shipping_method
          )
          order by b.product_name
        ) filter (where p_kind = 'clearance') as item_lines,

        jsonb_agg(
          jsonb_build_object(
            'label',
              case
                when b.item_shipping_method = 'sea_freight'
                  then 'Sea shipping fee — ' || b.product_name || ' × ' || b.qty
                when b.item_shipping_method = 'flight'
                  then 'Air shipping fee — ' || b.product_name || ' × ' || b.qty
                else 'Shipping fee — ' || b.product_name || ' × ' || b.qty
              end,
            'amount_ngn',
              round(ib.unit_amount_ngn * b.qty, 2),
            'shipping_method', b.item_shipping_method,
            'billing_type', 'shipping'
          )
          order by b.product_name
        ) filter (
          where p_kind = 'consolidation_shipping'
            and coalesce(o.prepaid_shipping_ngn, 0) <= 0
            and b.item_shipping_method in ('sea_freight', 'flight')
            and ib.unit_amount_ngn > 0
        ) as shipping_lines

      from get_batch_customer_breakdown(p_batch_key) b
      join eligible el on el.customer_id = b.customer_id
      join import_batch_item_bills ib
        on ib.product_id = b.product_id
       and ib.batch_key = p_batch_key
       and ib.kind = p_kind
      left join import_batch_customer_item_prices cip
        on cip.batch_key = p_batch_key
       and cip.kind = p_kind
       and cip.customer_id = b.customer_id
       and cip.product_id = b.product_id
      left join china_import_orders o
        on o.id = b.order_id
      group by b.customer_id, b.customer_name
    ),
    adj as (
      select
        customer_id,
        sum(amount_ngn) as adj_total,
        jsonb_agg(
          jsonb_build_object(
            'label', label,
            'amount_ngn', round(amount_ngn, 2)
          )
          order by created_at
        ) as adj_lines
      from import_batch_customer_adjustments
      where batch_key = p_batch_key
        and kind = p_kind
      group by customer_id
    )
    select
      l.customer_id,
      l.customer_name,
      round(
        l.items_total
        + case
            when p_kind = 'consolidation_shipping'
              then coalesce(l.shipping_total, 0)
            else 0
          end
        + coalesce(a.adj_total, 0),
        2
      ) as total,
      (
        coalesce(l.item_lines, '[]'::jsonb)
        || case
             when p_kind = 'consolidation_shipping'
               then coalesce(l.shipping_lines, '[]'::jsonb)
             else '[]'::jsonb
           end
        || coalesce(a.adj_lines, '[]'::jsonb)
      ) as line_items,
      c.email
    from lines l
    left join adj a on a.customer_id = l.customer_id
    left join customers c on c.id = l.customer_id
  loop
    v_processed := v_processed + 1;

    update china_import_orders
    set status = p_order_status_target,
        updated_at = v_now
    where staged_at = p_batch_key::timestamptz
      and user_id = r.customer_id
      and order_status_rank(status) < order_status_rank(p_order_status_target);

    insert into import_batch_bill_status (
      batch_key, kind, customer_id, status, sent_at, fully_priced_at, recipients_count
    )
    values (
      p_batch_key, p_kind, r.customer_id, 'sent', v_now, v_now, 1
    )
    on conflict (batch_key, kind, customer_id) do update
      set status = 'sent',
          sent_at = v_now,
          fully_priced_at = coalesce(import_batch_bill_status.fully_priced_at, v_now),
          recipients_count = 1;

    if r.total <= 0 then
      v_skipped := v_skipped || jsonb_build_object(
        'customer_id', r.customer_id,
        'name', coalesce(r.customer_name, 'Unknown'),
        'total_ngn', r.total
      );
      continue;
    end if;

    insert into china_import_consolidation_bills (
      user_id, order_id, amount_ngn, reason, kind, line_items,
      bank_account_number, bank_account_name, bank_name
    )
    values (
      r.customer_id,
      (
        select id
        from china_import_orders
        where staged_at = p_batch_key::timestamptz
          and user_id = r.customer_id
        order by created_at
        limit 1
      ),
      r.total,
      v_reason,
      p_kind,
      r.line_items,
      v_bank.bank_account_number,
      v_bank.bank_account_name,
      v_bank.bank_name
    );

    v_customers := v_customers + 1;
    v_expected := v_expected + r.total;

    if r.email is not null then
      v_recipients := v_recipients || jsonb_build_object(
        'email', r.email,
        'name', coalesce(r.customer_name, 'there'),
        'amount_ngn', r.total,
        'line_items', r.line_items
      );
    end if;
  end loop;

  if v_processed = 0 then
    return jsonb_build_object(
      'error',
      case
        when p_customer_id is not null
          then 'This customer has no priced items in this batch yet, or has already been billed.'
        else 'No matching fully-priced, not-yet-billed customers found in this batch.'
      end,
      'status', 400
    );
  end if;

  select id
  into v_batch_id
  from import_batches
  where opened_at = p_batch_key::timestamptz;

  if v_batch_id is not null then
    if p_batch_timestamp_column = 'ordered_closed_at' then
      update import_batches
      set ordered_closed_at = v_now,
          updated_at = v_now
      where id = v_batch_id;
    else
      update import_batches
      set clearance_closed_at = v_now,
          updated_at = v_now
      where id = v_batch_id;
    end if;
  end if;

  return jsonb_build_object(
    'customers_billed', v_customers,
    'expected_total_ngn', v_expected,
    'recipients', v_recipients,
    'skipped', v_skipped
  );
end;
$function$;
