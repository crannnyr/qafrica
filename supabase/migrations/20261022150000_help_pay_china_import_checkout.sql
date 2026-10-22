


-- China Import lines in Stores V2 are QAFRICA marketplace catalog entries, not
-- ordinary products/stores. Keep these source-aware helpers with Help Pay so a
-- shared link preserves product source through quote, payment and fulfillment.
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
  it jsonb; v_prod public.products%ROWTYPE; v_store public.stores%ROWTYPE; v_ic public.import_catalog%ROWTYPE;
  v_china public.china_import_products%ROWTYPE; v_qty integer; v_price numeric; v_imported boolean; v_attr text;
  v_errors jsonb:='[]'::jsonb; v_lines jsonb:='[]'::jsonb; v_stores jsonb:='[]'::jsonb;
  v_sid uuid; v_store_lines jsonb; v_subtotal numeric; v_fulfil uuid; v_zone numeric; v_platform_fee numeric;
  v_code text; v_coupon public.coupons%ROWTYPE; v_discount numeric; v_coupon_msg text; v_amount numeric:=0;
  v_mkt_ids uuid[]; v_variant jsonb; v_variant_stock integer; v_requested_qty integer;
  v_variant_found boolean; v_dimension_count integer; v_matched_dimension_count integer;
  v_source_type text; v_source_id uuid; v_shipping numeric; v_selected_variants jsonb;
  v_group jsonb; v_option_name text; v_option_value text; v_delta numeric; v_bad_variant boolean;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)=0 THEN
    RETURN jsonb_build_object('ok',false,'errors',jsonb_build_array(jsonb_build_object('code','empty_cart','message','Your cart is empty')));
  END IF;
  IF jsonb_array_length(p_items)>60 THEN
    RETURN jsonb_build_object('ok',false,'errors',jsonb_build_array(jsonb_build_object('code','too_many_items','message','Too many items in one checkout')));
  END IF;
  SELECT array_agg(x) INTO v_mkt_ids FROM public.marketplace_store_ids() x;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty:=LEAST(GREATEST(COALESCE((it->>'quantity')::integer,1),1),99);
    v_source_type:=COALESCE(it->>'source_type','product');
    IF v_source_type='china_import' THEN
      BEGIN v_source_id:=COALESCE(NULLIF(it->>'source_id',''),NULLIF(it->>'product_id',''))::uuid;
      EXCEPTION WHEN invalid_text_representation THEN v_source_id:=NULL; END;
      IF v_source_id IS NULL THEN
        v_errors:=v_errors||jsonb_build_object('code','china_product_unavailable','product_id',it->>'product_id','message','This China Import item is no longer available'); CONTINUE;
      END IF;
      SELECT * INTO v_china FROM public.china_import_products WHERE id=v_source_id AND is_active;
      IF NOT FOUND OR COALESCE(v_china.price_ngn,0)<=0 THEN
        v_errors:=v_errors||jsonb_build_object('code','china_product_unavailable','product_id',v_source_id,'message','This China Import item is no longer available'); CONTINUE;
      END IF;
      v_shipping:=COALESCE(NULLIF(v_china.air_shipping_customer_ngn,0),v_china.flight_shipping_cost_ngn,0);
      IF v_shipping<=0 THEN
        v_errors:=v_errors||jsonb_build_object('code','china_shipping_unavailable','product_id',v_source_id,'message','Shipping is not configured for this China Import item yet'); CONTINUE;
      END IF;
      v_selected_variants:=COALESCE(it->'variant_options','{}'::jsonb);
      IF jsonb_typeof(v_selected_variants)<>'object' THEN v_selected_variants:='{}'::jsonb; END IF;
      v_price:=v_china.price_ngn; v_bad_variant:=false;
      IF COALESCE(v_china.has_variants,false) THEN
        IF jsonb_typeof(v_china.variants)<>'array' OR jsonb_array_length(v_china.variants)=0 THEN
          v_errors:=v_errors||jsonb_build_object('code','invalid_variant','product_id',v_source_id,'message',format('Options are not configured for "%s"',v_china.name)); CONTINUE;
        END IF;
        FOR v_group IN SELECT value FROM jsonb_array_elements(v_china.variants) LOOP
          IF jsonb_typeof(v_group->'name')='string' AND jsonb_typeof(v_group->'options')='array' THEN
            v_option_name:=v_group->>'name'; v_option_value:=v_selected_variants->>v_option_name;
            IF v_option_value IS NULL OR NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(v_group->'options') o(value)
              WHERE lower(trim(o.value))=lower(trim(v_option_value))
            ) THEN
              v_bad_variant:=true;
              v_errors:=v_errors||jsonb_build_object('code','invalid_variant','product_id',v_source_id,'message',format('Please select a valid %s for "%s"',v_option_name,v_china.name));
              EXIT;
            END IF;
            v_delta:=0;
            BEGIN v_delta:=COALESCE((v_group->'price_deltas'->>v_option_value)::numeric,0);
            EXCEPTION WHEN invalid_text_representation THEN v_delta:=0; END;
            v_price:=v_price+v_delta;
          END IF;
        END LOOP;
      ELSIF jsonb_object_length(v_selected_variants)>0 THEN
        v_bad_variant:=true;
        v_errors:=v_errors||jsonb_build_object('code','invalid_variant','product_id',v_source_id,'message',format('This item has no options: "%s"',v_china.name));
      END IF;
      IF v_bad_variant THEN CONTINUE; END IF;
      IF v_price<=0 THEN
        v_errors:=v_errors||jsonb_build_object('code','china_product_unavailable','product_id',v_source_id,'message','Invalid China Import price'); CONTINUE;
      END IF;
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'product_id',v_source_id,'source_id',v_source_id,'source_type','china_import',
        'store_id','00000000-0000-0000-0000-000000000000','name',v_china.name,
        'image',COALESCE(v_china.image_urls[1],v_china.image_url),'image_url',COALESCE(v_china.image_urls[1],v_china.image_url),
        'quantity',v_qty,'unit_price',v_price,'total_price',v_price*v_qty,'variant_options',v_selected_variants,
        'is_imported',true,'attribution','marketplace','shipping_cost_ngn',v_shipping,
        'supplier_cost_ngn',v_china.price_ngn,'flight_shipping_cost_ngn',v_shipping,'dropship_price',0
      ));
      CONTINUE;
    END IF;

    BEGIN v_sid:=(it->>'store_id')::uuid; v_source_id:=(it->>'product_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_errors:=v_errors||jsonb_build_object('code','product_unavailable','product_id',it->>'product_id','store_id',it->>'store_id','message','This item is no longer available'); CONTINUE;
    END;
    SELECT * INTO v_store FROM public.stores WHERE id=v_sid;
    IF NOT FOUND OR NOT v_store.is_active OR COALESCE(v_store.is_blocked,false) THEN
      v_errors:=v_errors||jsonb_build_object('code','store_unavailable','product_id',v_source_id,'store_id',v_sid,'message','This store is not taking orders right now'); CONTINUE;
    END IF;
    SELECT * INTO v_prod FROM public.products WHERE id=v_source_id;
    IF NOT FOUND OR NOT v_prod.is_active THEN
      v_errors:=v_errors||jsonb_build_object('code','product_unavailable','product_id',v_source_id,'store_id',v_sid,'message','This item is no longer available'); CONTINUE;
    END IF;
    IF v_prod.store_id=v_store.id THEN v_imported:=false; v_price:=v_prod.selling_price;
    ELSE
      SELECT * INTO v_ic FROM public.import_catalog WHERE importer_store_id=v_store.id AND original_product_id=v_prod.id AND is_active LIMIT 1;
      IF NOT FOUND THEN v_errors:=v_errors||jsonb_build_object('code','product_unavailable','product_id',v_prod.id,'store_id',v_sid,'message','This item is no longer sold by this store'); CONTINUE; END IF;
      v_imported:=true; v_price:=COALESCE(NULLIF(v_ic.custom_selling_price,0),NULLIF(v_ic.selling_price,0),v_prod.selling_price);
    END IF;
    IF v_price IS NULL OR v_price<=0 THEN v_errors:=v_errors||jsonb_build_object('code','product_unavailable','product_id',v_source_id,'store_id',v_sid,'message','This item has no price'); CONTINUE; END IF;
    IF COALESCE(v_prod.is_out_of_stock,false) THEN v_errors:=v_errors||jsonb_build_object('code','insufficient_stock','product_id',v_source_id,'store_id',v_sid,'available',GREATEST(COALESCE(v_prod.stock_quantity,0),0),'message',format('Only %s left of "%s"',GREATEST(COALESCE(v_prod.stock_quantity,0),0),v_prod.name)); CONTINUE; END IF;
    IF COALESCE(v_prod.has_variants,false) THEN
      v_variant_found:=false; v_variant_stock:=0;
      IF jsonb_typeof(it->'variant_options')='object' AND jsonb_typeof(v_prod.variants)='array' THEN
        FOR v_variant IN SELECT value FROM jsonb_array_elements(v_prod.variants) LOOP
          IF v_variant->'options'=it->'variant_options' AND v_variant?'stock' THEN v_variant_found:=true; v_variant_stock:=GREATEST(COALESCE(NULLIF(v_variant->>'stock','')::integer,0),0); EXIT; END IF;
        END LOOP;
      END IF;
      IF v_variant_found THEN
        SELECT COALESCE(SUM((l->>'quantity')::integer),0) INTO v_requested_qty FROM jsonb_array_elements(v_lines) l WHERE (l->>'product_id')::uuid=v_prod.id AND l->'variant_options'=it->'variant_options';
        IF v_variant_stock<v_qty+v_requested_qty THEN v_errors:=v_errors||jsonb_build_object('code','insufficient_stock','product_id',v_source_id,'store_id',v_sid,'available',GREATEST(v_variant_stock-v_requested_qty,0),'message',format('Only %s left for the selected option of "%s"',GREATEST(v_variant_stock-v_requested_qty,0),v_prod.name)); CONTINUE; END IF;
      ELSE
        IF COALESCE(jsonb_typeof(it->'variant_options'),'null')<>'object' THEN v_errors:=v_errors||jsonb_build_object('code','invalid_variant','product_id',v_source_id,'store_id',v_sid,'message',format('Please select a valid option for "%s"',v_prod.name)); CONTINUE; END IF;
        SELECT COUNT(*) INTO v_dimension_count FROM jsonb_array_elements(COALESCE(v_prod.variants,'[]'::jsonb)) d WHERE jsonb_typeof(d->'name')='string' AND jsonb_typeof(d->'options')='array' AND NOT(d?'stock');
        SELECT COUNT(*) INTO v_matched_dimension_count FROM jsonb_each(COALESCE(it->'variant_options','{}'::jsonb)) opt WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_prod.variants,'[]'::jsonb)) d WHERE lower(trim(d->>'name'))=lower(trim(opt.key)) AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(d->'options') choice(value) WHERE lower(trim(choice.value))=lower(trim(opt.value#>>'{}'))));
        IF v_dimension_count=0 OR v_matched_dimension_count<>v_dimension_count OR jsonb_object_length(COALESCE(it->'variant_options','{}'::jsonb))<>v_dimension_count THEN v_errors:=v_errors||jsonb_build_object('code','invalid_variant','product_id',v_source_id,'store_id',v_sid,'message',format('Please select a valid option for "%s"',v_prod.name)); CONTINUE; END IF;
        SELECT COALESCE(SUM((l->>'quantity')::integer),0) INTO v_requested_qty FROM jsonb_array_elements(v_lines) l WHERE (l->>'product_id')::uuid=v_prod.id;
        IF COALESCE(v_prod.stock_quantity,0)<v_qty+v_requested_qty THEN v_errors:=v_errors||jsonb_build_object('code','insufficient_stock','product_id',v_source_id,'store_id',v_sid,'available',GREATEST(COALESCE(v_prod.stock_quantity,0)-v_requested_qty,0),'message',format('Only %s left of "%s"',GREATEST(COALESCE(v_prod.stock_quantity,0)-v_requested_qty,0),v_prod.name)); CONTINUE; END IF;
      END IF;
    ELSE
      SELECT COALESCE(SUM((l->>'quantity')::integer),0) INTO v_requested_qty FROM jsonb_array_elements(v_lines) l WHERE (l->>'product_id')::uuid=v_prod.id AND COALESCE(l->'variant_options','null'::jsonb)='null'::jsonb;
      IF COALESCE(v_prod.stock_quantity,0)<v_qty+v_requested_qty THEN v_errors:=v_errors||jsonb_build_object('code','insufficient_stock','product_id',v_source_id,'store_id',v_sid,'available',GREATEST(COALESCE(v_prod.stock_quantity,0)-v_requested_qty,0),'message',format('Only %s left of "%s"',GREATEST(COALESCE(v_prod.stock_quantity,0)-v_requested_qty,0),v_prod.name)); CONTINUE; END IF;
    END IF;
    v_attr:=CASE WHEN it->>'attribution'='marketplace' AND NOT v_imported AND v_store.id=ANY(COALESCE(v_mkt_ids,'{}')) THEN 'marketplace' ELSE 'own' END;
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
      'product_id',v_prod.id,'store_id',v_sid,'name',v_prod.name,'image',v_prod.images[1],
      'quantity',v_qty,'unit_price',v_price,'total_price',v_price*v_qty,'variant_options',COALESCE(it->'variant_options','null'::jsonb),
      'is_imported',v_imported,'original_owner_id',CASE WHEN v_imported THEN v_prod.owner_id END,
      'original_store_id',CASE WHEN v_imported THEN v_prod.store_id END,'dropship_price',CASE WHEN v_imported THEN COALESCE(v_ic.dropship_price,v_prod.dropship_price,0) ELSE 0 END,'attribution',v_attr
    ));
  END LOOP;

  FOR v_sid IN SELECT DISTINCT (l->>'store_id')::uuid FROM jsonb_array_elements(v_lines) l LOOP
    SELECT jsonb_agg(l) INTO v_store_lines FROM jsonb_array_elements(v_lines) l WHERE (l->>'store_id')::uuid=v_sid;
    SELECT SUM((l->>'total_price')::numeric) INTO v_subtotal FROM jsonb_array_elements(v_store_lines) l;
    IF v_sid='00000000-0000-0000-0000-000000000000'::uuid THEN
      v_zone:=COALESCE((SELECT SUM((l->>'shipping_cost_ngn')::numeric*(l->>'quantity')::numeric) FROM jsonb_array_elements(v_store_lines) l),0);
      v_stores:=v_stores||jsonb_build_array(jsonb_build_object('store_id',v_sid,'store_name','QAFRICA','store_slug','qafrica','logo_url','/qafrica-bag-logo.svg','items',v_store_lines,'subtotal',v_subtotal,'delivery_fee',v_zone,'platform_fee',0,'coupon_code',NULL,'coupon_discount',0,'coupon_message',NULL,'total',v_subtotal+v_zone,'shipping_included',true,'flight_shipping_total',v_zone));
      v_amount:=v_amount+v_subtotal+v_zone;
    ELSE
      SELECT * INTO v_store FROM public.stores WHERE id=v_sid;
      v_zone:=NULL;
      IF p_state IS NOT NULL AND trim(p_state)<>'' THEN
        SELECT CASE WHEN bool_and((l->>'is_imported')::boolean AND COALESCE(l->>'source_type','product')<>'china_import') AND count(DISTINCT l->>'original_store_id')=1 THEN (min(l->>'original_store_id'))::uuid ELSE v_sid END INTO v_fulfil FROM jsonb_array_elements(v_store_lines) l;
        SELECT price INTO v_zone FROM public.delivery_zones WHERE store_id=v_fulfil AND lower(trim(state))=lower(trim(p_state)) AND is_active LIMIT 1;
        IF v_zone IS NULL THEN v_errors:=v_errors||jsonb_build_object('code','no_delivery','store_id',v_sid,'message',format('%s doesn''t deliver to %s yet',v_store.name,p_state)); END IF;
      END IF;
      v_discount:=0; v_coupon_msg:=NULL; v_code:=upper(trim(COALESCE(p_coupons->>(v_sid::text),'')));
      IF v_code<>'' THEN
        SELECT * INTO v_coupon FROM public.coupons WHERE store_id=v_sid AND upper(code)=v_code LIMIT 1;
        IF NOT FOUND OR NOT v_coupon.is_active THEN v_coupon_msg:='This code isn''t valid';
        ELSIF v_coupon.start_date IS NOT NULL AND v_coupon.start_date>now() THEN v_coupon_msg:='This code isn''t active yet';
        ELSIF v_coupon.end_date IS NOT NULL AND v_coupon.end_date<now() THEN v_coupon_msg:='This code has expired';
        ELSIF v_coupon.usage_limit IS NOT NULL AND COALESCE(v_coupon.usage_count,0)>=v_coupon.usage_limit THEN v_coupon_msg:='This code has been used up';
        ELSIF COALESCE(v_coupon.min_order_amount,0)>v_subtotal THEN v_coupon_msg:=format('Spend ₦%s or more to use this code',to_char(v_coupon.min_order_amount,'FM999,999,999'));
        ELSE v_discount:=CASE WHEN v_coupon.discount_type='percentage' THEN round(v_subtotal*v_coupon.discount_value/100,2) ELSE v_coupon.discount_value END; IF v_coupon.max_discount_amount IS NOT NULL AND v_coupon.max_discount_amount>0 THEN v_discount:=LEAST(v_discount,v_coupon.max_discount_amount); END IF; v_discount:=LEAST(GREATEST(v_discount,0),v_subtotal); END IF;
      END IF;
      v_platform_fee:=CASE WHEN v_zone IS NOT NULL THEN 120 ELSE 0 END;
      v_stores:=v_stores||jsonb_build_array(jsonb_build_object('store_id',v_sid,'store_name',v_store.name,'store_slug',v_store.slug,'logo_url',v_store.logo_url,'items',v_store_lines,'subtotal',v_subtotal,'delivery_fee',v_zone,'platform_fee',v_platform_fee,'coupon_code',NULLIF(v_code,''),'coupon_discount',v_discount,'coupon_message',v_coupon_msg,'total',GREATEST(v_subtotal+COALESCE(v_zone,0)+v_platform_fee-v_discount,0)));
      v_amount:=v_amount+GREATEST(v_subtotal+COALESCE(v_zone,0)+v_platform_fee-v_discount,0);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok',jsonb_array_length(v_errors)=0 AND jsonb_array_length(v_stores)>0 AND p_state IS NOT NULL AND trim(p_state)<>'','state',p_state,'stores',v_stores,'amount',v_amount,'errors',v_errors);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_shared_cart(
  p_items jsonb, p_recipient jsonb, p_delivery jsonb, p_note text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text:=left(trim(COALESCE(p_recipient->>'name','')),80);
  v_email text:=lower(left(trim(COALESCE(p_recipient->>'email','')),120));
  v_phone text:=regexp_replace(COALESCE(p_recipient->>'phone',''),'[^\d+]','','g');
  v_state text:=left(trim(COALESCE(p_delivery->>'state','')),40);
  v_items jsonb:='[]'::jsonb; v_item jsonb; v_source_id text; v_store_id text;
  v_q jsonb; v_code text; v_note text; v_customer uuid;
BEGIN
  IF length(v_name)<2 THEN RAISE EXCEPTION 'Enter your full name' USING ERRCODE='22023'; END IF;
  IF v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN RAISE EXCEPTION 'Enter a valid email address' USING ERRCODE='22023'; END IF;
  IF v_phone !~ '^\+?\d{10,14}$' THEN RAISE EXCEPTION 'Enter a valid phone number' USING ERRCODE='22023'; END IF;
  IF length(trim(COALESCE(p_delivery->>'address','')))<5 OR trim(COALESCE(p_delivery->>'city',''))='' OR v_state='' THEN RAISE EXCEPTION 'Enter your full delivery address' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)=0 OR jsonb_array_length(p_items)>60 THEN RAISE EXCEPTION 'Your cart is empty or too large' USING ERRCODE='22023'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_source_id:=COALESCE(NULLIF(v_item->>'source_id',''),NULLIF(v_item->>'product_id',''));
    v_store_id:=COALESCE(v_item->>'store_id','');
    IF v_item->>'source_type'='china_import' THEN
      v_items:=v_items||jsonb_build_array(jsonb_build_object('source_type','china_import','source_id',v_source_id,'product_id',v_source_id,'store_id','00000000-0000-0000-0000-000000000000','quantity',v_item->'quantity','variant_options',v_item->'variant_options','attribution','marketplace'));
    ELSE
      v_items:=v_items||jsonb_build_array(jsonb_build_object('source_type','product','product_id',v_source_id,'store_id',v_store_id,'quantity',v_item->'quantity','variant_options',v_item->'variant_options','attribution',COALESCE(v_item->'attribution','"own"'::jsonb)));
    END IF;
  END LOOP;
  v_note:=public.clean_share_note(p_note);
  v_q:=public.checkout_quote(v_items,v_state,'{}'::jsonb);
  IF NOT COALESCE((v_q->>'ok')::boolean,false) THEN RAISE EXCEPTION '%',COALESCE(v_q->'errors'->0->>'message','Some items can''t be ordered right now') USING ERRCODE='22023'; END IF;
  IF (SELECT count(*) FROM public.shared_carts WHERE recipient_email=v_email AND created_at>now()-interval '1 day')>=20 THEN RAISE EXCEPTION 'Too many links today. Please try again tomorrow.' USING ERRCODE='22023'; END IF;
  SELECT id INTO v_customer FROM public.customers WHERE id=auth.uid();
  v_code:=upper(substr(translate(encode(extensions.gen_random_bytes(12),'base64'),'+/=0O1Il',''),1,10));
  INSERT INTO public.shared_carts(code,items,recipient_name,recipient_email,recipient_phone,delivery,note,created_by,amount_snapshot)
  VALUES(v_code,v_items,v_name,v_email,v_phone,jsonb_build_object('address',left(trim(p_delivery->>'address'),200),'city',left(trim(p_delivery->>'city'),60),'state',v_state,'landmark',left(trim(COALESCE(p_delivery->>'landmark','')),120)),v_note,v_customer,(v_q->>'amount')::numeric);
  RETURN jsonb_build_object('code',v_code,'amount',(v_q->>'amount')::numeric,'expires_at',now()+interval '30 days');
END;
$$;

-- Wrap the marketplace checkout finalizer so Help Pay contributions are
-- funded collectively and the China Import order is created exactly once.
DO $wrap$
BEGIN
  IF to_regprocedure('public.finalize_marketplace_checkout_session_base(text,numeric,numeric,text)') IS NULL THEN
    ALTER FUNCTION public.finalize_marketplace_checkout_session(text,numeric,numeric,text)
      RENAME TO finalize_marketplace_checkout_session_base;
  END IF;
END;
$wrap$;

CREATE OR REPLACE FUNCTION public.finalize_marketplace_checkout_session(
  p_reference text, p_paid_amount numeric, p_gateway_fee numeric DEFAULT 0, p_transaction_id text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cs public.marketplace_checkout_sessions%ROWTYPE;
  contribution public.shared_cart_contributions%ROWTYPE;
  cart_row public.shared_carts%ROWTYPE;
  raised numeric(12,2); target numeric(12,2); total_gateway_fee numeric(12,2); base_result jsonb;
BEGIN
  SELECT * INTO cs FROM public.marketplace_checkout_sessions WHERE reference=p_reference FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unknown_reference'); END IF;
  SELECT * INTO contribution FROM public.shared_cart_contributions WHERE checkout_reference=p_reference FOR UPDATE;
  IF NOT FOUND THEN RETURN public.finalize_marketplace_checkout_session_base(p_reference,p_paid_amount,p_gateway_fee,p_transaction_id); END IF;
  SELECT * INTO cart_row FROM public.shared_carts WHERE id=contribution.shared_cart_id FOR UPDATE;
  IF NOT FOUND OR cart_row.expires_at<=now() OR cart_row.status NOT IN ('active','paid') THEN
    UPDATE public.shared_cart_contributions SET status='failed' WHERE id=contribution.id AND status='pending';
    UPDATE public.marketplace_checkout_sessions SET status='fulfilment_error',error='Shared payment link is no longer active',
      paid_amount=p_paid_amount,gateway_fee=p_gateway_fee,nomba_transaction_id=p_transaction_id,updated_at=now()
    WHERE id=cs.id AND status<>'paid';
    RETURN jsonb_build_object('status','fulfilment_error','detail','Shared payment link is no longer active');
  END IF;
  IF p_paid_amount IS NULL OR p_paid_amount+1<cs.amount THEN
    RETURN public.finalize_marketplace_checkout_session_base(p_reference,p_paid_amount,p_gateway_fee,p_transaction_id);
  END IF;
  IF cs.status='paid' AND contribution.status='paid' THEN
    SELECT COALESCE(sum(amount),0) INTO raised FROM public.shared_cart_contributions WHERE shared_cart_id=cart_row.id AND status='paid';
    target:=COALESCE(cart_row.amount_snapshot,0);
    RETURN jsonb_build_object('status','paid','order_ids',to_jsonb(cs.order_ids),'china_import_order_ids',to_jsonb(cs.china_import_order_ids),
      'already',true,'contribution_complete',cart_row.status='paid' OR raised+0.01>=target,
      'amount_raised',raised,'target_amount',target,'contribution_amount',contribution.amount);
  END IF;
  UPDATE public.shared_cart_contributions SET status='paid',paid_at=COALESCE(paid_at,now()),gateway_fee=COALESCE(p_gateway_fee,0)
    WHERE id=contribution.id AND status='pending';
  SELECT COALESCE(sum(amount),0) INTO raised FROM public.shared_cart_contributions WHERE shared_cart_id=cart_row.id AND status='paid';
  target:=COALESCE(NULLIF(cart_row.amount_snapshot,0),cs.amount);
  SELECT COALESCE(sum(gateway_fee),0) INTO total_gateway_fee FROM public.shared_cart_contributions WHERE shared_cart_id=cart_row.id AND status='paid';
  IF raised+0.01<target THEN
    UPDATE public.marketplace_checkout_sessions SET status='paid',paid_amount=p_paid_amount,gateway_fee=p_gateway_fee,
      nomba_transaction_id=p_transaction_id,paid_at=now(),updated_at=now(),order_ids='{}'::uuid[],china_import_order_ids='{}'::uuid[]
    WHERE id=cs.id;
    RETURN jsonb_build_object('status','paid','order_ids','[]'::jsonb,'china_import_order_ids','[]'::jsonb,'already',false,
      'contribution_complete',false,'amount_raised',raised,'target_amount',target,'contribution_amount',contribution.amount);
  END IF;
  UPDATE public.marketplace_checkout_sessions SET amount=target WHERE id=cs.id;
  base_result:=public.finalize_marketplace_checkout_session_base(p_reference,target,total_gateway_fee,p_transaction_id);
  IF base_result->>'status'='paid' THEN
    UPDATE public.marketplace_checkout_sessions SET amount=contribution.amount,paid_amount=p_paid_amount,gateway_fee=total_gateway_fee,updated_at=now()
      WHERE id=cs.id;
    PERFORM public.mark_shared_cart_paid(cart_row.id,p_reference);
    RETURN base_result||jsonb_build_object('contribution_complete',true,'amount_raised',raised,'target_amount',target,'contribution_amount',contribution.amount);
  END IF;
  UPDATE public.marketplace_checkout_sessions SET amount=contribution.amount,updated_at=now() WHERE id=cs.id AND status<>'paid';
  RETURN base_result;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_marketplace_checkout_session(text,numeric,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_marketplace_checkout_session(text,numeric,numeric,text) TO service_role;
REVOKE ALL ON FUNCTION public.finalize_marketplace_checkout_session_base(text,numeric,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_marketplace_checkout_session_base(text,numeric,numeric,text) TO service_role;
