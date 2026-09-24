-- Applied live via apply_migration on 2026-09-24 (name: commission_v3_marketplace7_dropship_markup10).
-- Verified (rolled back): own 0%, marketplace 7% (630 on 9,000), mixed cart 350, dropship 10% of 5,000 markup = 500, supplier paid in full.
-- Commission v3: marketplace items 7%, dropship = 10% of the reseller's markup, own traffic 0%.
-- Attribution is per order item (one cart can mix marketplace and own-traffic items).
-- Suppliers now receive their full price; the dropship commission comes out of the markup only.

UPDATE public.platform_settings
SET value = '{"own_traffic_pct": 0, "marketplace_pct": 7, "dropship_markup_pct": 10}'::jsonb,
    updated_at = now()
WHERE key = 'commission_v2';

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS attribution_source text NOT NULL DEFAULT 'own';
DO $$ BEGIN
  ALTER TABLE public.order_items ADD CONSTRAINT order_items_attribution_source_check
    CHECK (attribution_source IN ('own', 'marketplace'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.orders.commission_rate IS 'Marketplace commission % applied to marketplace-attributed items (snapshot at payment).';
COMMENT ON COLUMN public.orders.dropship_commission_rate IS 'Commission % of the reseller markup on dropshipped items (snapshot at payment).';

CREATE OR REPLACE FUNCTION public.credit_order_escrow_v2(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  o orders%ROWTYPE;
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
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'credit_order_escrow_v2: order % not found', p_order_id; END IF;
  IF o.payment_status <> 'paid' THEN RAISE EXCEPTION 'credit_order_escrow_v2: order % is not paid', p_order_id; END IF;
  IF EXISTS (SELECT 1 FROM wallet_transactions WHERE (metadata->>'order_id') = p_order_id::text AND metadata->>'ledger' = 'v2') THEN
    RETURN jsonb_build_object('skipped', 'already credited');
  END IF;

  SELECT (value->>'user_id')::uuid INTO v_platform FROM platform_settings WHERE key = 'platform_wallet_user_id';
  IF v_platform IS NULL THEN RAISE EXCEPTION 'platform_wallet_user_id setting missing'; END IF;
  SELECT owner_id INTO v_store_owner FROM stores WHERE id = o.store_id;
  v_gateway := COALESCE(o.gateway_fee, 0);

  -- Marketplace commission: own-stock items that came from the marketplace
  SELECT COALESCE(SUM(unit_price * quantity) FILTER (WHERE NOT COALESCE(is_imported, false) AND attribution_source = 'marketplace'), 0),
         COALESCE(SUM(GREATEST(unit_price - COALESCE(dropship_price, 0), 0) * quantity) FILTER (WHERE COALESCE(is_imported, false)), 0)
    INTO v_mkt_sale, v_markup
  FROM order_items WHERE order_id = p_order_id;

  v_direct_comm := round(v_mkt_sale * COALESCE(o.commission_rate, 0) / 100, 2);
  v_drop_comm   := round(v_markup * COALESCE(o.dropship_commission_rate, 0) / 100, 2);

  -- Suppliers: full price x qty + their own delivery rate for the customer's state
  FOR v_owner IN
    SELECT original_owner_id, original_store_id, SUM(dropship_price * quantity) AS cost
    FROM order_items
    WHERE order_id = p_order_id AND COALESCE(is_imported, false) AND original_owner_id IS NOT NULL
    GROUP BY original_owner_id, original_store_id
  LOOP
    v_supplier_delivery := NULL;
    SELECT price INTO v_supplier_delivery FROM delivery_zones
      WHERE store_id = v_owner.original_store_id AND state = o.delivery_state AND is_active LIMIT 1;
    v_supplier_amt := v_owner.cost + COALESCE(v_supplier_delivery, 0);
    IF v_supplier_delivery IS NULL THEN
      INSERT INTO system_failure_logs (failure_type, entity_type, entity_id, affected_user_id, error_message, metadata)
      VALUES ('missing_delivery_zone', 'order', p_order_id::text, v_owner.original_owner_id,
              'No delivery zone for supplier store/state; supplier credited product amount only',
              jsonb_build_object('store_id', v_owner.original_store_id, 'state', o.delivery_state));
    END IF;
    v_supplier_total := v_supplier_total + v_supplier_amt;
    PERFORM credit_wallet_internal(v_owner.original_owner_id, v_supplier_amt, 'Dropship supply (escrow)', 'escrow', o.payment_reference, p_order_id);
  END LOOP;

  v_store_net := o.total - v_supplier_total - v_direct_comm - v_drop_comm - v_gateway;
  IF v_store_net < 0 THEN
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

  IF v_direct_comm + v_drop_comm > 0 THEN
    PERFORM credit_wallet_internal(v_platform, v_direct_comm + v_drop_comm,
      format('Commission (escrow): %s%% marketplace, %s%% of dropship markup', COALESCE(o.commission_rate, 0), COALESCE(o.dropship_commission_rate, 0)),
      'escrow', o.payment_reference, p_order_id);
  END IF;

  UPDATE wallet_transactions SET metadata = metadata || '{"ledger": "v2"}'::jsonb
  WHERE (metadata->>'order_id') = p_order_id::text AND reference = o.payment_reference;

  UPDATE orders SET
    commission_amount = v_direct_comm + v_drop_comm,
    platform_fee = v_direct_comm + v_drop_comm,
    seller_net = v_store_net,
    attribution_source = CASE WHEN EXISTS (SELECT 1 FROM order_items WHERE order_id = p_order_id AND attribution_source = 'marketplace') THEN 'marketplace' ELSE 'own' END,
    dropshipper_profit = CASE WHEN v_markup > 0 THEN v_store_net ELSE dropshipper_profit END,
    updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('store_net', v_store_net, 'suppliers', v_supplier_total,
                            'commission', v_direct_comm + v_drop_comm, 'gateway_fee', v_gateway,
                            'check_sum', v_store_net + v_supplier_total + v_direct_comm + v_drop_comm + v_gateway, 'total', o.total);
END;
$$;
REVOKE ALL ON FUNCTION public.credit_order_escrow_v2(uuid) FROM public, anon, authenticated;
