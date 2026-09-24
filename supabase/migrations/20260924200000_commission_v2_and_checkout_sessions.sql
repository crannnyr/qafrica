-- Applied live via apply_migration on 2026-09-24 (name: commission_v2_and_checkout_sessions).
-- Verified with rolled-back tests: own 0% (10,000 -> seller 9,850 + fee 150), marketplace 4%
-- (commission 360 on items only), dropship 2.5% (supplier 9,812.50, seller 5,612.50, platform 375),
-- shared payment reference across stores, idempotent repeat, commission earned only on release.
-- Commission model v2 + Nomba checkout foundation.
-- Own-traffic sales 0%, marketplace-referred sales 4%, dropship items 2.5% of sale value
-- (split 50/50 between supplier and reseller). Gateway (Nomba) fee passed through to the seller.
-- Platform commission is credited as ESCROW and only becomes platform revenue when the order's
-- escrow is released (i.e. on delivery), via the existing release_escrow_funds().

INSERT INTO public.platform_settings (key, value)
VALUES
  ('commission_v2', '{"own_traffic_pct": 0, "marketplace_pct": 4, "dropship_pct": 2.5, "dropship_supplier_share_pct": 50}'::jsonb),
  ('platform_wallet_user_id', '{"user_id": "6a32934c-50b1-4e2a-b8c4-715404e5295c"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Order-level snapshot of how money was split (rates frozen at payment time)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS checkout_session_id uuid,
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS attribution_source text NOT NULL DEFAULT 'own',
  ADD COLUMN IF NOT EXISTS commission_rate numeric,
  ADD COLUMN IF NOT EXISTS dropship_commission_rate numeric,
  ADD COLUMN IF NOT EXISTS commission_amount numeric,
  ADD COLUMN IF NOT EXISTS gateway_fee numeric,
  ADD COLUMN IF NOT EXISTS seller_net numeric,
  ADD COLUMN IF NOT EXISTS coupon_discount numeric NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_attribution_source_check CHECK (attribution_source IN ('own', 'marketplace'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One row per Nomba checkout attempt. Prices here are computed server-side, never taken from the browser.
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,              -- our orderReference sent to Nomba
  status text NOT NULL DEFAULT 'awaiting_payment'
    CHECK (status IN ('awaiting_payment', 'paid', 'failed', 'expired', 'amount_mismatch', 'fulfilment_error')),
  customer_id uuid,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  delivery jsonb NOT NULL,
  attribution_source text NOT NULL DEFAULT 'own' CHECK (attribution_source IN ('own', 'marketplace')),
  store_orders jsonb NOT NULL,                 -- server-priced lines per store
  amount numeric NOT NULL CHECK (amount > 0),  -- server-computed total the shopper must pay
  return_slug text,
  nomba_order_id text,
  checkout_link text,
  paid_amount numeric,
  gateway_fee numeric,
  nomba_transaction_id text,
  order_ids uuid[],
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 hours'
);
CREATE INDEX IF NOT EXISTS checkout_sessions_pending ON public.checkout_sessions (created_at) WHERE status = 'awaiting_payment';
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read checkout sessions" ON public.checkout_sessions
  FOR SELECT TO authenticated USING (public.is_admin());

-- What a shopper's browser may learn about its own session (by the unguessable reference)
CREATE OR REPLACE FUNCTION public.checkout_session_status(p_reference text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'status', cs.status,
    'amount', cs.amount,
    'return_slug', cs.return_slug,
    'orders', COALESCE((SELECT jsonb_agg(jsonb_build_object('order_number', o.order_number, 'total', o.total))
                        FROM orders o WHERE o.id = ANY (cs.order_ids)), '[]'::jsonb))
  FROM checkout_sessions cs WHERE cs.reference = p_reference;
$$;
REVOKE ALL ON FUNCTION public.checkout_session_status(text) FROM public;
GRANT EXECUTE ON FUNCTION public.checkout_session_status(text) TO anon, authenticated;

-- Credit escrow for one paid order under commission v2. Idempotent per order.
-- Money conservation: sum of all credits = order.total - order.gateway_fee.
CREATE OR REPLACE FUNCTION public.credit_order_escrow_v2(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  o orders%ROWTYPE;
  v_platform uuid;
  v_store_owner uuid;
  v_supplier_share numeric;
  v_direct numeric := 0;
  v_drop_sale numeric := 0;
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
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'credit_order_escrow_v2: order % not found', p_order_id; END IF;
  IF o.payment_status <> 'paid' THEN RAISE EXCEPTION 'credit_order_escrow_v2: order % is not paid', p_order_id; END IF;

  -- Idempotency: one v2 crediting per order (multi-store carts share a payment reference)
  IF EXISTS (SELECT 1 FROM wallet_transactions WHERE (metadata->>'order_id') = p_order_id::text AND metadata->>'ledger' = 'v2') THEN
    RETURN jsonb_build_object('skipped', 'already credited');
  END IF;

  SELECT (value->>'user_id')::uuid INTO v_platform FROM platform_settings WHERE key = 'platform_wallet_user_id';
  IF v_platform IS NULL THEN RAISE EXCEPTION 'platform_wallet_user_id setting missing'; END IF;
  SELECT COALESCE((value->>'dropship_supplier_share_pct')::numeric, 50) INTO v_supplier_share FROM platform_settings WHERE key = 'commission_v2';
  SELECT owner_id INTO v_store_owner FROM stores WHERE id = o.store_id;
  v_gateway := COALESCE(o.gateway_fee, 0);

  SELECT COALESCE(SUM(unit_price * quantity) FILTER (WHERE NOT COALESCE(is_imported, false)), 0),
         COALESCE(SUM(unit_price * quantity) FILTER (WHERE COALESCE(is_imported, false)), 0)
    INTO v_direct, v_drop_sale
  FROM order_items WHERE order_id = p_order_id;

  v_direct_comm := round(v_direct * COALESCE(o.commission_rate, 0) / 100, 2);
  v_drop_comm   := round(v_drop_sale * COALESCE(o.dropship_commission_rate, 0) / 100, 2);

  -- Suppliers of dropshipped items: their price x qty, minus their share of the dropship commission,
  -- plus their own delivery rate for the customer's state (as before)
  FOR v_owner IN
    SELECT original_owner_id, original_store_id,
           SUM(dropship_price * quantity) AS cost, SUM(unit_price * quantity) AS sale
    FROM order_items
    WHERE order_id = p_order_id AND COALESCE(is_imported, false) AND original_owner_id IS NOT NULL
    GROUP BY original_owner_id, original_store_id
  LOOP
    v_supplier_amt := v_owner.cost - round(v_owner.sale * COALESCE(o.dropship_commission_rate, 0) / 100 * v_supplier_share / 100, 2);
    v_supplier_delivery := NULL;
    SELECT price INTO v_supplier_delivery FROM delivery_zones
      WHERE store_id = v_owner.original_store_id AND state = o.delivery_state AND is_active LIMIT 1;
    v_supplier_amt := v_supplier_amt + COALESCE(v_supplier_delivery, 0);
    IF v_supplier_delivery IS NULL THEN
      INSERT INTO system_failure_logs (failure_type, entity_type, entity_id, affected_user_id, error_message, metadata)
      VALUES ('missing_delivery_zone', 'order', p_order_id::text, v_owner.original_owner_id,
              'No delivery zone for supplier store/state; supplier credited product amount only',
              jsonb_build_object('store_id', v_owner.original_store_id, 'state', o.delivery_state));
    END IF;
    v_supplier_total := v_supplier_total + v_supplier_amt;
    PERFORM credit_wallet_internal(v_owner.original_owner_id, v_supplier_amt, 'Dropship supply (escrow)', 'escrow', o.payment_reference, p_order_id);
  END LOOP;

  -- Store owner gets everything that's left: total - suppliers - platform commission - gateway fee
  v_store_net := o.total - v_supplier_total - v_direct_comm - v_drop_comm - v_gateway;
  IF v_store_net < 0 THEN
    -- Can happen when a reseller prices below cost. Platform commission absorbs the gap first;
    -- anything left over is logged for admin review (seller is credited 0, never negative).
    v_shortfall := -v_store_net;
    v_comm := v_direct_comm + v_drop_comm;
    v_absorbed := LEAST(v_comm, v_shortfall);
    v_direct_comm := v_comm - v_absorbed;
    v_drop_comm := 0;
    INSERT INTO system_failure_logs (failure_type, entity_type, entity_id, affected_user_id, error_message, metadata)
    VALUES ('negative_seller_net', 'order', p_order_id::text, v_store_owner,
            'Seller net below zero after supplier costs, commission and gateway fee; seller credited 0',
            jsonb_build_object('total', o.total, 'suppliers', v_supplier_total, 'commission_before', v_comm,
                               'absorbed_by_platform', v_absorbed, 'unresolved_shortfall', v_shortfall - v_absorbed,
                               'gateway_fee', v_gateway));
    v_store_net := 0;
  END IF;
  IF v_store_net > 0 THEN
    PERFORM credit_wallet_internal(v_store_owner, v_store_net, 'Sale (escrow)', 'escrow', o.payment_reference, p_order_id);
  END IF;

  -- Platform commission is held in escrow too: earned only when the order is released (delivered)
  IF v_direct_comm + v_drop_comm > 0 THEN
    PERFORM credit_wallet_internal(v_platform, v_direct_comm + v_drop_comm,
      format('Commission (escrow): %s%% direct, %s%% dropship', COALESCE(o.commission_rate, 0), COALESCE(o.dropship_commission_rate, 0)),
      'escrow', o.payment_reference, p_order_id);
  END IF;

  -- Tag this order's rows as v2 (credit_wallet_internal writes metadata.order_id)
  UPDATE wallet_transactions SET metadata = metadata || '{"ledger": "v2"}'::jsonb
  WHERE (metadata->>'order_id') = p_order_id::text AND reference = o.payment_reference;

  UPDATE orders SET
    commission_amount = v_direct_comm + v_drop_comm,
    platform_fee = v_direct_comm + v_drop_comm,
    seller_net = v_store_net,
    dropshipper_profit = CASE WHEN v_drop_sale > 0 THEN v_store_net ELSE dropshipper_profit END,
    updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('store_net', v_store_net, 'suppliers', v_supplier_total,
                            'commission', v_direct_comm + v_drop_comm, 'gateway_fee', v_gateway,
                            'check_sum', v_store_net + v_supplier_total + v_direct_comm + v_drop_comm + v_gateway, 'total', o.total);
END;
$$;
REVOKE ALL ON FUNCTION public.credit_order_escrow_v2(uuid) FROM public, anon, authenticated;
