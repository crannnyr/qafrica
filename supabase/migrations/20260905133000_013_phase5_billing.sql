-- Phase 5: per-customer bill adjustments, transactional billing close,
-- direct-transfer-only bills, and the paid/unpaid ledger.
--
-- Adjustments were chosen over per-customer-per-product price overrides. The
-- per-product unit price in import_batch_item_bills stays the single source of
-- truth, so the same product costs everyone the same and still reconciles
-- against one 1688 purchase. On top of that, each customer can carry named
-- adjustment lines:
--
--   customer total = SUM(unit_price × qty) + SUM(adjustments)
--
-- Adjustments may be negative (a discount or goodwill credit).
create table if not exists import_batch_customer_adjustments (
  id          uuid primary key default gen_random_uuid(),
  batch_key   text not null,
  customer_id uuid not null,
  kind        text not null default 'consolidation_shipping'
                check (kind in ('consolidation_shipping', 'clearance')),
  label       text not null,
  amount_ngn  numeric not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_ibca_batch
  on import_batch_customer_adjustments (batch_key, kind, customer_id);

alter table import_batch_customer_adjustments enable row level security;

-- Adjustments lock once the bill is sent, exactly like item pricing. Without
-- this an admin could silently change what a customer owes after they had
-- already been told the figure.
create or replace function public.assert_batch_billing_unlocked()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_status text;
  v_batch  text;
  v_kind   text;
begin
  v_batch := coalesce(new.batch_key, old.batch_key);
  v_kind  := coalesce(new.kind, old.kind);

  select status into v_status
  from import_batch_bill_status
  where batch_key = v_batch and kind = v_kind;

  if v_status = 'sent' then
    raise exception 'This batch has already been billed and is locked.'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$function$;

drop trigger if exists trg_ibca_locked on import_batch_customer_adjustments;
create trigger trg_ibca_locked
  before insert or update or delete on import_batch_customer_adjustments
  for each row execute function public.assert_batch_billing_unlocked();

revoke all on table import_batch_customer_adjustments from public, anon, authenticated;
grant  select, insert, update, delete on table import_batch_customer_adjustments to service_role;

-- Batch billing close, in one transaction.
--
-- Replaces the JS implementation in china-import's closeBatchBilling(), which
-- looped inserts one customer at a time with no transaction: a failure partway
-- through left some customers billed and the batch unlocked, and rerunning
-- would double-bill the ones already inserted. Here it is all-or-nothing.
--
-- Two behaviour changes:
--   1. Per-customer adjustment lines are included in the total and appear as
--      their own entries in line_items.
--   2. Bills carry the bank details for a direct transfer. Paystack is no
--      longer part of the bill flow at all.
--
-- A customer whose adjustments cancel out their items ends up at zero or
-- below. Billing them is wrong, but silently dropping them is worse, so they
-- are returned in `skipped` for the UI to surface.
create or replace function public.close_batch_billing(
  p_batch_key text,
  p_kind      text,
  p_order_status_target text,
  p_batch_timestamp_column text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_status        text;
  v_priced_count  int;
  v_bank          record;
  v_reason        text;
  v_recipients    jsonb := '[]'::jsonb;
  v_skipped       jsonb := '[]'::jsonb;
  v_customers     int   := 0;
  v_expected      numeric := 0;
  v_batch_id      uuid;
  r               record;
begin
  if p_kind not in ('consolidation_shipping', 'clearance') then
    return jsonb_build_object('error', 'Invalid bill kind', 'status', 400);
  end if;
  if p_batch_timestamp_column not in ('ordered_closed_at', 'clearance_closed_at') then
    return jsonb_build_object('error', 'Invalid batch timestamp column', 'status', 400);
  end if;

  select status into v_status
  from import_batch_bill_status
  where batch_key = p_batch_key and kind = p_kind;

  if v_status = 'sent' then
    return jsonb_build_object('error', 'This batch has already been billed and is locked.', 'status', 409);
  end if;

  select count(*) into v_priced_count
  from import_batch_item_bills
  where batch_key = p_batch_key and kind = p_kind;

  if v_priced_count = 0 then
    return jsonb_build_object('error', 'No pricing has been entered for this batch yet.', 'status', 400);
  end if;

  select bank_account_number, bank_account_name, bank_name
  into v_bank
  from import_admin_credentials where id = 1;

  v_reason := case when p_kind = 'clearance'
                   then 'Clearance fee (batch)'
                   else 'Consolidation & shipping fee (batch)' end;

  for r in
    with lines as (
      select b.customer_id,
             b.customer_name,
             sum(ib.unit_amount_ngn * b.qty) as items_total,
             jsonb_agg(
               jsonb_build_object(
                 'label', b.product_name || ' × ' || b.qty,
                 'amount_ngn', round(ib.unit_amount_ngn * b.qty, 2)
               ) order by b.product_name
             ) as item_lines
      from get_batch_customer_breakdown(p_batch_key) b
      join import_batch_item_bills ib
        on ib.product_id = b.product_id
       and ib.batch_key  = p_batch_key
       and ib.kind       = p_kind
      where b.customer_id is not null
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
    select l.customer_id,
           l.customer_name,
           round(l.items_total + coalesce(a.adj_total, 0), 2) as total,
           (l.item_lines || coalesce(a.adj_lines, '[]'::jsonb)) as line_items,
           c.email
    from lines l
    left join adj a on a.customer_id = l.customer_id
    left join customers c on c.id = l.customer_id
  loop
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
        'email', r.email,
        'name',  coalesce(r.customer_name, 'there'),
        'amount_ngn', r.total
      );
    end if;
  end loop;

  if v_customers = 0 then
    return jsonb_build_object('error', 'No matching orders found for the priced items in this batch.', 'status', 400);
  end if;

  update china_import_orders
  set status = p_order_status_target, updated_at = now()
  where staged_at = p_batch_key::timestamptz;

  select id into v_batch_id from import_batches where opened_at = p_batch_key::timestamptz;
  if v_batch_id is not null then
    if p_batch_timestamp_column = 'ordered_closed_at' then
      update import_batches set ordered_closed_at = now(), updated_at = now() where id = v_batch_id;
    else
      update import_batches set clearance_closed_at = now(), updated_at = now() where id = v_batch_id;
    end if;
  end if;

  insert into import_batch_bill_status (batch_key, kind, status, sent_at, recipients_count)
  values (p_batch_key, p_kind, 'sent', now(), v_customers)
  on conflict (batch_key, kind) do update
    set status = 'sent', sent_at = now(), recipients_count = excluded.recipients_count;

  return jsonb_build_object(
    'customers_billed', v_customers,
    'expected_total_ngn', v_expected,
    'recipients', v_recipients,
    'skipped', v_skipped
  );
end;
$function$;

revoke execute on function public.close_batch_billing(text, text, text, text) from public, anon, authenticated;
grant  execute on function public.close_batch_billing(text, text, text, text) to service_role;

-- Live ledger for the admin's "who has paid" view.
create or replace function public.get_batch_bill_ledger(p_batch_key text, p_kind text)
returns table (
  customer_id  uuid,
  bill_id      uuid,
  amount_ngn   numeric,
  status       text,
  reminder_count int,
  last_reminder_sent_at timestamptz,
  customer_marked_paid_at timestamptz,
  manual_sender_name text
)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select distinct on (bl.user_id)
    bl.user_id, bl.id, bl.amount_ngn, bl.status,
    coalesce(bl.reminder_count, 0), bl.last_reminder_sent_at,
    bl.customer_marked_paid_at, bl.manual_sender_name
  from china_import_consolidation_bills bl
  where bl.kind = p_kind
    and bl.user_id in (
      select distinct user_id from china_import_orders
      where staged_at = p_batch_key::timestamptz and user_id is not null
    )
  order by bl.user_id, bl.created_at desc;
$function$;

revoke execute on function public.get_batch_bill_ledger(text, text) from public, anon, authenticated;
grant  execute on function public.get_batch_bill_ledger(text, text) to service_role;

-- Reminder template. Daily bill reminders already run via cron job 16
-- ("bill-reminders-daily", 09:00, order-reminders?action=run-bill-reminders),
-- so no second scheduler is added here -- that would mean two reminders a day
-- per customer, which is how a sender earns spam complaints. This template is
-- editable from the admin Messages tab and carries the direct-transfer wording.
insert into import_message_templates (key, label, description, subject, body_html, available_placeholders)
values (
  'bill_payment_reminder',
  'Bill payment reminder',
  'Sent daily to customers with an unpaid bill, until they pay.',
  'Reminder: your QAFRICA bill of ₦{{amount_due}} is still unpaid',
  '<h2 style="color:#111827;margin:0 0 8px;">Your bill is still waiting</h2>' ||
  '<p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">Hi {{customer_name}}, this is a reminder that ' ||
  '<strong>₦{{amount_due}}</strong> is still outstanding on your order. Your goods are held until it clears.</p>' ||
  '<p style="color:#6B7280;margin:0 0 20px;line-height:1.6;">Pay by direct bank transfer to:</p>' ||
  '<div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:20px;">' ||
  '<p style="margin:0;font-size:14px;color:#374151;"><strong>{{bank_name}}</strong><br>{{bank_account_number}}<br>{{bank_account_name}}</p></div>' ||
  '<p style="color:#6B7280;margin:0 0 20px;line-height:1.6;">Once you have sent it, tap ' ||
  '<strong>I have paid</strong> on your dashboard so we can match and confirm it.</p>' ||
  '<a href="{{pay_link}}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;">View my bill →</a>',
  array['customer_name','amount_due','bank_name','bank_account_number','bank_account_name','pay_link']
)
on conflict (key) do nothing;
