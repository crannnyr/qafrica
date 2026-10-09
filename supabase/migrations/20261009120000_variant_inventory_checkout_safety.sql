CREATE OR REPLACE FUNCTION public.checkout_quote(
  p_items jsonb,
  p_state text DEFAULT NULL::text,
  p_coupons jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_variant jsonb;
  v_variant_stock int;
  v_variant_found boolean;
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
      WHERE importer_store_id = v_store.id AND original_product_id = v_prod.id AND is_active
      LIMIT 1;
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

    IF COALESCE(v_prod.is_out_of_stock, false) THEN
      v_errors := v_errors || jsonb_build_object('code', 'insufficient_stock', 'product_id', v_prod.id, 'store_id', v_store.id, 'available', GREATEST(COALESCE(v_prod.stock_quantity, 0), 0), 'message', format('Only %s left of "%s"', GREATEST(COALESCE(v_prod.stock_quantity, 0), 0), v_prod.name));
      CONTINUE;
    END IF;

    IF COALESCE(v_prod.has_variants, false) THEN
      v_variant_found := false;
      v_variant_stock := 0;
      IF jsonb_typeof(it->'variant_options') = 'object' AND jsonb_typeof(v_prod.variants) = 'array' THEN
        FOR v_variant IN SELECT value FROM jsonb_array_elements(v_prod.variants) LOOP
          IF v_variant->'options' = it->'variant_options' THEN
            v_variant_found := true;
            v_variant_stock := GREATEST(COALESCE(NULLIF(v_variant->>'stock', '')::int, 0), 0);
            EXIT;
          END IF;
        END LOOP;
      END IF;
      IF NOT v_variant_found THEN
        v_errors := v_errors || jsonb_build_object('code', 'invalid_variant', 'product_id', v_prod.id, 'store_id', v_store.id, 'message', format('Please select a valid option for "%s"', v_prod.name));
        CONTINUE;
      END IF;
      IF v_variant_stock < v_qty THEN
        v_errors := v_errors || jsonb_build_object('code', 'insufficient_stock', 'product_id', v_prod.id, 'store_id', v_store.id, 'available', v_variant_stock, 'message', format('Only %s left for the selected option of "%s"', v_variant_stock, v_prod.name));
        CONTINUE;
      END IF;
    ELSIF COALESCE(v_prod.stock_quantity, 0) < v_qty THEN
      v_errors := v_errors || jsonb_build_object('code', 'insufficient_stock', 'product_id', v_prod.id, 'store_id', v_store.id, 'available', GREATEST(COALESCE(v_prod.stock_quantity, 0), 0), 'message', format('Only %s left of "%s"', GREATEST(COALESCE(v_prod.stock_quantity, 0), 0), v_prod.name));
      CONTINUE;
    END IF;

    v_attr := CASE WHEN it->>'attribution' = 'marketplace' AND NOT v_imported AND v_store.id = ANY (COALESCE(v_mkt_ids, '{}')) THEN 'marketplace' ELSE 'own' END;
    v_lines := v_lines || jsonb_build_object(
      'product_id', v_prod.id, 'store_id', v_store.id, 'name', v_prod.name, 'image', v_prod.images[1],
      'quantity', v_qty, 'unit_price', v_price, 'total_price', v_price * v_qty,
      'variant_options', COALESCE(it->'variant_options', 'null'::jsonb),
      'is_imported', v_imported, 'original_owner_id', CASE WHEN v_imported THEN v_prod.owner_id END,
      'original_store_id', CASE WHEN v_imported THEN v_prod.store_id END,
      'dropship_price', CASE WHEN v_imported THEN COALESCE(v_ic.dropship_price, v_prod.dropship_price, 0) ELSE 0 END,
      'attribution', v_attr
    );
  END LOOP;

  FOR v_sid IN SELECT DISTINCT (l->>'store_id')::uuid FROM jsonb_array_elements(v_lines) l LOOP
    SELECT * INTO v_store FROM stores WHERE id = v_sid;
    SELECT jsonb_agg(l) INTO v_store_lines FROM jsonb_array_elements(v_lines) l WHERE (l->>'store_id')::uuid = v_sid;
    SELECT SUM((l->>'total_price')::numeric) INTO v_subtotal FROM jsonb_array_elements(v_store_lines) l;
    v_zone := NULL;
    IF p_state IS NOT NULL AND trim(p_state) <> '' THEN
      SELECT CASE WHEN bool_and((l->>'is_imported')::boolean) AND count(DISTINCT l->>'original_store_id') = 1 THEN (min(l->>'original_store_id'))::uuid ELSE v_sid END INTO v_fulfil FROM jsonb_array_elements(v_store_lines) l;
      SELECT price INTO v_zone FROM delivery_zones WHERE store_id = v_fulfil AND lower(trim(state)) = lower(trim(p_state)) AND is_active LIMIT 1;
      IF v_zone IS NULL THEN
        v_errors := v_errors || jsonb_build_object('code', 'no_delivery', 'store_id', v_sid, 'message', format('%s doesn''t deliver to %s yet', v_store.name, p_state));
      END IF;
    END IF;
    v_discount := 0;
    v_coupon_msg := NULL;
    v_code := upper(trim(COALESCE(p_coupons->>(v_sid::text), '')));
    IF v_code <> '' THEN
      SELECT * INTO v_coupon FROM coupons WHERE store_id = v_sid AND upper(code) = v_code LIMIT 1;
      IF NOT FOUND OR NOT v_coupon.is_active THEN v_coupon_msg := 'This code isn''t valid';
      ELSIF v_coupon.start_date IS NOT NULL AND v_coupon.start_date > now() THEN v_coupon_msg := 'This code isn''t active yet';
      ELSIF v_coupon.end_date IS NOT NULL AND v_coupon.end_date < now() THEN v_coupon_msg := 'This code has expired';
      ELSIF v_coupon.usage_limit IS NOT NULL AND COALESCE(v_coupon.usage_count, 0) >= v_coupon.usage_limit THEN v_coupon_msg := 'This code has been used up';
      ELSIF COALESCE(v_coupon.min_order_amount, 0) > v_subtotal THEN v_coupon_msg := format('Spend ₦%s or more to use this code', to_char(v_coupon.min_order_amount, 'FM999,999,999'));
      ELSE
        v_discount := CASE WHEN v_coupon.discount_type = 'percentage' THEN round(v_subtotal * v_coupon.discount_value / 100, 2) ELSE v_coupon.discount_value END;
        IF v_coupon.max_discount_amount IS NOT NULL AND v_coupon.max_discount_amount > 0 THEN v_discount := LEAST(v_discount, v_coupon.max_discount_amount); END IF;
        v_discount := LEAST(GREATEST(v_discount, 0), v_subtotal);
      END IF;
    END IF;
    v_stores := v_stores || jsonb_build_object(
      'store_id', v_sid, 'store_name', v_store.name, 'store_slug', v_store.slug, 'logo_url', v_store.logo_url,
      'items', v_store_lines, 'subtotal', v_subtotal, 'delivery_fee', v_zone, 'coupon_code', NULLIF(v_code, ''),
      'coupon_discount', v_discount, 'coupon_message', v_coupon_msg,
      'total', GREATEST(v_subtotal + COALESCE(v_zone, 0) - v_discount, 0)
    );
    v_amount := v_amount + GREATEST(v_subtotal + COALESCE(v_zone, 0) - v_discount, 0);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', jsonb_array_length(v_errors) = 0 AND jsonb_array_length(v_stores) > 0 AND p_state IS NOT NULL AND trim(p_state) <> '',
    'state', p_state, 'stores', v_stores, 'amount', v_amount, 'errors', v_errors
  );
END;
$function$;

-- China Import marketplace items are stored in china_import_products and have
-- no normal products.stock_quantity inventory record. The stock trigger must
-- leave those fulfillment/order items untouched.
CREATE OR REPLACE FUNCTION public.decrement_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_product_id uuid;
  v_variant jsonb;
  v_variant_found boolean := false;
  v_new_variants jsonb;
  v_variant_stock integer;
  v_stock_total integer;
BEGIN
  -- Dedicated China Import fulfillment items have no products inventory row.
  IF NEW.product_id IS NULL AND NEW.original_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.is_imported = true AND NEW.original_product_id IS NOT NULL THEN
    v_product_id := NEW.original_product_id;
  ELSE
    v_product_id := NEW.product_id;
  END IF;

  IF v_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Variant inventory is stored on the source product's variants JSONB array.
  IF NEW.variant_options IS NOT NULL AND jsonb_typeof(NEW.variant_options) = 'object' THEN
    SELECT EXISTS (
      SELECT 1
      FROM products p, jsonb_array_elements(COALESCE(p.variants, '[]'::jsonb)) v
      WHERE p.id = v_product_id
        AND v->'options' = NEW.variant_options
    ) INTO v_variant_found;

    IF v_variant_found THEN
      UPDATE products p
      SET variants = (
            SELECT jsonb_agg(
              CASE WHEN v->'options' = NEW.variant_options
                THEN jsonb_set(v, '{stock}', to_jsonb(GREATEST(COALESCE(NULLIF(v->>'stock', '')::integer, 0) - NEW.quantity, 0)), true)
                ELSE v
              END
              ORDER BY ord
            )
            FROM jsonb_array_elements(COALESCE(p.variants, '[]'::jsonb)) WITH ORDINALITY AS e(v, ord)
          ),
          stock_quantity = GREATEST(COALESCE(p.stock_quantity, 0) - NEW.quantity, 0),
          sales_count = COALESCE(p.sales_count, 0) + NEW.quantity,
          is_out_of_stock = (GREATEST(COALESCE(p.stock_quantity, 0) - NEW.quantity, 0) = 0),
          updated_at = now()
      WHERE p.id = v_product_id
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(p.variants, '[]'::jsonb)) v
          WHERE v->'options' = NEW.variant_options
            AND GREATEST(COALESCE(NULLIF(v->>'stock', '')::integer, 0), 0) >= NEW.quantity
        );

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient stock for selected product variant';
      END IF;
      RETURN NEW;
    END IF;

    -- Variant selection was provided but did not match source inventory.
    IF EXISTS (SELECT 1 FROM products p WHERE p.id = v_product_id AND COALESCE(p.has_variants, false)) THEN
      RAISE EXCEPTION 'Selected product variant was not found in inventory';
    END IF;
  END IF;

  -- Variant products must not silently fall back to parent-level inventory.
  IF EXISTS (SELECT 1 FROM products p WHERE p.id = v_product_id AND COALESCE(p.has_variants, false)) THEN
    RAISE EXCEPTION 'A valid variant selection is required for this product';
  END IF;

  UPDATE products
  SET stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - NEW.quantity, 0),
      sales_count = COALESCE(sales_count, 0) + NEW.quantity,
      is_out_of_stock = (GREATEST(COALESCE(stock_quantity, 0) - NEW.quantity, 0) = 0),
      updated_at = now()
  WHERE id = v_product_id
    AND GREATEST(COALESCE(stock_quantity, 0), 0) >= NEW.quantity;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient product stock';
  END IF;

  RETURN NEW;
END;
$function$;
