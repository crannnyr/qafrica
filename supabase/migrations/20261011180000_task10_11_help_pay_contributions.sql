-- Task 10 & 11: Help Pay eligibility, 30-day links, and marketplace contributions.
-- PostgreSQL does not provide jsonb_object_length; checkout_quote uses it to
-- validate legacy variant option objects. Supply the missing helper explicitly.
CREATE OR REPLACE FUNCTION public.jsonb_object_length(p_value jsonb)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public'
AS $fn$
  SELECT CASE WHEN jsonb_typeof(p_value) = 'object'
    THEN (SELECT count(*)::integer FROM jsonb_object_keys(p_value))
    ELSE 0 END
$fn$;

ALTER TABLE public.shared_carts
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days');

-- Extend only links that are still active; never revive an expired link.
UPDATE public.shared_carts
SET expires_at = created_at + interval '30 days'
WHERE status = 'active'
  AND expires_at > now()
  AND expires_at < created_at + interval '30 days';

CREATE TABLE IF NOT EXISTS public.shared_cart_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_cart_id uuid NOT NULL REFERENCES public.shared_carts(id) ON DELETE CASCADE,
  checkout_reference text NOT NULL UNIQUE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  gateway_fee numeric(12,2) NOT NULL DEFAULT 0,
  payer_name text NOT NULL,
  payer_email text NOT NULL,
  is_marketplace boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  notification_sent_at timestamptz
);

ALTER TABLE public.shared_cart_contributions ADD COLUMN IF NOT EXISTS gateway_fee numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.shared_cart_contributions ADD COLUMN IF NOT EXISTS is_marketplace boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS shared_cart_contributions_cart_status_idx
  ON public.shared_cart_contributions(shared_cart_id, status, created_at);

ALTER TABLE public.shared_cart_contributions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shared_cart_contributions FROM anon, authenticated;
GRANT ALL ON public.shared_cart_contributions TO service_role;

CREATE OR REPLACE FUNCTION public.shared_cart_is_marketplace(p_items jsonb, p_state text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE q jsonb; total_items integer; marketplace_items integer;
BEGIN
  q := public.checkout_quote(p_items, p_state, '{}'::jsonb);
  IF COALESCE((q->>'ok')::boolean, false) IS NOT TRUE THEN RETURN false; END IF;
  -- Check each validated quote line's server-derived attribution. Do not trust
  -- the raw cart's attribution field for contribution eligibility.
  SELECT count(*), count(*) FILTER (WHERE line_json->>'attribution' = 'marketplace')
    INTO total_items, marketplace_items
  FROM jsonb_array_elements(q->'stores') AS stores(store_json),
       jsonb_array_elements(stores.store_json->'items') AS lines(line_json);
  RETURN total_items > 0 AND total_items = marketplace_items;
END;
$$;

-- Remove existing public listings that do not satisfy the marketplace-only rule.
UPDATE public.shared_carts SET is_public = false WHERE is_public = true AND public.shared_cart_is_marketplace(items, delivery->>'state') = false;

-- Atomically reserve a contribution so concurrent payers cannot overfund the cart.
-- For non-marketplace carts, only the full current quote is allowed.
CREATE OR REPLACE FUNCTION public.prepare_shared_cart_payment(
  p_code text,
  p_reference text,
  p_requested_amount numeric,
  p_payer_name text,
  p_payer_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sc public.shared_carts%ROWTYPE;
  q jsonb;
  target numeric(12,2);
  raised numeric(12,2);
  reserved numeric(12,2);
  remaining numeric(12,2);
  remaining_total numeric(12,2);
  chosen numeric(12,2);
  marketplace boolean;
BEGIN
  SELECT * INTO sc FROM public.shared_carts
  WHERE code = upper(trim(p_code))
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This payment link was not found' USING ERRCODE='22023'; END IF;
  IF sc.status <> 'active' OR sc.expires_at <= now() THEN
    RAISE EXCEPTION 'This payment link has expired or is already paid' USING ERRCODE='22023';
  END IF;

  q := public.checkout_quote(sc.items, sc.delivery->>'state', '{}'::jsonb);
  IF COALESCE((q->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Some items need attention before payment' USING ERRCODE='22023';
  END IF;
  target := round((q->>'amount')::numeric, 2);
  marketplace := public.shared_cart_is_marketplace(sc.items, sc.delivery->>'state');

  UPDATE public.shared_cart_contributions
  SET status='expired'
  WHERE shared_cart_id=sc.id AND status='pending' AND created_at <= now() - interval '2 hours';

  SELECT COALESCE(sum(amount),0) INTO raised
  FROM public.shared_cart_contributions WHERE shared_cart_id=sc.id AND status='paid';
  SELECT COALESCE(sum(amount),0) INTO reserved
  FROM public.shared_cart_contributions WHERE shared_cart_id=sc.id AND status='pending';
  remaining_total := greatest(round(target - raised, 2), 0);
  remaining := greatest(round(remaining_total - reserved, 2), 0);

  IF remaining <= 0 THEN RAISE EXCEPTION 'The remaining balance is already being paid' USING ERRCODE='22023'; END IF;
  chosen := COALESCE(p_requested_amount, remaining);
  IF chosen <= 0 OR chosen > remaining THEN
    RAISE EXCEPTION 'Contribution must not exceed the remaining balance of %', remaining USING ERRCODE='22023';
  END IF;

  IF NOT marketplace AND (abs(chosen - target) > 0.01 OR raised > 0) THEN
    RAISE EXCEPTION 'This cart requires one full payment' USING ERRCODE='22023';
  END IF;
  IF marketplace AND chosen < least(1000::numeric, remaining_total) THEN
    RAISE EXCEPTION 'The minimum contribution is ₦%', least(1000::numeric, remaining_total) USING ERRCODE='22023';
  END IF;

  UPDATE public.shared_carts SET amount_snapshot=target WHERE id=sc.id;
  INSERT INTO public.shared_cart_contributions
    (shared_cart_id, checkout_reference, amount, payer_name, payer_email, is_marketplace)
  VALUES (sc.id, p_reference, chosen, left(trim(p_payer_name),80), lower(left(trim(p_payer_email),120)), marketplace);

  RETURN jsonb_build_object(
    'amount', chosen, 'target_amount', target, 'amount_raised', raised,
    'remaining', greatest(round(target-raised,2),0), 'marketplace', marketplace, 'quote', q
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_shared_cart_payment(text,text,numeric,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_shared_cart_payment(text,text,numeric,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.set_help_pay_public(p_code text, p_public boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE sc public.shared_carts%ROWTYPE;
BEGIN
  SELECT * INTO sc FROM public.shared_carts
  WHERE code = upper(trim(p_code))
  FOR UPDATE;
  IF NOT FOUND OR sc.created_by IS NULL OR sc.created_by <> auth.uid() THEN
    RAISE EXCEPTION 'Sign in with the account that created this link to post it on Help Pay' USING ERRCODE='42501';
  END IF;
  IF p_public AND (sc.status <> 'active' OR sc.expires_at < now()) THEN
    RAISE EXCEPTION 'This link is no longer active' USING ERRCODE='22023';
  END IF;
  IF p_public AND NOT public.shared_cart_is_marketplace(sc.items, sc.delivery->>'state') THEN
    RAISE EXCEPTION 'Only marketplace-product carts can be posted on Help Pay' USING ERRCODE='22023';
  END IF;
  IF p_public AND (
    SELECT count(*) FROM public.shared_carts
    WHERE created_by=auth.uid() AND is_public AND status='active'
      AND expires_at > now() AND id <> sc.id
  ) >= 3 THEN
    RAISE EXCEPTION 'You can have up to 3 carts on Help Pay at a time' USING ERRCODE='22023';
  END IF;
  UPDATE public.shared_carts
  SET is_public=p_public, published_at=CASE WHEN p_public THEN now() ELSE published_at END
  WHERE id=sc.id;
END;
$$;

-- Preserve the existing full-checkout implementation, then route marketplace
-- Help Pay contributions through an aggregate funding check.
ALTER FUNCTION public.finalize_checkout_session(text,numeric,numeric,text)
  RENAME TO finalize_checkout_session_base;

CREATE OR REPLACE FUNCTION public.finalize_checkout_session(
  p_reference text,
  p_paid_amount numeric,
  p_gateway_fee numeric,
  p_transaction_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cs public.checkout_sessions%ROWTYPE;
  contribution public.shared_cart_contributions%ROWTYPE;
  cart_row public.shared_carts%ROWTYPE;
  target numeric(12,2);
  raised numeric(12,2);
  total_gateway_fee numeric(12,2);
  base_result jsonb;
BEGIN
  SELECT * INTO cs FROM public.checkout_sessions WHERE reference=p_reference FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unknown_reference'); END IF;
  IF cs.status='paid' THEN
    RETURN jsonb_build_object('status','paid','order_ids',to_jsonb(cs.order_ids),'already',true);
  END IF;

  SELECT * INTO contribution FROM public.shared_cart_contributions
  WHERE checkout_reference=p_reference;
  IF NOT FOUND THEN
    RETURN public.finalize_checkout_session_base(p_reference,p_paid_amount,p_gateway_fee,p_transaction_id);
  END IF;

  IF p_paid_amount IS NULL OR p_paid_amount + 1 < cs.amount THEN
    RETURN public.finalize_checkout_session_base(p_reference,p_paid_amount,p_gateway_fee,p_transaction_id);
  END IF;

  SELECT * INTO cart_row FROM public.shared_carts WHERE id=contribution.shared_cart_id FOR UPDATE;
  IF NOT FOUND OR cart_row.status <> 'active' OR cart_row.expires_at <= now() THEN
    UPDATE public.shared_cart_contributions SET status='failed'
    WHERE id=contribution.id AND status='pending';
    UPDATE public.checkout_sessions SET status='fulfilment_error', error='Shared cart is no longer active',
      paid_amount=p_paid_amount, gateway_fee=p_gateway_fee, nomba_transaction_id=p_transaction_id, updated_at=now()
    WHERE id=cs.id;
    RETURN jsonb_build_object('status','fulfilment_error','detail','Shared cart is no longer active');
  END IF;

  UPDATE public.shared_cart_contributions SET status='paid', paid_at=COALESCE(paid_at,now()), gateway_fee=COALESCE(p_gateway_fee,0)
  WHERE id=contribution.id AND status='pending';

  SELECT COALESCE(sum(amount),0) INTO raised
  FROM public.shared_cart_contributions
  WHERE shared_cart_id=cart_row.id AND status='paid';
  SELECT round(COALESCE(sum((store_json->>'total')::numeric),cart_row.amount_snapshot,0),2)
    INTO target FROM jsonb_array_elements(cs.store_orders) AS stores(store_json);
  SELECT COALESCE(sum(gateway_fee),0) INTO total_gateway_fee
    FROM public.shared_cart_contributions WHERE shared_cart_id=cart_row.id AND status='paid';

  IF raised + 0.01 < target THEN
    UPDATE public.checkout_sessions SET status='paid', paid_amount=p_paid_amount, gateway_fee=p_gateway_fee,
      nomba_transaction_id=p_transaction_id, paid_at=now(), updated_at=now()
    WHERE id=cs.id;
    RETURN jsonb_build_object('status','paid','order_ids','[]'::jsonb,'already',false,
      'contribution_complete',false,'amount_raised',raised,'target_amount',target,
      'contribution_amount',contribution.amount);
  END IF;

  -- The final contributor triggers the existing order-creation transaction.
  -- Its session's store_orders still contains the full validated cart quote.
  -- The legacy finalizer uses checkout_sessions.amount to allocate gateway fees.
  -- Temporarily set it to the full cart target, then restore the actual contribution.
  UPDATE public.checkout_sessions SET amount=target WHERE id=cs.id;
  base_result := public.finalize_checkout_session_base(p_reference,target,total_gateway_fee,p_transaction_id);
  UPDATE public.checkout_sessions SET amount=contribution.amount WHERE id=cs.id;
  IF base_result->>'status'='paid' THEN
    UPDATE public.checkout_sessions SET paid_amount=p_paid_amount, updated_at=now() WHERE id=cs.id;
    RETURN base_result || jsonb_build_object('contribution_complete',true,'amount_raised',raised,
      'target_amount',target,'contribution_amount',contribution.amount);
  END IF;
  RETURN base_result;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_checkout_session(text,numeric,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_checkout_session(text,numeric,numeric,text) TO service_role;


CREATE OR REPLACE FUNCTION public.get_shared_cart(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sc public.shared_carts%ROWTYPE;
  q jsonb;
  raised numeric(12,2);
  target numeric(12,2);
  marketplace boolean;
  v_status text;
BEGIN
  SELECT * INTO sc FROM public.shared_carts WHERE code=upper(trim(p_code));
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_status := CASE WHEN sc.status='active' AND sc.expires_at <= now() THEN 'expired' ELSE sc.status END;
  IF v_status='active' THEN q := public.checkout_quote(sc.items,sc.delivery->>'state','{}'::jsonb); END IF;
  target := COALESCE((q->>'amount')::numeric, sc.amount_snapshot, 0);
  marketplace := public.shared_cart_is_marketplace(sc.items,sc.delivery->>'state');
  SELECT COALESCE(sum(amount),0) INTO raised
    FROM public.shared_cart_contributions WHERE shared_cart_id=sc.id AND status='paid';
  RETURN jsonb_build_object(
    'code',sc.code,'status',v_status,'expires_at',sc.expires_at,'created_at',sc.created_at,
    'first_name',split_part(sc.recipient_name,' ',1),'city',sc.delivery->>'city',
    'state',sc.delivery->>'state','note',sc.note,'quote',q,
    'is_marketplace',marketplace,'amount_raised',raised,'target_amount',target,
    'remaining_amount',greatest(round(target-raised,2),0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.shared_cart_is_marketplace(jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shared_cart_is_marketplace(jsonb,text) TO service_role;


-- Keep the RPC's returned expiry in sync with the table's 30-day default.
CREATE OR REPLACE FUNCTION public.create_shared_cart(
  p_items jsonb,
  p_recipient jsonb,
  p_delivery jsonb,
  p_note text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text := left(trim(COALESCE(p_recipient->>'name','')),80);
  v_email text := lower(left(trim(COALESCE(p_recipient->>'email','')),120));
  v_phone text := regexp_replace(COALESCE(p_recipient->>'phone',''),'[^\d+]','','g');
  v_state text := left(trim(COALESCE(p_delivery->>'state','')),40);
  v_q jsonb;
  v_code text;
  v_note text;
  v_customer uuid;
BEGIN
  IF length(v_name)<2 THEN RAISE EXCEPTION 'Enter your full name' USING ERRCODE='22023'; END IF;
  IF v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN RAISE EXCEPTION 'Enter a valid email address' USING ERRCODE='22023'; END IF;
  IF v_phone !~ '^\+?\d{10,14}$' THEN RAISE EXCEPTION 'Enter a valid phone number' USING ERRCODE='22023'; END IF;
  IF length(trim(COALESCE(p_delivery->>'address','')))<5 OR trim(COALESCE(p_delivery->>'city',''))='' OR v_state='' THEN
    RAISE EXCEPTION 'Enter your full delivery address' USING ERRCODE='22023';
  END IF;
  v_note := public.clean_share_note(p_note);
  v_q := public.checkout_quote(p_items,v_state,'{}'::jsonb);
  IF NOT COALESCE((v_q->>'ok')::boolean,false) THEN
    RAISE EXCEPTION '%',COALESCE(v_q->'errors'->0->>'message','Some items can''t be ordered right now') USING ERRCODE='22023';
  END IF;
  IF (SELECT count(*) FROM public.shared_carts WHERE recipient_email=v_email AND created_at>now()-interval '1 day')>=20 THEN
    RAISE EXCEPTION 'Too many links today. Please try again tomorrow.' USING ERRCODE='22023';
  END IF;
  SELECT id INTO v_customer FROM public.customers WHERE id=auth.uid();
  v_code := upper(substr(translate(encode(extensions.gen_random_bytes(12),'base64'),'+/=0O1Il',''),1,10));
  INSERT INTO public.shared_carts(code,items,recipient_name,recipient_email,recipient_phone,delivery,note,created_by)
  VALUES(v_code,p_items,v_name,v_email,v_phone,
    jsonb_build_object('address',left(trim(p_delivery->>'address'),200),'city',left(trim(p_delivery->>'city'),60),
      'state',v_state,'landmark',left(trim(COALESCE(p_delivery->>'landmark','')),120)),
    v_note,v_customer);
  RETURN jsonb_build_object('code',v_code,'amount',v_q->'amount','expires_at',now()+interval '30 days');
END;
$$;


-- Lock down internal payment finalization/status RPCs. Payment status is exposed
-- to the browser through checkout-confirm, which verifies with the payment gateway.
REVOKE ALL ON FUNCTION public.create_shared_cart(jsonb,jsonb,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_shared_cart(jsonb,jsonb,jsonb,text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_shared_cart(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_cart(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_help_pay_public(text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_help_pay_public(text,boolean) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.checkout_session_status(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_session_status(text) TO service_role;

REVOKE ALL ON FUNCTION public.finalize_checkout_session_base(text,numeric,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_checkout_session_base(text,numeric,numeric,text) TO service_role;

REVOKE ALL ON FUNCTION public.finalize_checkout_session(text,numeric,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_checkout_session(text,numeric,numeric,text) TO service_role;

REVOKE ALL ON FUNCTION public.shared_cart_is_marketplace(jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shared_cart_is_marketplace(jsonb,text) TO service_role;

REVOKE ALL ON FUNCTION public.prepare_shared_cart_payment(text,text,numeric,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_shared_cart_payment(text,text,numeric,text,text) TO service_role;
