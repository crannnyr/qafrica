-- Applied live 2026-09-25 (names: shared_carts_pay_for_me, finalize_checkout_session_v2_shared_carts).
-- Verified: link creation, payer view hides address/phone/email, off-platform notes blocked,
-- undeliverable carts refused, paid links stop working; live checkout-create test ignored a payer's forged address/items.
-- Pay-for-me links: a shopper saves a cart + their delivery details; anyone with the link can pay.
-- The payer only ever sees first name, city/state, items, total and the note.
CREATE TABLE IF NOT EXISTS public.shared_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  items jsonb NOT NULL,                 -- checkout_quote input lines (product, store, qty, options, attribution)
  recipient_name text NOT NULL,
  recipient_email text NOT NULL,
  recipient_phone text NOT NULL,
  delivery jsonb NOT NULL,              -- private: never returned to payers
  note text,
  created_by uuid,                      -- customers.id when signed in
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid', 'cancelled', 'expired')),
  checkout_reference text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days'
);
CREATE INDEX IF NOT EXISTS shared_carts_created_by ON public.shared_carts (created_by, created_at DESC);
ALTER TABLE public.shared_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read shared carts" ON public.shared_carts FOR SELECT TO authenticated USING (public.is_admin());

-- Notes must not move people off-platform (phone numbers, bank/account numbers, links)
CREATE OR REPLACE FUNCTION public.clean_share_note(p_note text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE n text := left(trim(COALESCE(p_note, '')), 280);
BEGIN
  IF n = '' THEN RETURN NULL; END IF;
  IF n ~ '\d[\d\s\-]{8,}\d' THEN RAISE EXCEPTION 'Please remove phone or account numbers from your note' USING ERRCODE = '22023'; END IF;
  IF n ~* '(https?://|www\.|\.com\b|\.ng\b|wa\.me|t\.me|@[a-z0-9_]{3,})' THEN RAISE EXCEPTION 'Please remove links and handles from your note' USING ERRCODE = '22023'; END IF;
  IF n ~* '\m(opay|palmpay|moniepoint|kuda|acct|account number|bank transfer|send (me )?(the )?money)\M' THEN
    RAISE EXCEPTION 'For your safety, payments can only be made through the QAFRICA link' USING ERRCODE = '22023';
  END IF;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.create_shared_cart(p_items jsonb, p_recipient jsonb, p_delivery jsonb, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text := left(trim(COALESCE(p_recipient->>'name', '')), 80);
  v_email text := lower(left(trim(COALESCE(p_recipient->>'email', '')), 120));
  v_phone text := regexp_replace(COALESCE(p_recipient->>'phone', ''), '[^\d+]', '', 'g');
  v_state text := left(trim(COALESCE(p_delivery->>'state', '')), 40);
  v_q jsonb; v_code text; v_note text; v_customer uuid;
BEGIN
  IF length(v_name) < 2 THEN RAISE EXCEPTION 'Enter your full name' USING ERRCODE = '22023'; END IF;
  IF v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN RAISE EXCEPTION 'Enter a valid email address' USING ERRCODE = '22023'; END IF;
  IF v_phone !~ '^\+?\d{10,14}$' THEN RAISE EXCEPTION 'Enter a valid phone number' USING ERRCODE = '22023'; END IF;
  IF length(trim(COALESCE(p_delivery->>'address', ''))) < 5 OR trim(COALESCE(p_delivery->>'city', '')) = '' OR v_state = '' THEN
    RAISE EXCEPTION 'Enter your full delivery address' USING ERRCODE = '22023';
  END IF;
  v_note := clean_share_note(p_note);

  v_q := checkout_quote(p_items, v_state, '{}'::jsonb);
  IF NOT (v_q->>'ok')::boolean THEN
    RAISE EXCEPTION '%', COALESCE(v_q->'errors'->0->>'message', 'Some items can''t be ordered right now') USING ERRCODE = '22023';
  END IF;

  -- Light abuse limit: 20 links per email per day
  IF (SELECT count(*) FROM shared_carts WHERE recipient_email = v_email AND created_at > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'Too many links today. Please try again tomorrow.' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_customer FROM customers WHERE id = auth.uid();
  v_code := upper(substr(translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=0O1Il', ''), 1, 10));
  INSERT INTO shared_carts (code, items, recipient_name, recipient_email, recipient_phone, delivery, note, created_by)
  VALUES (v_code, p_items, v_name, v_email, v_phone,
          jsonb_build_object('address', left(trim(p_delivery->>'address'), 200), 'city', left(trim(p_delivery->>'city'), 60),
                             'state', v_state, 'landmark', left(trim(COALESCE(p_delivery->>'landmark', '')), 120)),
          v_note, v_customer);
  RETURN jsonb_build_object('code', v_code, 'amount', v_q->'amount', 'expires_at', now() + interval '7 days');
END $$;
REVOKE ALL ON FUNCTION public.create_shared_cart(jsonb, jsonb, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_shared_cart(jsonb, jsonb, jsonb, text) TO anon, authenticated;

-- What a payer sees: live prices, first name, city/state, note. Never address, phone or email.
CREATE OR REPLACE FUNCTION public.get_shared_cart(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sc shared_carts%ROWTYPE; v_q jsonb; v_status text;
BEGIN
  SELECT * INTO sc FROM shared_carts WHERE code = upper(trim(p_code));
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_status := CASE WHEN sc.status = 'active' AND sc.expires_at < now() THEN 'expired' ELSE sc.status END;
  IF v_status = 'active' THEN v_q := checkout_quote(sc.items, sc.delivery->>'state', '{}'::jsonb); END IF;
  RETURN jsonb_build_object(
    'code', sc.code, 'status', v_status, 'expires_at', sc.expires_at, 'created_at', sc.created_at,
    'first_name', split_part(sc.recipient_name, ' ', 1),
    'city', sc.delivery->>'city', 'state', sc.delivery->>'state', 'note', sc.note,
    'quote', v_q);
END $$;
REVOKE ALL ON FUNCTION public.get_shared_cart(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_cart(text) TO anon, authenticated;

-- Mark the link paid when its checkout completes (called inside finalize_checkout_session)
CREATE OR REPLACE FUNCTION public.mark_shared_cart_paid(p_shared_cart_id uuid, p_reference text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE shared_carts SET status = 'paid', checkout_reference = p_reference, paid_at = now()
  WHERE id = p_shared_cart_id AND status <> 'paid';
$$;
REVOKE ALL ON FUNCTION public.mark_shared_cart_paid(uuid, text) FROM public, anon, authenticated;

-- finalize_checkout_session v2: also marks a pay-for-me link as paid
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
  IF cs.shared_cart_id IS NOT NULL THEN PERFORM mark_shared_cart_paid(cs.shared_cart_id, cs.reference); END IF;
  RETURN jsonb_build_object('status', 'paid', 'order_ids', to_jsonb(v_ids));
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_checkout_session(text, numeric, numeric, text) FROM public, anon, authenticated;
