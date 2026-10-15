-- Help Pay: reconcile in-flight payments after link expiry and re-quote before funding completion.
-- This migration intentionally changes only the contribution finalizer. It does not
-- extend expired links or permit new payment attempts against them.
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
  current_quote jsonb;
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
  -- A payment initiated before expiry may finish after expiry. New attempts remain
  -- blocked by checkout-create and prepare_shared_cart_payment.
  IF NOT FOUND OR cart_row.status <> 'active'
     OR (cart_row.expires_at <= now() AND cs.created_at > cart_row.expires_at) THEN
    UPDATE public.shared_cart_contributions SET status='failed'
    WHERE id=contribution.id AND status='pending';
    UPDATE public.checkout_sessions SET status='fulfilment_error', error='Shared cart is no longer active',
      paid_amount=p_paid_amount, gateway_fee=p_gateway_fee, nomba_transaction_id=p_transaction_id, updated_at=now()
    WHERE id=cs.id;
    RETURN jsonb_build_object('status','fulfilment_error','detail','Shared cart is no longer active');
  END IF;

  -- Reprice from the current server-side catalog before deciding whether the cart
  -- is funded. If it changed, use this same quote for order creation.
  current_quote := public.checkout_quote(cart_row.items, cart_row.delivery->>'state', '{}'::jsonb);
  IF COALESCE((current_quote->>'ok')::boolean, false) IS NOT TRUE THEN
    UPDATE public.shared_cart_contributions SET status='paid', paid_at=COALESCE(paid_at,now()), gateway_fee=COALESCE(p_gateway_fee,0)
    WHERE id=contribution.id AND status='pending';
    UPDATE public.checkout_sessions SET status='paid', paid_amount=p_paid_amount, gateway_fee=p_gateway_fee,
      nomba_transaction_id=p_transaction_id, paid_at=now(), updated_at=now()
    WHERE id=cs.id;
    RETURN jsonb_build_object('status','paid','order_ids','[]'::jsonb,'already',false,
      'contribution_complete',false,'needs_cart_update',true,
      'detail','Payment received, but cart items need attention before an order can be created.');
  END IF;

  target := round((current_quote->>'amount')::numeric, 2);

  UPDATE public.shared_cart_contributions SET status='paid', paid_at=COALESCE(paid_at,now()), gateway_fee=COALESCE(p_gateway_fee,0)
  WHERE id=contribution.id AND status='pending';

  SELECT COALESCE(sum(amount),0) INTO raised
  FROM public.shared_cart_contributions
  WHERE shared_cart_id=cart_row.id AND status='paid';
  SELECT COALESCE(sum(gateway_fee),0) INTO total_gateway_fee
  FROM public.shared_cart_contributions WHERE shared_cart_id=cart_row.id AND status='paid';

  -- Keep the latest paid session's order quote aligned to the current prices.
  UPDATE public.checkout_sessions
  SET store_orders=current_quote->'stores', amount=target
  WHERE id=cs.id;

  IF raised + 0.01 < target THEN
    UPDATE public.checkout_sessions SET status='paid', amount=contribution.amount, paid_amount=p_paid_amount,
      gateway_fee=p_gateway_fee, nomba_transaction_id=p_transaction_id, paid_at=now(), updated_at=now()
    WHERE id=cs.id;
    RETURN jsonb_build_object('status','paid','order_ids','[]'::jsonb,'already',false,
      'contribution_complete',false,'amount_raised',raised,'target_amount',target,
      'contribution_amount',contribution.amount);
  END IF;

  -- The final paid contribution triggers order creation using the freshly quoted cart.
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
