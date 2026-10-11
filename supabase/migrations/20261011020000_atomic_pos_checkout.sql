-- Atomic checkout RPC for POS sales.
CREATE OR REPLACE FUNCTION public.record_pos_sale(
  p_store_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_payment_method text,
  p_discount numeric,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_now timestamptz := now();
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_line_total numeric(12,2);
  v_allocated_discount numeric(12,2);
  v_effective_revenue numeric(12,2);
  v_items_json jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.assert_store_access(p_store_id);
  IF nullif(trim(p_customer_name), '') IS NULL THEN
    RAISE EXCEPTION 'Customer name is required' USING ERRCODE = '22023';
  END IF;
  IF p_payment_method NOT IN ('cash', 'transfer', 'pos', 'check') THEN
    RAISE EXCEPTION 'Unsupported POS payment method' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one product is required' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_discount, 0) < 0 THEN
    RAISE EXCEPTION 'Discount cannot be negative' USING ERRCODE = '22023';
  END IF;

  -- Lock products in deterministic order before checking quantities.
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_items)
    ORDER BY (value->>'product_id')::uuid
  LOOP
    IF coalesce((v_item->>'quantity')::integer, 0) <= 0
       OR coalesce((v_item->>'unit_price')::numeric, -1) < 0 THEN
      RAISE EXCEPTION 'Invalid product quantity or price' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_product FROM public.products
     WHERE id = (v_item->>'product_id')::uuid AND store_id = p_store_id FOR UPDATE;
    IF NOT FOUND OR NOT coalesce(v_product.is_active, false) THEN
      RAISE EXCEPTION 'A product is no longer available. Refresh products and try again' USING ERRCODE = '22023';
    END IF;
    IF coalesce(v_product.is_out_of_stock, false)
       OR coalesce(v_product.stock_quantity, 0) < (v_item->>'quantity')::integer THEN
      RAISE EXCEPTION 'Insufficient stock for %', v_product.name USING ERRCODE = '22023';
    END IF;
    v_subtotal := v_subtotal + ((v_item->>'quantity')::integer * round((v_item->>'unit_price')::numeric, 2));
  END LOOP;

  v_subtotal := round(v_subtotal, 2);
  v_discount := least(round(coalesce(p_discount, 0), 2), v_subtotal);
  v_total := v_subtotal - v_discount;
  v_order_number := 'POS-' || to_char(v_now AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSMS')
    || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.orders (
    order_number, store_id, customer_id, customer_name, customer_email,
    customer_phone, items, subtotal, delivery_fee, platform_fee, total,
    delivery_address, delivery_state, payment_status, payment_method,
    paid_at, status, delivered_at, created_at, updated_at, coupon_discount,
    is_manual_sale, attribution_source
  ) VALUES (
    v_order_number, p_store_id, NULL, trim(p_customer_name), '',
    coalesce(trim(p_customer_phone), ''), '[]'::jsonb, v_subtotal, 0, 0, v_total,
    jsonb_build_object('address', 'Point of Sale - In Store Pickup', 'city', 'Point of Sale',
      'state', 'Point of Sale', 'landmark', ''),
    'Point of Sale', 'paid', p_payment_method, v_now, 'delivered', v_now, v_now, v_now,
    v_discount, true, 'own'
  ) RETURNING id INTO v_order_id;

  -- order_items' existing trigger decrements stock; a trigger failure rolls back all work.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product FROM public.products
     WHERE id = (v_item->>'product_id')::uuid AND store_id = p_store_id FOR UPDATE;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := round((v_item->>'unit_price')::numeric, 2);
    v_line_total := round(v_quantity * v_unit_price, 2);
    v_allocated_discount := CASE WHEN v_subtotal > 0
      THEN round(v_discount * v_line_total / v_subtotal, 2) ELSE 0 END;
    v_effective_revenue := greatest(v_line_total - v_allocated_discount, 0);

    INSERT INTO public.order_items (
      order_id, product_id, original_product_id, product_name, quantity,
      unit_price, price_at_time, total_price, is_imported, attribution_source
    ) VALUES (
      v_order_id, v_product.id, v_product.id, v_product.name, v_quantity,
      v_unit_price, v_unit_price, v_line_total, false, 'own'
    );

    INSERT INTO public.product_earnings (
      product_id, store_id, owner_id, order_id, quantity_sold, unit_cost,
      unit_price, total_revenue, total_cost, profit, platform_fee, net_profit,
      earned_at, created_at
    ) VALUES (
      v_product.id, p_store_id, v_product.owner_id, v_order_id, v_quantity,
      coalesce(v_product.cost_price, 0),
      round(v_effective_revenue / v_quantity, 2),
      v_effective_revenue, round(coalesce(v_product.cost_price, 0) * v_quantity, 2),
      round(v_effective_revenue - coalesce(v_product.cost_price, 0) * v_quantity, 2),
      0, round(v_effective_revenue - coalesce(v_product.cost_price, 0) * v_quantity, 2),
      v_now, v_now
    );

    v_items_json := v_items_json || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id, 'name', v_product.name,
      'quantity', v_quantity, 'unit_price', v_unit_price, 'total_price', v_line_total
    ));
  END LOOP;
  UPDATE public.orders SET items = v_items_json WHERE id = v_order_id;
  RETURN jsonb_build_object('id', v_order_id, 'order_number', v_order_number,
    'subtotal', v_subtotal, 'discount', v_discount, 'total', v_total);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.record_pos_sale(uuid, text, text, text, numeric, jsonb) TO authenticated;
