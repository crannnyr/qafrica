-- Phase 2: complete the seller-order -> China Import fulfillment bridge.
-- This migration keeps /stores and the existing seller-to-seller dropship path intact.
-- Seller China Import items are represented by order_items.source_type/source_id,
-- never by putting a china_import_products UUID in order_items.product_id.

create or replace function public.credit_order_escrow_v2(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orders%rowtype;
  v_platform uuid;
  v_store_owner uuid;
  v_mkt_sale numeric := 0;
  v_markup numeric := 0;
  v_direct_comm numeric := 0;
  v_drop_comm numeric := 0;
  v_supplier_total numeric := 0;
  v_owner record;
  v_supplier_amt numeric;
  v_supplier_delivery numeric;
  v_store_net numeric;
  v_gateway numeric;
  v_shortfall numeric;
  v_comm numeric;
  v_absorbed numeric;
  v_china_cost numeric;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then
    raise exception 'credit_order_escrow_v2: order % not found', p_order_id;
  end if;

  if o.payment_status <> 'paid' then
    raise exception 'credit_order_escrow_v2: order % is not paid', p_order_id;
  end if;

  if exists (
    select 1 from wallet_transactions
    where (metadata->>'order_id') = p_order_id::text
      and metadata->>'ledger' = 'v2'
  ) then
    return jsonb_build_object('skipped', 'already credited');
  end if;

  select (value->>'user_id')::uuid
  into v_platform
  from platform_settings
  where key = 'platform_wallet_user_id';

  if v_platform is null then
    raise exception 'platform_wallet_user_id setting missing';
  end if;

  select owner_id into v_store_owner from stores where id = o.store_id;
  v_gateway := coalesce(o.gateway_fee, 0);

  select
    coalesce(sum(unit_price * quantity) filter (
      where not coalesce(is_imported, false)
        and attribution_source = 'marketplace'
    ), 0),
    coalesce(sum(greatest(unit_price - coalesce(dropship_price, 0), 0) * quantity) filter (
      where coalesce(is_imported, false)
    ), 0)
  into v_mkt_sale, v_markup
  from order_items
  where order_id = p_order_id;

  v_direct_comm := round(v_mkt_sale * coalesce(o.commission_rate, 0) / 100, 2);
  v_drop_comm := round(v_markup * coalesce(o.dropship_commission_rate, 0) / 100, 2);

  -- Existing seller-to-seller dropship suppliers still receive their
  -- supplier allocation exactly as before.
  for v_owner in
    select original_owner_id, original_store_id,
           sum(dropship_price * quantity) as cost
    from order_items
    where order_id = p_order_id
      and coalesce(is_imported, false)
      and source_type = 'product'
      and original_owner_id is not null
    group by original_owner_id, original_store_id
  loop
    v_supplier_delivery := null;

    select price into v_supplier_delivery
    from delivery_zones
    where store_id = v_owner.original_store_id
      and state = o.delivery_state
      and is_active
    limit 1;

    v_supplier_amt := v_owner.cost + coalesce(v_supplier_delivery, 0);
    v_supplier_total := v_supplier_total + v_supplier_amt;

    if v_supplier_delivery is null then
      insert into system_failure_logs (
        failure_type, entity_type, entity_id, affected_user_id,
        error_message, metadata
      )
      values (
        'missing_delivery_zone', 'order', p_order_id::text, v_owner.original_owner_id,
        'No delivery zone for supplier store/state; supplier credited product amount only',
        jsonb_build_object(
          'store_id', v_owner.original_store_id,
          'state', o.delivery_state
        )
      );
    end if;

    perform credit_wallet_internal(
      v_owner.original_owner_id,
      v_supplier_amt,
      'Dropship supply (escrow)',
      'escrow',
      o.payment_reference,
      p_order_id
    );
  end loop;

  -- China Import is an internal QAFRICA supplier, not another seller.
  -- Its landed cost is held by the platform wallet for procurement instead
  -- of fabricating original_owner_id/original_store_id values.
  select coalesce(sum(coalesce(dropship_price, 0) * quantity), 0)
  into v_china_cost
  from order_items
  where order_id = p_order_id
    and source_type = 'china_import';

  v_supplier_total := v_supplier_total + v_china_cost;

  if v_china_cost > 0 then
    perform credit_wallet_internal(
      v_platform,
      v_china_cost,
      'China Import procurement reserve (escrow)',
      'escrow',
      o.payment_reference,
      p_order_id
    );
  end if;

  v_store_net := o.total - v_supplier_total - v_direct_comm - v_drop_comm - v_gateway;

  if v_store_net < 0 then
    v_shortfall := -v_store_net;
    v_comm := v_direct_comm + v_drop_comm;
    v_absorbed := least(v_comm, v_shortfall);
    v_direct_comm := v_comm - v_absorbed;
    v_drop_comm := 0;

    insert into system_failure_logs (
      failure_type, entity_type, entity_id, affected_user_id,
      error_message, metadata
    )
    values (
      'negative_seller_net', 'order', p_order_id::text, v_store_owner,
      'Seller net below zero after supplier costs, commission and gateway fee; seller credited 0',
      jsonb_build_object(
        'total', o.total,
        'suppliers', v_supplier_total,
        'commission_before', v_comm,
        'absorbed_by_platform', v_absorbed,
        'unresolved_shortfall', v_shortfall - v_absorbed,
        'gateway_fee', v_gateway
      )
    );

    v_store_net := 0;
  end if;

  if v_store_net > 0 then
    perform credit_wallet_internal(
      v_store_owner,
      v_store_net,
      'Sale (escrow)',
      'escrow',
      o.payment_reference,
      p_order_id
    );
  end if;

  if v_direct_comm + v_drop_comm > 0 then
    perform credit_wallet_internal(
      v_platform,
      v_direct_comm + v_drop_comm,
      format(
        'Commission (escrow): %s%% marketplace, %s%% of dropship markup',
        coalesce(o.commission_rate, 0),
        coalesce(o.dropship_commission_rate, 0)
      ),
      'escrow',
      o.payment_reference,
      p_order_id
    );
  end if;

  update wallet_transactions
  set metadata = metadata || '{"ledger":"v2"}'::jsonb
  where (metadata->>'order_id') = p_order_id::text
    and reference = o.payment_reference;

  update orders
  set
    commission_amount = v_direct_comm + v_drop_comm,
    platform_fee = v_direct_comm + v_drop_comm,
    seller_net = v_store_net,
    attribution_source = case
      when exists (
        select 1 from order_items
        where order_id = p_order_id
          and attribution_source = 'marketplace'
      ) then 'marketplace'
      else 'own'
    end,
    dropshipper_profit = case
      when v_markup > 0 then v_store_net
      else dropshipper_profit
    end,
    updated_at = now()
  where id = p_order_id;

  return jsonb_build_object(
    'store_net', v_store_net,
    'suppliers', v_supplier_total,
    'china_import_procurement', v_china_cost,
    'commission', v_direct_comm + v_drop_comm,
    'gateway_fee', v_gateway,
    'check_sum', v_store_net + v_supplier_total + v_direct_comm + v_drop_comm + v_gateway,
    'total', o.total
  );
end;
$$;


create or replace function public.finalize_marketplace_checkout_session(
  p_reference text,
  p_paid_amount numeric,
  p_gateway_fee numeric default 0,
  p_transaction_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cs public.marketplace_checkout_sessions%rowtype;
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
  v_china_order_id uuid;
  v_china_fulfillment_id uuid;
  v_china_bill_id uuid;
  v_china_code text;
  v_china_items jsonb;
  v_item_qty integer;
  v_china_shipping numeric;
  v_china_supplier_cost numeric;
  v_china_total numeric;
  v_platform_user_id uuid;
  v_item_index integer;
  v_catalog_id uuid;
  v_store_owner_id uuid;
  v_source_type text;
  v_source_id uuid;
  v_item_landed_cost numeric;
  v_delivery_address jsonb;
begin
  select * into cs
  from public.marketplace_checkout_sessions
  where reference = p_reference
  for update;

  if not found then
    return jsonb_build_object('status', 'unknown_reference');
  end if;

  -- Idempotency boundary: once the session is paid, no seller order,
  -- China order, fulfillment item, or financial allocation is created again.
  if cs.status = 'paid' then
    return jsonb_build_object(
      'status', 'paid',
      'order_ids', to_jsonb(cs.order_ids),
      'china_import_order_ids', to_jsonb(cs.china_import_order_ids),
      'already', true
    );
  end if;

  if cs.status in ('amount_mismatch', 'fulfilment_error') then
    return jsonb_build_object('status', cs.status);
  end if;

  if p_paid_amount is null or p_paid_amount + 1 < cs.amount then
    update public.marketplace_checkout_sessions
    set
      status = 'amount_mismatch',
      paid_amount = p_paid_amount,
      gateway_fee = p_gateway_fee,
      nomba_transaction_id = p_transaction_id,
      error = format('Paid %s, expected %s', p_paid_amount, cs.amount),
      updated_at = now()
    where id = cs.id;

    return jsonb_build_object('status', 'amount_mismatch');
  end if;

  select
    coalesce((value->>'marketplace_pct')::numeric, 7),
    coalesce((value->>'dropship_markup_pct')::numeric, 10)
  into v_mkt_pct, v_drop_pct
  from public.platform_settings
  where key = 'commission_v2';

  v_mkt_pct := coalesce(v_mkt_pct, 7);
  v_drop_pct := coalesce(v_drop_pct, 10);

  v_n := jsonb_array_length(coalesce(cs.store_orders, '[]'::jsonb));

  begin
    -- 1) Create the customer-facing seller orders.
    for st in select * from jsonb_array_elements(coalesce(cs.store_orders, '[]'::jsonb))
    loop
      v_i := v_i + 1;
      v_store_total := (st->>'total')::numeric;

      v_fee := case
        when v_i = v_n then v_fee_left
        else round(coalesce(p_gateway_fee, 0) * v_store_total / nullif(cs.amount, 0), 2)
      end;
      v_fee_left := v_fee_left - v_fee;

      insert into public.orders (
        order_number, store_id, customer_id, customer_name, customer_email,
        customer_phone, delivery_address, delivery_state, subtotal,
        delivery_fee, coupon_discount, total, items, payment_status,
        payment_method, payment_provider, payment_reference, paid_at, status,
        checkout_session_id, commission_rate, dropship_commission_rate,
        gateway_fee, is_cod_order, attribution_source
      )
      values (
        'QAF-' || to_char(now(), 'YYMMDD') || '-' ||
          upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
        (st->>'store_id')::uuid,
        cs.customer_id,
        cs.customer_name,
        cs.customer_email,
        cs.customer_phone,
        cs.delivery,
        cs.delivery->>'state',
        (st->>'subtotal')::numeric,
        coalesce((st->>'delivery_fee')::numeric, 0),
        coalesce((st->>'coupon_discount')::numeric, 0),
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
        case
          when exists (
            select 1
            from jsonb_array_elements(st->'items') x
            where coalesce(x->>'attribution', 'own') = 'marketplace'
          ) then 'marketplace'
          else 'own'
        end
      )
      returning id into v_order_id;

      v_item_index := 0;

      for ln in select * from jsonb_array_elements(coalesce(st->'items', '[]'::jsonb))
      loop
        v_source_type := case
          when coalesce(ln->>'source_type', 'product') = 'china_import'
            then 'china_import'
          else 'product'
        end;

        v_source_id := nullif(ln->>'source_id', '')::uuid;

        if v_source_type = 'china_import' then
          -- Never write a China product UUID into the legacy product FK.
          v_item_landed_cost := round(
            coalesce((ln->>'supplier_cost_ngn')::numeric, 0)
            + coalesce((ln->>'shipping_cost_ngn')::numeric, 0),
            2
          );

          insert into public.order_items (
            order_id, product_id, original_product_id, product_name, quantity,
            price_at_time, unit_price, total_price, variant_options,
            is_imported, original_owner_id, original_store_id, dropship_price,
            attribution_source, source_type, source_id
          )
          values (
            v_order_id,
            null,
            null,
            ln->>'name',
            greatest(coalesce((ln->>'quantity')::integer, 1), 1),
            (ln->>'unit_price')::numeric,
            (ln->>'unit_price')::numeric,
            (ln->>'total_price')::numeric,
            nullif(ln->'variant_options', 'null'::jsonb),
            true,
            null,
            null,
            v_item_landed_cost,
            coalesce(ln->>'attribution', 'marketplace'),
            'china_import',
            v_source_id
          )
          returning id into v_china_fulfillment_id;

          -- The returned id is the seller order item id for the link below.
          insert into public.china_import_order_links (
            seller_order_id,
            seller_order_item_id,
            china_import_order_id,
            china_import_fulfillment_item_id,
            china_import_dropship_catalog_id
          )
          select
            v_order_id,
            v_china_fulfillment_id,
            null,
            null,
            null
          where false;
        else
          insert into public.order_items (
            order_id, product_id, original_product_id, product_name, quantity,
            price_at_time, unit_price, total_price, variant_options,
            is_imported, original_owner_id, original_store_id, dropship_price,
            attribution_source, source_type, source_id
          )
          values (
            v_order_id,
            v_source_id,
            v_source_id,
            ln->>'name',
            greatest(coalesce((ln->>'quantity')::integer, 1), 1),
            (ln->>'unit_price')::numeric,
            (ln->>'unit_price')::numeric,
            (ln->>'total_price')::numeric,
            nullif(ln->'variant_options', 'null'::jsonb),
            coalesce((ln->>'is_imported')::boolean, false),
            nullif(ln->>'original_owner_id', '')::uuid,
            nullif(ln->>'original_store_id', '')::uuid,
            coalesce((ln->>'dropship_price')::numeric, 0),
            coalesce(ln->>'attribution', 'own'),
            'product',
            v_source_id
          )
          returning id into v_china_fulfillment_id;
        end if;

        -- For China lines the placeholder link above is intentionally not
        -- inserted. The actual China order and fulfillment row are created
        -- below in the same transaction, then linked with both IDs.
        v_item_index := v_item_index + 1;
      end loop;

      if st->>'coupon_code' is not null
        and coalesce((st->>'coupon_discount')::numeric, 0) > 0
      then
        update public.coupons
        set usage_count = coalesce(usage_count, 0) + 1,
            updated_at = now()
        where store_id = (st->>'store_id')::uuid
          and upper(code) = upper(st->>'coupon_code');
      end if;

      perform public.credit_order_escrow_v2(v_order_id);
      v_ids := v_ids || v_order_id;

      -- 2) Hand off every China Import line in this seller order to the
      -- existing China Import fulfillment system.
      for ln in
        select * from jsonb_array_elements(coalesce(st->'items', '[]'::jsonb))
      loop
        if coalesce(ln->>'source_type', 'product') <> 'china_import' then
          continue;
        end if;

        v_item_qty := greatest(coalesce((ln->>'quantity')::integer, 1), 1);
        v_china_supplier_cost := round(
          coalesce((ln->>'supplier_cost_ngn')::numeric, 0) * v_item_qty,
          2
        );
        v_china_shipping := round(
          coalesce((ln->>'shipping_cost_ngn')::numeric, 0) * v_item_qty,
          2
        );
        v_china_total := v_china_supplier_cost + v_china_shipping;

        if v_china_supplier_cost < 0 or v_china_shipping < 0 then
          raise exception 'Invalid China Import landed cost for %', ln->>'source_id';
        end if;

        if v_china_total <= 0 then
          raise exception 'China Import item % has no procurement cost allocation', ln->>'source_id';
        end if;

        select id
        into v_catalog_id
        from public.china_import_dropship_catalog
        where seller_store_id = (st->>'store_id')::uuid
          and china_import_product_id = (ln->>'source_id')::uuid
          and status = 'active'
        limit 1;

        -- Direct QAFRICA China Import checkout has no seller catalog row.
        -- Seller dropship requires the catalog mapping.
        if (st->>'store_id')::uuid <> '00000000-0000-0000-0000-000000000000'::uuid
           and v_catalog_id is null
        then
          raise exception 'China Import dropship catalog entry is missing for seller store % and product %',
            st->>'store_id', ln->>'source_id';
        end if;

        v_china_items := jsonb_build_array(
          jsonb_build_object(
            'id', ln->>'source_id',
            'name', ln->>'name',
            'price_ngn', coalesce((ln->>'supplier_cost_ngn')::numeric, 0),
            'quantity', v_item_qty,
            'image_url', ln->>'image_url',
            'variant_options', coalesce(ln->'variant_options', '{}'::jsonb),
            'shipping_method', 'flight',
            'flight_shipping_cost_ngn', v_china_shipping,
            'seller_order_reference', v_order_id::text
          )
        );

        v_china_code := 'QAF-CI-' ||
          upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

        -- Seller-order China procurement is an internal fulfillment order.
        -- user_id stays NULL so the customer cannot see the supplier-side
        -- China order through the normal China Import customer dashboard.
        insert into public.china_import_orders (
          code, customer_name, customer_whatsapp, items, delivery_type,
          subtotal_ngn, jumia_fee_ngn, shipping_ngn, total_ngn, status,
          user_id, payment_method, payment_status, payment_reference, paid_at,
          shipping_method, delivery_address, delivery_mode, admin_note,
          prepaid_shipping_ngn
        )
        values (
          v_china_code,
          cs.customer_name,
          cs.customer_phone,
          v_china_items,
          'to_me',
          v_china_supplier_cost,
          0,
          v_china_shipping,
          v_china_total,
          'confirmed',
          null,
          'nomba',
          'paid',
          cs.reference,
          now(),
          'flight',
          cs.delivery,
          'home',
          'China Import dropship fulfillment for seller order ' ||
            v_order_id::text ||
            ' (store ' || st->>'store_id' || ')',
          v_china_shipping
        )
        returning id into v_china_order_id;

        v_china_ids := v_china_ids || v_china_order_id;

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
        values (
          v_china_order_id,
          0,
          (ln->>'source_id')::uuid,
          ln->>'name',
          ln->>'image_url',
          case
            when jsonb_typeof(ln->'variant_options') = 'object'
              then ln->'variant_options'
            else '{}'::jsonb
          end,
          jsonb_build_object(
            'source_type', 'china_import',
            'source_id', ln->>'source_id',
            'name', ln->>'name',
            'image_url', ln->>'image_url',
            'variant_options', coalesce(ln->'variant_options', '{}'::jsonb),
            'quantity', v_item_qty,
            'supplier_cost_ngn', coalesce((ln->>'supplier_cost_ngn')::numeric, 0),
            'shipping_cost_ngn', coalesce((ln->>'shipping_cost_ngn')::numeric, 0),
            'seller_order_id', v_order_id::text,
            'seller_store_id', st->>'store_id'
          ),
          v_item_qty,
          'awaiting_arrival'
        )
        returning id into v_china_fulfillment_id;

        -- A paid consolidation bill is required by the existing shipment
        -- RPC. For dropship this is an internal QAFRICA-funded bill, not a
        -- customer-visible bill.
        select (value->>'user_id')::uuid
        into v_platform_user_id
        from public.platform_settings
        where key = 'platform_wallet_user_id';

        if v_platform_user_id is null then
          raise exception 'platform_wallet_user_id setting missing';
        end if;

        insert into public.china_import_consolidation_bills (
          user_id,
          order_id,
          amount_ngn,
          reason,
          status,
          confirmed_paid_at,
          kind,
          line_items,
          admin_note
        )
        values (
          v_platform_user_id,
          v_china_order_id,
          v_china_shipping,
          'China Import dropship — internal prepaid air shipping',
          'paid',
          now(),
          'consolidation_shipping',
          v_china_items,
          'Funded from marketplace escrow for seller order ' ||
            v_order_id::text
        )
        returning id into v_china_bill_id;

        insert into public.china_import_order_links (
          seller_order_id,
          seller_order_item_id,
          china_import_order_id,
          china_import_fulfillment_item_id,
          china_import_dropship_catalog_id
        )
        select
          v_order_id,
          oi.id,
          v_china_order_id,
          v_china_fulfillment_id,
          v_catalog_id
        from public.order_items oi
        where oi.order_id = v_order_id
          and oi.source_type = 'china_import'
          and oi.source_id = (ln->>'source_id')::uuid
          and not exists (
            select 1
            from public.china_import_order_links l
            where l.seller_order_item_id = oi.id
          )
        limit 1;
      end loop;
    end loop;

    -- 3) Direct China Import checkout remains compatible with the existing
    -- QAFRICA-owned path. It creates a customer-visible China order in
    -- addition to the QAFRICA marketplace order, as before.
    for ci in
      select * from jsonb_array_elements(coalesce(cs.items, '[]'::jsonb))
    loop
      if coalesce(ci->>'source_type', 'product') <> 'china_import' then
        continue;
      end if;

      if coalesce(ci->>'store_id', '00000000-0000-0000-0000-000000000000')
         <> '00000000-0000-0000-0000-000000000000'
      then
        continue;
      end if;

      v_item_qty := greatest(coalesce((ci->>'quantity')::integer, 1), 1);
      v_china_shipping := round(
        coalesce((ci->>'flight_shipping_cost_ngn')::numeric, 0) * v_item_qty,
        2
      );

      if v_china_shipping <= 0 then
        raise exception 'China Import item % has no prepaid air shipping allocation', ci->>'source_id';
      end if;

      v_china_items := jsonb_build_array(
        jsonb_build_object(
          'id', ci->>'source_id',
          'name', ci->>'name',
          'price_ngn', (ci->>'unit_price')::numeric,
          'quantity', v_item_qty,
          'image_url', ci->>'image_url',
          'variant_options', coalesce(ci->'variant_options', '{}'::jsonb),
          'shipping_method', 'flight',
          'flight_shipping_cost_ngn', v_china_shipping
        )
      );

      v_china_code := 'QAF-' ||
        upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

      insert into public.china_import_orders (
        code, customer_name, customer_whatsapp, items, delivery_type,
        subtotal_ngn, jumia_fee_ngn, total_ngn, status, user_id,
        payment_method, payment_status, payment_reference, paid_at,
        shipping_method, delivery_address, delivery_mode, prepaid_shipping_ngn
      )
      values (
        v_china_code,
        cs.customer_name,
        cs.customer_phone,
        v_china_items,
        'to_me',
        round((ci->>'unit_price')::numeric * v_item_qty, 2),
        0,
        round((ci->>'unit_price')::numeric * v_item_qty, 2),
        'confirmed',
        cs.customer_id,
        'nomba',
        'paid',
        cs.reference,
        now(),
        'flight',
        cs.delivery,
        'home',
        v_china_shipping
      )
      returning id into v_china_order_id;

      insert into public.china_import_consolidation_bills (
        user_id, order_id, amount_ngn, reason, status, confirmed_paid_at,
        kind, line_items
      )
      select
        cs.customer_id,
        v_china_order_id,
        v_china_shipping,
        'Marketplace landed price — consolidation & air shipping prepaid',
        'paid',
        now(),
        'consolidation_shipping',
        v_china_items;

      v_china_ids := v_china_ids || v_china_order_id;
    end loop;

  exception when others then
    update public.marketplace_checkout_sessions
    set
      status = 'fulfilment_error',
      paid_amount = p_paid_amount,
      gateway_fee = p_gateway_fee,
      nomba_transaction_id = p_transaction_id,
      error = sqlerrm,
      updated_at = now()
    where id = cs.id;

    return jsonb_build_object(
      'status', 'fulfilment_error',
      'error', sqlerrm
    );
  end;

  update public.marketplace_checkout_sessions
  set
    status = 'paid',
    paid_amount = p_paid_amount,
    gateway_fee = p_gateway_fee,
    nomba_transaction_id = p_transaction_id,
    order_ids = v_ids,
    china_import_order_ids = v_china_ids,
    paid_at = now(),
    updated_at = now()
  where id = cs.id;

  return jsonb_build_object(
    'status', 'paid',
    'order_ids', to_jsonb(v_ids),
    'china_import_order_ids', to_jsonb(v_china_ids)
  );
end;
$$;

grant execute on function public.credit_order_escrow_v2(uuid) to service_role;
grant execute on function public.finalize_marketplace_checkout_session(text,numeric,numeric,text) to service_role;
