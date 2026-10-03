-- Unified marketplace checkout is intentionally isolated from the existing checkout_sessions flow.
-- One Nomba payment can fulfil normal store orders and China Import orders together.

create table if not exists public.marketplace_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment','paid','failed','expired','amount_mismatch','fulfilment_error')),
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  delivery jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  store_orders jsonb not null default '[]'::jsonb,
  china_import_order_ids uuid[] not null default '{}',
  order_ids uuid[] not null default '{}',
  amount numeric not null check (amount > 0),
  paid_amount numeric,
  gateway_fee numeric,
  nomba_order_id text,
  nomba_transaction_id text,
  checkout_link text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  expires_at timestamptz not null default (now() + interval '2 hours')
);

create index if not exists idx_marketplace_checkout_sessions_status
  on public.marketplace_checkout_sessions(status);
create index if not exists idx_marketplace_checkout_sessions_customer
  on public.marketplace_checkout_sessions(customer_id);

alter table public.marketplace_checkout_sessions enable row level security;

-- The table is written/read by the marketplace Edge Function with service role.
-- No direct client policy is intentionally granted.

create or replace function public.finalize_marketplace_checkout_session(
  p_reference text,
  p_paid_amount numeric,
  p_gateway_fee numeric,
  p_transaction_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cs marketplace_checkout_sessions%rowtype;
  st jsonb;
  ln jsonb;
  ci jsonb;
  v_order_id uuid;
  v_ids uuid[] := '{}';
  v_china_ids uuid[] := '{}';
  v_mkt_pct numeric;
  v_drop_pct numeric;
  v_fee_left numeric := coalesce(p_gateway_fee, 0);
  v_fee numeric;
  v_n integer := 0;
  v_i integer := 0;
  v_store_total numeric;
  v_customer_id uuid;
  v_china_order_id uuid;
  v_china_bill_id uuid;
  v_china_code text;
  v_china_items jsonb;
  v_china_subtotal numeric;
  v_item_qty integer;
begin
  select * into cs
  from public.marketplace_checkout_sessions
  where reference = p_reference
  for update;

  if not found then
    return jsonb_build_object('status','unknown_reference');
  end if;

  if cs.status = 'paid' then
    return jsonb_build_object(
      'status','paid',
      'order_ids',to_jsonb(cs.order_ids),
      'china_import_order_ids',to_jsonb(cs.china_import_order_ids),
      'already',true
    );
  end if;

  if cs.status in ('amount_mismatch','fulfilment_error') then
    return jsonb_build_object('status',cs.status);
  end if;

  if p_paid_amount is null or p_paid_amount + 1 < cs.amount then
    update public.marketplace_checkout_sessions
      set status='amount_mismatch',
          paid_amount=p_paid_amount,
          gateway_fee=p_gateway_fee,
          nomba_transaction_id=p_transaction_id,
          error=format('Paid %s, expected %s', p_paid_amount, cs.amount),
          updated_at=now()
    where id=cs.id;

    insert into public.system_failure_logs(failure_type, entity_type, entity_id, error_message, metadata)
    values(
      'payment_amount_mismatch',
      'marketplace_checkout_session',
      cs.id::text,
      format('Paid %s, expected %s', p_paid_amount, cs.amount),
      jsonb_build_object('reference',cs.reference,'transaction_id',p_transaction_id)
    );

    return jsonb_build_object('status','amount_mismatch');
  end if;

  select
    coalesce((value->>'marketplace_pct')::numeric, 7),
    coalesce((value->>'dropship_markup_pct')::numeric, 10)
  into v_mkt_pct, v_drop_pct
  from public.platform_settings
  where key='commission_v2';

  v_mkt_pct := coalesce(v_mkt_pct, 7);
  v_drop_pct := coalesce(v_drop_pct, 10);

  v_n := jsonb_array_length(coalesce(cs.store_orders,'[]'::jsonb));

  begin
    -- Normal store orders are created exactly from the server-side checkout quote snapshot.
    for st in select * from jsonb_array_elements(coalesce(cs.store_orders,'[]'::jsonb)) loop
      v_i := v_i + 1;
      v_store_total := (st->>'total')::numeric;
      v_fee := case
        when v_i = v_n then v_fee_left
        else round(coalesce(p_gateway_fee,0) * v_store_total / nullif(cs.amount,0), 2)
      end;
      v_fee_left := v_fee_left - v_fee;

      insert into public.orders(
        order_number, store_id, customer_id, customer_name, customer_email, customer_phone,
        delivery_address, delivery_state, subtotal, delivery_fee, coupon_discount, total, items,
        payment_status, payment_method, payment_provider, payment_reference, paid_at, status,
        checkout_session_id, commission_rate, dropship_commission_rate, gateway_fee, is_cod_order,
        attribution_source
      ) values (
        'QAF-' || to_char(now(),'YYMMDD') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text),1,6)),
        (st->>'store_id')::uuid,
        cs.customer_id,
        cs.customer_name,
        cs.customer_email,
        cs.customer_phone,
        cs.delivery,
        cs.delivery->>'state',
        (st->>'subtotal')::numeric,
        coalesce((st->>'delivery_fee')::numeric,0),
        coalesce((st->>'coupon_discount')::numeric,0),
        v_store_total,
        '[]'::jsonb,
        'paid',
        'nomba',
        'nomba',
        cs.reference,
        now(),
        'pending',
        null,
        v_mkt_pct,
        v_drop_pct,
        v_fee,
        false,
        case when exists (
          select 1 from jsonb_array_elements(st->'items') x where coalesce(x->>'attribution','own')='marketplace'
        ) then 'marketplace' else 'own' end
      ) returning id into v_order_id;

      for ln in select * from jsonb_array_elements(coalesce(st->'items','[]'::jsonb)) loop
        insert into public.order_items(
          order_id, product_id, original_product_id, product_name, quantity, price_at_time,
          unit_price, total_price, variant_options, is_imported, original_owner_id,
          original_store_id, dropship_price, attribution_source
        ) values (
          v_order_id,
          (ln->>'product_id')::uuid,
          (ln->>'product_id')::uuid,
          ln->>'name',
          (ln->>'quantity')::int,
          (ln->>'unit_price')::numeric,
          (ln->>'unit_price')::numeric,
          (ln->>'total_price')::numeric,
          nullif(ln->'variant_options','null'::jsonb),
          coalesce((ln->>'is_imported')::boolean,false),
          nullif(ln->>'original_owner_id','')::uuid,
          nullif(ln->>'original_store_id','')::uuid,
          coalesce((ln->>'dropship_price')::numeric,0),
          coalesce(ln->>'attribution','own')
        );
      end loop;

      if st->>'coupon_code' is not null and coalesce((st->>'coupon_discount')::numeric,0) > 0 then
        update public.coupons
          set usage_count=coalesce(usage_count,0)+1, updated_at=now()
        where store_id=(st->>'store_id')::uuid
          and upper(code)=upper(st->>'coupon_code');
      end if;

      perform public.credit_order_escrow_v2(v_order_id);
      v_ids := v_ids || v_order_id;
    end loop;

    -- China Import marketplace lines are already fully landed for the customer.
    -- Their paid consolidation/shipping bill is created here, so the existing
    -- import fulfilment trigger creates the fulfilment item immediately.
    for ci in select * from jsonb_array_elements(coalesce(cs.items,'[]'::jsonb)) loop
      if coalesce(ci->>'source_type','product') <> 'china_import' then
        continue;
      end if;

      v_item_qty := greatest(coalesce((ci->>'quantity')::integer,1),1);
      v_china_subtotal := round((ci->>'unit_price')::numeric * v_item_qty, 2);
      v_china_items := jsonb_build_array(jsonb_build_object(
        'id', ci->>'source_id',
        'name', ci->>'name',
        'price_ngn', (ci->>'unit_price')::numeric,
        'quantity', v_item_qty,
        'image_url', ci->>'image_url',
        'variant_options', coalesce(ci->'variant_options','{}'::jsonb),
        'shipping_method', 'flight'
      ));

      v_china_code := 'QAF-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

      insert into public.china_import_orders(
        code, customer_name, customer_whatsapp, items, delivery_type,
        subtotal_ngn, jumia_fee_ngn, total_ngn, status, user_id,
        payment_method, payment_status, payment_reference, paid_at,
        shipping_method, delivery_address, delivery_mode
      ) values (
        v_china_code,
        cs.customer_name,
        cs.customer_phone,
        v_china_items,
        'to_me',
        v_china_subtotal,
        0,
        v_china_subtotal,
        'confirmed',
        cs.customer_id,
        'nomba',
        'paid',
        cs.reference,
        now(),
        'flight',
        cs.delivery,
        'home'
      ) returning id into v_china_order_id;

      insert into public.china_import_consolidation_bills(
        user_id, order_id, amount_ngn, reason, status, confirmed_paid_at,
        kind, line_items, paystack_reference
      ) values (
        (select id from auth.users where id=cs.customer_id),
        v_china_order_id,
        greatest(v_china_subtotal,0.01),
        'Marketplace landed price — consolidation & shipping prepaid',
        'paid',
        now(),
        'consolidation_shipping',
        v_china_items,
        null
      ) returning id into v_china_bill_id;

      v_china_ids := v_china_ids || v_china_order_id;
    end loop;

    update public.china_import_orders
      set updated_at=now()
    where id = any(v_china_ids);

  exception when others then
    update public.marketplace_checkout_sessions
      set status='fulfilment_error',
          paid_amount=p_paid_amount,
          gateway_fee=p_gateway_fee,
          nomba_transaction_id=p_transaction_id,
          error=sqlerrm,
          updated_at=now()
    where id=cs.id;

    insert into public.system_failure_logs(failure_type, entity_type, entity_id, error_message, metadata)
    values(
      'checkout_fulfilment_failed',
      'marketplace_checkout_session',
      cs.id::text,
      sqlerrm,
      jsonb_build_object('reference',cs.reference,'transaction_id',p_transaction_id,'paid',p_paid_amount)
    );

    return jsonb_build_object('status','fulfilment_error','error',sqlerrm);
  end;

  update public.marketplace_checkout_sessions
    set status='paid',
        paid_amount=p_paid_amount,
        gateway_fee=p_gateway_fee,
        nomba_transaction_id=p_transaction_id,
        order_ids=v_ids,
        china_import_order_ids=v_china_ids,
        paid_at=now(),
        updated_at=now()
  where id=cs.id;

  return jsonb_build_object(
    'status','paid',
    'order_ids',to_jsonb(v_ids),
    'china_import_order_ids',to_jsonb(v_china_ids)
  );
end;
$$;

revoke all on function public.finalize_marketplace_checkout_session(text,numeric,numeric,text) from public;
grant execute on function public.finalize_marketplace_checkout_session(text,numeric,numeric,text) to service_role;
