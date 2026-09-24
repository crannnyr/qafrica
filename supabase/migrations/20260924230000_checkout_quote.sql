-- Applied live via apply_migration on 2026-09-24 (name: checkout_quote).
-- Verified as anon (rolled back): server pricing, delivery zones, reseller prices, forged attribution
-- ignored, quantity capped at 99, fake product rejected, invalid coupon gives no discount.
-- Server-side cart pricing. The browser sends only WHAT it wants (product, store sold from, qty,
-- options, attribution hint); every price, delivery fee and discount is looked up here.
-- Used for display (checkout page) and as the authority when creating a Nomba payment.
CREATE OR REPLACE FUNCTION public.checkout_quote(p_items jsonb, p_state text DEFAULT NULL, p_coupons jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  it jsonb;
  v_prod products%ROWTYPE;
  v_store stores%ROWTYPE;
  v_ic import_catalog%ROWTYPE;
  v_qty int;
  v_price numeric;
  v_imported boolean;
  v_attr text;
  v_errors jsonb := '[]'::jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_stores jsonb := '[]'::jsonb;
  v_sid uuid;
  v_store_lines jsonb;
  v_subtotal numeric;
  v_fulfil uuid;
  v_zone numeric;
  v_code text;
  v_coupon coupons%ROWTYPE;
  v_discount numeric;
  v_coupon_msg text;
  v_amount numeric := 0;
  v_mkt_ids uuid[];
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'errors', jsonb_build_array(jsonb_build_object('code', 'empty_cart', 'message', 'Your cart is empty')));
  END IF;
  IF jsonb_array_length(p_items) > 60 THEN
    RETURN jsonb_build_object('ok', false, 'errors', jsonb_build_array(jsonb_build_object('code', 'too_many_items', 'message', 'Too many items in one checkout')));
  END IF;
  SELECT array_agg(x) INTO v_mkt_ids FROM marketplace_store_ids() x;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := LEAST(GREATEST(COALESCE((it->>'quantity')::int, 1), 1), 99);

    SELECT * INTO v_store FROM stores WHERE id = (it->>'store_id')::uuid;
    IF NOT FOUND OR NOT v_store.is_active OR COALESCE(v_store.is_blocked, false) THEN
      v_errors := v_errors || jsonb_build_object('code', 'store_unavailable', 'product_id', it->>'product_id', 'store_id', it->>'store_id', 'message', 'This store is not taking orders right now');
      CONTINUE;
    END IF;

    SELECT * INTO v_prod FROM products WHERE id = (it->>'product_id')::uuid;
    IF NOT FOUND OR NOT v_prod.is_active THEN
      v_errors := v_errors || jsonb_build_object('code', 'product_unavailable', 'product_id', it->>'product_id', 'store_id', v_store.id, 'message', 'This item is no longer available');
      CONTINUE;
    END IF;

    IF v_prod.store_id = v_store.id THEN
      v_imported := false;
      v_price := v_prod.selling_price;
    ELSE
      SELECT * INTO v_ic FROM import_catalog
      WHERE importer_store_id = v_store.id AND original_product_id = v_prod.id AND is_active LIMIT 1;
      IF NOT FOUND THEN
        v_errors := v_errors || jsonb_build_object('code', 'product_unavailable', 'product_id', v_prod.id, 'store_id', v_store.id, 'message', 'This item is no longer sold by this store');
        CONTINUE;
      END IF;
      v_imported := true;
      v_price := COALESCE(NULLIF(v_ic.custom_selling_price, 0), NULLIF(v_ic.selling_price, 0), v_prod.selling_price);
    END IF;

    IF v_price IS NULL OR v_price <= 0 THEN
      v_errors := v_errors || jsonb_build_object('code', 'product_unavailable', 'product_id', v_prod.id, 'store_id', v_store.id, 'message', 'This item has no price');
      CONTINUE;
    END IF;

    IF COALESCE(v_prod.is_out_of_stock, false)
       OR (NOT COALESCE(v_prod.has_variants, false) AND COALESCE(v_prod.stock_quantity, 0) < v_qty) THEN
      v_errors := v_errors || jsonb_build_object('code', 'insufficient_stock', 'product_id', v_prod.id, 'store_id', v_store.id,
        'available', GREATEST(COALESCE(v_prod.stock_quantity, 0), 0),
        'message', format('Only %s left of "%s"', GREATEST(COALESCE(v_prod.stock_quantity, 0), 0), v_prod.name));
      CONTINUE;
    END IF;

    -- Marketplace commission only applies to a store's own products in marketplace-listed stores
    v_attr := CASE WHEN it->>'attribution' = 'marketplace' AND NOT v_imported AND v_store.id = ANY (COALESCE(v_mkt_ids, '{}'))
                   THEN 'marketplace' ELSE 'own' END;

    v_lines := v_lines || jsonb_build_object(
      'product_id', v_prod.id, 'store_id', v_store.id, 'name', v_prod.name, 'image', v_prod.images[1],
      'quantity', v_qty, 'unit_price', v_price, 'total_price', v_price * v_qty,
      'variant_options', COALESCE(it->'variant_options', 'null'::jsonb),
      'is_imported', v_imported,
      'original_owner_id', CASE WHEN v_imported THEN v_prod.owner_id END,
      'original_store_id', CASE WHEN v_imported THEN v_prod.store_id END,
      'dropship_price', CASE WHEN v_imported THEN COALESCE(v_ic.dropship_price, v_prod.dropship_price, 0) ELSE 0 END,
      'attribution', v_attr);
  END LOOP;

  -- Per store: subtotal, delivery (seller's own zone; supplier's zone for a single-supplier dropship cart), coupon
  FOR v_sid IN SELECT DISTINCT (l->>'store_id')::uuid FROM jsonb_array_elements(v_lines) l LOOP
    SELECT * INTO v_store FROM stores WHERE id = v_sid;
    SELECT jsonb_agg(l) INTO v_store_lines FROM jsonb_array_elements(v_lines) l WHERE (l->>'store_id')::uuid = v_sid;
    SELECT SUM((l->>'total_price')::numeric) INTO v_subtotal FROM jsonb_array_elements(v_store_lines) l;

    v_zone := NULL;
    IF p_state IS NOT NULL AND trim(p_state) <> '' THEN
      SELECT CASE WHEN bool_and((l->>'is_imported')::boolean) AND count(DISTINCT l->>'original_store_id') = 1
                  THEN (min(l->>'original_store_id'))::uuid ELSE v_sid END
        INTO v_fulfil FROM jsonb_array_elements(v_store_lines) l;
      SELECT price INTO v_zone FROM delivery_zones
        WHERE store_id = v_fulfil AND lower(trim(state)) = lower(trim(p_state)) AND is_active LIMIT 1;
      IF v_zone IS NULL THEN
        v_errors := v_errors || jsonb_build_object('code', 'no_delivery', 'store_id', v_sid,
          'message', format('%s doesn''t deliver to %s yet', v_store.name, p_state));
      END IF;
    END IF;

    v_discount := 0; v_coupon_msg := NULL;
    v_code := upper(trim(COALESCE(p_coupons->>(v_sid::text), '')));
    IF v_code <> '' THEN
      SELECT * INTO v_coupon FROM coupons WHERE store_id = v_sid AND upper(code) = v_code LIMIT 1;
      IF NOT FOUND OR NOT v_coupon.is_active THEN v_coupon_msg := 'This code isn''t valid';
      ELSIF v_coupon.start_date IS NOT NULL AND v_coupon.start_date > now() THEN v_coupon_msg := 'This code isn''t active yet';
      ELSIF v_coupon.end_date IS NOT NULL AND v_coupon.end_date < now() THEN v_coupon_msg := 'This code has expired';
      ELSIF v_coupon.usage_limit IS NOT NULL AND COALESCE(v_coupon.usage_count, 0) >= v_coupon.usage_limit THEN v_coupon_msg := 'This code has been used up';
      ELSIF COALESCE(v_coupon.min_order_amount, 0) > v_subtotal THEN v_coupon_msg := format('Spend ₦%s or more to use this code', to_char(v_coupon.min_order_amount, 'FM999,999,999'));
      ELSE
        v_discount := CASE WHEN v_coupon.discount_type = 'percentage' THEN round(v_subtotal * v_coupon.discount_value / 100, 2)
                           ELSE v_coupon.discount_value END;
        IF v_coupon.max_discount_amount IS NOT NULL AND v_coupon.max_discount_amount > 0 THEN
          v_discount := LEAST(v_discount, v_coupon.max_discount_amount);
        END IF;
        v_discount := LEAST(GREATEST(v_discount, 0), v_subtotal);
      END IF;
    END IF;

    v_stores := v_stores || jsonb_build_object(
      'store_id', v_sid, 'store_name', v_store.name, 'store_slug', v_store.slug, 'logo_url', v_store.logo_url,
      'items', v_store_lines, 'subtotal', v_subtotal, 'delivery_fee', v_zone,
      'coupon_code', NULLIF(v_code, ''), 'coupon_discount', v_discount, 'coupon_message', v_coupon_msg,
      'total', GREATEST(v_subtotal + COALESCE(v_zone, 0) - v_discount, 0));
    v_amount := v_amount + GREATEST(v_subtotal + COALESCE(v_zone, 0) - v_discount, 0);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', jsonb_array_length(v_errors) = 0 AND jsonb_array_length(v_stores) > 0 AND p_state IS NOT NULL AND trim(p_state) <> '',
    'state', p_state, 'stores', v_stores, 'amount', v_amount, 'errors', v_errors);
END;
$$;
REVOKE ALL ON FUNCTION public.checkout_quote(jsonb, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.checkout_quote(jsonb, text, jsonb) TO anon, authenticated;
