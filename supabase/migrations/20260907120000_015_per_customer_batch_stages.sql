-- Phase 6: per-customer batch stages.
--
-- Every stage of the closed-batch pipeline (consolidation bill, ship,
-- clearance bill, receive) now tracks status per (batch, customer) instead
-- of per batch. Every stage gets an individual action and a bulk action.
-- Bulk is just the same action looped over everyone in the batch who hasn't
-- reached that stage yet -- so it is always safe to run after individual
-- actions, nothing fires twice.
--
-- import_batch_bill_status was empty in production at the time of this
-- migration (no batch has ever been billed), so this rewrites it in place
-- rather than carrying forward legacy batch-wide rows.

-- ── 1. Bill status becomes per-customer ─────────────────────────────────
alter table import_batch_bill_status add column customer_id uuid;
alter table import_batch_bill_status add column admin_note text;

alter table import_batch_bill_status alter column customer_id set not null;
alter table import_batch_bill_status
  add constraint import_batch_bill_status_customer_id_fkey
  foreign key (customer_id) references customers(id);

alter table import_batch_bill_status drop constraint import_batch_bill_status_pkey;
alter table import_batch_bill_status add primary key (batch_key, kind, customer_id);

alter table import_batch_bill_status drop constraint import_batch_bill_status_status_check;
alter table import_batch_bill_status add constraint import_batch_bill_status_status_check
  check (status in ('draft', 'sent', 'cancelled'));

-- ── 2. Per-customer price overrides on top of the batch default ────────
create table import_batch_customer_item_prices (
  id uuid primary key default gen_random_uuid(),
  batch_key text not null,
  customer_id uuid not null references customers(id),
  product_id uuid not null references china_import_products(id),
  kind text not null default 'consolidation_shipping'
    check (kind in ('consolidation_shipping', 'clearance')),
  unit_amount_ngn numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_key, customer_id, product_id, kind)
);

comment on table import_batch_customer_item_prices is
  'Per-customer override on top of import_batch_item_bills (the batch
   default). Absence of a row here means "use the batch default price".';

-- ── 3. Lock trigger becomes customer-scoped ─────────────────────────────
-- import_batch_item_bills (the batch DEFAULT price) is deliberately left
-- unlocked -- it only ever feeds not-yet-billed customers going forward.
-- Once a specific customer is billed, their bill is a frozen snapshot in
-- china_import_consolidation_bills.line_items; editing the default later
-- cannot retroactively change it. What must lock is that customer's own
-- override and adjustment rows, so a price/adjustment can't be edited out
-- from under an already-sent bill.
create or replace function assert_batch_billing_unlocked()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_status   text;
  v_batch    text;
  v_kind     text;
  v_customer uuid;
begin
  v_batch    := coalesce(new.batch_key, old.batch_key);
  v_kind     := coalesce(new.kind, old.kind);
  v_customer := coalesce(new.customer_id, old.customer_id);

  select status into v_status
  from import_batch_bill_status
  where batch_key = v_batch and kind = v_kind and customer_id = v_customer;

  if v_status = 'sent' then
    raise exception 'This customer has already been billed for this batch and is locked.'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_ibcip_locked
  before insert or update or delete on import_batch_customer_item_prices
  for each row execute function assert_batch_billing_unlocked();

-- ── 4. Shared status-ordering helper ─────────────────────────────────────
create or replace function order_status_rank(p_status text)
returns int
language sql
immutable
as $$
  select array_position(
    array['pending', 'confirmed', 'ordered', 'ordered_and_closed',
          'shipped_and_closed', 'clearance_and_closed', 'received'],
    p_status
  );
$$;

-- ── 5. Close & bill: now per-customer, with an optional bulk mode ───────
-- p_customer_id = null  -> bulk: every priced, not-yet-billed customer.
-- p_customer_id given   -> just that one customer.
-- Zero-total customers (fully discounted) are still marked sent and
-- advanced, so a bulk run never gets stuck retrying them forever.
-- CREATE OR REPLACE does not replace a function when the signature changes
-- (an added parameter is a new signature) -- it creates a second, overloaded
-- function instead. That leaves two close_batch_billing()s and every 4-arg
-- call site becomes ambiguous. Drop the old signature explicitly first.
drop function if exists close_batch_billing(text, text, text, text);

create or replace function close_batch_billing(
  p_batch_key text,
  p_kind text,
  p_order_status_target text,
  p_batch_timestamp_column text,
  p_customer_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_bank         record;
  v_reason       text;
  v_recipients   jsonb := '[]'::jsonb;
  v_skipped      jsonb := '[]'::jsonb;
  v_customers    int   := 0;
  v_processed    int   := 0;
  v_expected     numeric := 0;
  v_batch_id     uuid;
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
  from import_admin_credentials where id = 1;

  v_reason := case when p_kind = 'clearance' then 'Clearance fee' else 'Consolidation & shipping fee' end;

  for r in
    with priced_customers as (
      -- Clearance is the second bill; it only applies to a customer once
      -- their orders in this batch have actually shipped. Consolidation
      -- (the first bill) has no such gate -- pricing alone is enough.
      select distinct b.customer_id
      from get_batch_customer_breakdown(p_batch_key) b
      where b.customer_id is not null
        and (p_customer_id is null or b.customer_id = p_customer_id)
        and exists (
          select 1 from import_batch_item_bills ib
          where ib.batch_key = p_batch_key and ib.kind = p_kind and ib.product_id = b.product_id
        )
        and (
          p_kind <> 'clearance'
          or exists (
            select 1 from china_import_orders o2
            where o2.staged_at = p_batch_key::timestamptz and o2.user_id = b.customer_id
              and order_status_rank(o2.status) >= order_status_rank('shipped_and_closed')
          )
        )
    ),
    not_yet_billed as (
      select pc.customer_id
      from priced_customers pc
      where not exists (
        select 1 from import_batch_bill_status s
        where s.batch_key = p_batch_key and s.kind = p_kind
          and s.customer_id = pc.customer_id and s.status = 'sent'
      )
    ),
    lines as (
      select
        b.customer_id,
        b.customer_name,
        sum(coalesce(cip.unit_amount_ngn, ib.unit_amount_ngn) * b.qty) as items_total,
        jsonb_agg(
          jsonb_build_object(
            'label', b.product_name || ' × ' || b.qty,
            'amount_ngn', round(coalesce(cip.unit_amount_ngn, ib.unit_amount_ngn) * b.qty, 2)
          ) order by b.product_name
        ) as item_lines
      from get_batch_customer_breakdown(p_batch_key) b
      join not_yet_billed nyb on nyb.customer_id = b.customer_id
      join import_batch_item_bills ib
        on ib.product_id = b.product_id and ib.batch_key = p_batch_key and ib.kind = p_kind
      left join import_batch_customer_item_prices cip
        on cip.batch_key = p_batch_key and cip.kind = p_kind
       and cip.customer_id = b.customer_id and cip.product_id = b.product_id
      group by b.customer_id, b.customer_name
    ),
    adj as (
      select customer_id,
             sum(amount_ngn) as adj_total,
             jsonb_agg(jsonb_build_object('label', label, 'amount_ngn', round(amount_ngn, 2)) order by created_at) as adj_lines
      from import_batch_customer_adjustments
      where batch_key = p_batch_key and kind = p_kind
      group by customer_id
    )
    select l.customer_id, l.customer_name,
           round(l.items_total + coalesce(a.adj_total, 0), 2) as total,
           (l.item_lines || coalesce(a.adj_lines, '[]'::jsonb)) as line_items,
           c.email
    from lines l
    left join adj a on a.customer_id = l.customer_id
    left join customers c on c.id = l.customer_id
  loop
    v_processed := v_processed + 1;

    update china_import_orders
    set status = p_order_status_target, updated_at = now()
    where staged_at = p_batch_key::timestamptz and user_id = r.customer_id
      and order_status_rank(status) < order_status_rank(p_order_status_target);

    insert into import_batch_bill_status (batch_key, kind, customer_id, status, sent_at, recipients_count)
    values (p_batch_key, p_kind, r.customer_id, 'sent', now(), 1)
    on conflict (batch_key, kind, customer_id) do update
      set status = 'sent', sent_at = now(), recipients_count = 1;

    if r.total <= 0 then
      v_skipped := v_skipped || jsonb_build_object(
        'customer_id', r.customer_id, 'name', coalesce(r.customer_name, 'Unknown'), 'total_ngn', r.total
      );
      continue;
    end if;

    insert into china_import_consolidation_bills (
      user_id, order_id, amount_ngn, reason, kind, line_items,
      bank_account_number, bank_account_name, bank_name
    ) values (
      r.customer_id,
      (select id from china_import_orders
        where staged_at = p_batch_key::timestamptz and user_id = r.customer_id
        order by created_at limit 1),
      r.total, v_reason, p_kind, r.line_items,
      v_bank.bank_account_number, v_bank.bank_account_name, v_bank.bank_name
    );

    v_customers := v_customers + 1;
    v_expected  := v_expected + r.total;

    if r.email is not null then
      v_recipients := v_recipients || jsonb_build_object(
        'email', r.email, 'name', coalesce(r.customer_name, 'there'), 'amount_ngn', r.total
      );
    end if;
  end loop;

  if v_processed = 0 then
    return jsonb_build_object('error',
      case when p_customer_id is not null
        then 'This customer has no priced items in this batch yet, or has already been billed.'
        else 'No matching priced, not-yet-billed customers found in this batch.'
      end, 'status', 400);
  end if;

  select id into v_batch_id from import_batches where opened_at = p_batch_key::timestamptz;
  if v_batch_id is not null then
    if p_batch_timestamp_column = 'ordered_closed_at' then
      update import_batches set ordered_closed_at = now(), updated_at = now() where id = v_batch_id;
    else
      update import_batches set clearance_closed_at = now(), updated_at = now() where id = v_batch_id;
    end if;
  end if;

  return jsonb_build_object(
    'customers_billed', v_customers,
    'expected_total_ngn', v_expected,
    'recipients', v_recipients,
    'skipped', v_skipped
  );
end;
$$;

-- ── 6. Ship: per-customer, with an optional bulk mode ────────────────────
-- Gated on that customer's consolidation bill being 'sent' -- not paid.
-- Ships regardless of payment status; the caller uses the returned
-- paid/unpaid recipient split to pick the right email template, exactly as
-- the old batch-wide action did.
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
      on bs.batch_key = p_batch_key and bs.kind = 'consolidation_shipping'
     and bs.customer_id = o.user_id and bs.status = 'sent'
    where o.staged_at = p_batch_key::timestamptz
      and o.status = 'ordered_and_closed'
      and o.user_id is not null
      and (p_customer_id is null or o.user_id = p_customer_id)
    order by o.user_id, o.created_at
  loop
    update china_import_orders
    set status = 'shipped_and_closed', shipped_at = v_now, updated_at = v_now
    where staged_at = p_batch_key::timestamptz and user_id = r.customer_id
      and order_status_rank(status) < order_status_rank('shipped_and_closed');

    v_count := v_count + 1;

    if r.email is not null then
      select exists(
        select 1 from china_import_consolidation_bills
        where user_id = r.customer_id and kind = 'consolidation_shipping' and status = 'paid'
      ) into v_is_paid;

      if v_is_paid then
        v_paid := v_paid || jsonb_build_object('customer_id', r.customer_id, 'email', r.email, 'name', coalesce(r.customer_name, 'there'));
      else
        v_unpaid := v_unpaid || jsonb_build_object('customer_id', r.customer_id, 'email', r.email, 'name', coalesce(r.customer_name, 'there'));
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

  select id into v_batch_id from import_batches where opened_at = p_batch_key::timestamptz;
  if v_batch_id is not null then
    update import_batches
    set shipped_closed_at = case
          when not exists (
            select 1 from china_import_orders
            where staged_at = p_batch_key::timestamptz and status = 'ordered_and_closed'
          ) then v_now
          else shipped_closed_at
        end,
        shipping_method_final = coalesce(p_shipping_method_final, shipping_method_final),
        updated_at = v_now
    where id = v_batch_id;
  end if;

  return jsonb_build_object('shipped_count', v_count, 'paid_recipients', v_paid, 'unpaid_recipients', v_unpaid);
end;
$$;

-- ── 7. Receive: generalized from per-order to per-customer, with bulk ───
-- A customer's clearance bill (most recent, this kind) must be 'paid'.
-- Marks every one of that customer's orders in this batch that's ready.
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
  v_now                timestamptz := now();
begin
  with eligible as (
    select distinct o.user_id as customer_id
    from china_import_orders o
    where o.staged_at = p_batch_key::timestamptz
      and o.status = 'clearance_and_closed'
      and o.user_id is not null
      and (p_customer_id is null or o.user_id = p_customer_id)
      and coalesce((
        select b.status from china_import_consolidation_bills b
        where b.user_id = o.user_id and b.kind = 'clearance'
        order by b.created_at desc limit 1
      ), '') = 'paid'
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
        then 'This customer is not at clearance & closed with a paid clearance bill yet.'
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

-- ── 8. Sourcing totals: one row per product, for placing 1688 orders ────
create or replace function get_batch_sourcing_totals(p_batch_key text)
returns table(
  product_id uuid, product_name text, product_image text,
  source_url text, total_qty bigint, customers_count bigint
)
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select
    b.product_id, b.product_name,
    coalesce(b.product_image, p.image_url) as product_image,
    p.source_url,
    sum(b.qty)::bigint as total_qty,
    count(distinct b.customer_id)::bigint as customers_count
  from get_batch_customer_breakdown(p_batch_key) b
  left join china_import_products p on p.id = b.product_id
  where b.customer_id is not null
  group by b.product_id, b.product_name, coalesce(b.product_image, p.image_url), p.source_url
  order by total_qty desc, product_name asc;
$$;

-- ── 9. Cancel a sent (but unpaid) bill, so it can be corrected & resent ──
create or replace function cancel_batch_customer_bill(
  p_batch_key text,
  p_kind text,
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_bill_id     uuid;
  v_bill_status text;
begin
  if p_kind not in ('consolidation_shipping', 'clearance') then
    return jsonb_build_object('error', 'Invalid bill kind', 'status', 400);
  end if;

  select id, status into v_bill_id, v_bill_status
  from china_import_consolidation_bills
  where user_id = p_customer_id and kind = p_kind
    and order_id in (
      select id from china_import_orders
      where staged_at = p_batch_key::timestamptz and user_id = p_customer_id
    )
  order by created_at desc limit 1;

  if v_bill_id is null then
    return jsonb_build_object('error', 'No bill found for this customer in this batch.', 'status', 404);
  end if;
  if v_bill_status = 'paid' then
    return jsonb_build_object('error', 'This bill is already paid and cannot be cancelled here.', 'status', 409);
  end if;

  update china_import_consolidation_bills set status = 'cancelled' where id = v_bill_id;

  update import_batch_bill_status
  set status = 'draft', sent_at = null
  where batch_key = p_batch_key and kind = p_kind and customer_id = p_customer_id;

  return jsonb_build_object('success', true, 'cancelled_bill_id', v_bill_id);
end;
$$;
