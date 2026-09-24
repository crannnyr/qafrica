-- Applied live on 2026-09-24 (names: finalize_checkout_session, orders_allow_nomba_payment_method).
-- Verified (rolled back): 2-store cart 369,500 -> 2 orders, credits+fees = 369,500 exactly, 7% on marketplace
-- items, 10% of dropship markup, stock decremented, repeat call idempotent, underpayment refused.
-- Turn a verified Nomba payment into orders. Called only by edge functions (service role) AFTER
-- they have re-checked the transaction with Nomba. One transaction, row-locked, idempotent.

-- Pay-for-me / Help Pay: the person paying may differ from the person receiving the order
ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS payer_name text,
  ADD COLUMN IF NOT EXISTS payer_email text,
  ADD COLUMN IF NOT EXISTS payer_phone text,
  ADD COLUMN IF NOT EXISTS payer_customer_id uuid,
  ADD COLUMN IF NOT EXISTS shared_cart_id uuid,
  ADD COLUMN IF NOT EXISTS coupons jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.finalize_checkout_session(
  p_reference text, p_paid_amount numeric, p_gateway_fee numeric, p_transaction_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cs checkout_sessions%ROWTYPE;
  st jsonb;
  ln jsonb;
  v_order_id uuid;
  v_ids uuid[] := '{}';
  v_mkt_pct numeric;
  v_drop_pct numeric;
  v_fee_left numeric;
  v_fee numeric;
  v_n int;
  v_i int := 0;
  v_store_total numeric;
BEGIN
  SELECT * INTO cs FROM checkout_sessions WHERE reference = p_reference FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'unknown_reference'); END IF;
  IF cs.status = 'paid' THEN RETURN jsonb_build_object('status', 'paid', 'order_ids', to_jsonb(cs.order_ids), 'already', true); END IF;
  IF cs.status IN ('amount_mismatch', 'fulfilment_error') THEN RETURN jsonb_build_object('status', cs.status); END IF;

  -- Money was taken even if the session had expired: honour it, but never for less than the quote
  IF p_paid_amount IS NULL OR p_paid_amount + 1 < cs.amount THEN
    UPDATE checkout_sessions SET status = 'amount_mismatch', paid_amount = p_paid_amount, gateway_fee = p_gateway_fee,
      nomba_transaction_id = p_transaction_id, error = format('Paid %s, expected %s', p_paid_amount, cs.amount), updated_at = now()
    WHERE id = cs.id;
    INSERT INTO system_failure_logs (failure_type, entity_type, entity_id, error_message, metadata)
    VALUES ('payment_amount_mismatch', 'checkout_session', cs.id::text, format('Paid %s, expected %s', p_paid_amount, cs.amount),
            jsonb_build_object('reference', cs.reference, 'transaction_id', p_transaction_id));
    RETURN jsonb_build_object('status', 'amount_mismatch');
  END IF;

  SELECT COALESCE((value->>'marketplace_pct')::numeric, 7), COALESCE((value->>'dropship_markup_pct')::numeric, 10)
    INTO v_mkt_pct, v_drop_pct FROM platform_settings WHERE key = 'commission_v2';
  v_mkt_pct := COALESCE(v_mkt_pct, 7); v_drop_pct := COALESCE(v_drop_pct, 10);

  v_n := jsonb_array_length(cs.store_orders);
  v_fee_left := COALESCE(p_gateway_fee, 0);

  BEGIN
    FOR st IN SELECT * FROM jsonb_array_elements(cs.store_orders) LOOP
      v_i := v_i + 1;
      v_store_total := (st->>'total')::numeric;
      -- Split Nomba's fee across stores by order value; last store takes the rounding remainder
      v_fee := CASE WHEN v_i = v_n THEN v_fee_left
                    ELSE round(COALESCE(p_gateway_fee, 0) * v_store_total / NULLIF(cs.amount, 0), 2) END;
      v_fee_left := v_fee_left - v_fee;

      INSERT INTO orders (
        order_number, store_id, customer_id, customer_name, customer_email, customer_phone,
        delivery_address, delivery_state, subtotal, delivery_fee, coupon_discount, total, items,
        payment_status, payment_method, payment_provider, payment_reference, paid_at, status,
        checkout_session_id, commission_rate, dropship_commission_rate, gateway_fee, is_cod_order
      ) VALUES (
        'QAF-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
        (st->>'store_id')::uuid, cs.customer_id, cs.customer_name, cs.customer_email, cs.customer_phone,
        cs.delivery, cs.delivery->>'state', (st->>'subtotal')::numeric, COALESCE((st->>'delivery_fee')::numeric, 0),
        COALESCE((st->>'coupon_discount')::numeric, 0), v_store_total, '[]'::jsonb,
        'paid', 'nomba', 'nomba', cs.reference, now(), 'pending',
        cs.id, v_mkt_pct, v_drop_pct, v_fee, false
      ) RETURNING id INTO v_order_id;

      FOR ln IN SELECT * FROM jsonb_array_elements(st->'items') LOOP
        INSERT INTO order_items (
          order_id, product_id, original_product_id, product_name, quantity, price_at_time, unit_price, total_price,
          variant_options, is_imported, original_owner_id, original_store_id, dropship_price, attribution_source
        ) VALUES (
          v_order_id, (ln->>'product_id')::uuid, (ln->>'product_id')::uuid, ln->>'name', (ln->>'quantity')::int,
          (ln->>'unit_price')::numeric, (ln->>'unit_price')::numeric, (ln->>'total_price')::numeric,
          NULLIF(ln->'variant_options', 'null'::jsonb), (ln->>'is_imported')::boolean,
          NULLIF(ln->>'original_owner_id', '')::uuid, NULLIF(ln->>'original_store_id', '')::uuid,
          COALESCE((ln->>'dropship_price')::numeric, 0), COALESCE(ln->>'attribution', 'own')
        );
      END LOOP;

      IF st->>'coupon_code' IS NOT NULL AND COALESCE((st->>'coupon_discount')::numeric, 0) > 0 THEN
        UPDATE coupons SET usage_count = COALESCE(usage_count, 0) + 1, updated_at = now()
        WHERE store_id = (st->>'store_id')::uuid AND upper(code) = upper(st->>'coupon_code');
      END IF;

      PERFORM credit_order_escrow_v2(v_order_id);
      v_ids := v_ids || v_order_id;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    -- Nothing partial is kept (this block rolls back); the payment is recorded for admin follow-up/refund
    UPDATE checkout_sessions SET status = 'fulfilment_error', paid_amount = p_paid_amount, gateway_fee = p_gateway_fee,
      nomba_transaction_id = p_transaction_id, error = SQLERRM, updated_at = now() WHERE id = cs.id;
    INSERT INTO system_failure_logs (failure_type, entity_type, entity_id, error_message, metadata)
    VALUES ('checkout_fulfilment_failed', 'checkout_session', cs.id::text, SQLERRM,
            jsonb_build_object('reference', cs.reference, 'transaction_id', p_transaction_id, 'paid', p_paid_amount));
    RETURN jsonb_build_object('status', 'fulfilment_error', 'error', SQLERRM);
  END;

  UPDATE checkout_sessions SET status = 'paid', paid_amount = p_paid_amount, gateway_fee = p_gateway_fee,
    nomba_transaction_id = p_transaction_id, order_ids = v_ids, paid_at = now(), updated_at = now()
  WHERE id = cs.id;
  RETURN jsonb_build_object('status', 'paid', 'order_ids', to_jsonb(v_ids));
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_checkout_session(text, numeric, numeric, text) FROM public, anon, authenticated;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method = ANY (ARRAY['paystack'::text, 'wallet'::text, 'nomba'::text]));
