-- Applied live 2026-09-25 (name: order_issue_resolution_and_refunds). Verified (rolled back): full refund reverses
-- seller+commission, fee booked as platform cost, repeat-safe; partial refund then release pays seller the rest;
-- non-admin cannot resolve.
-- Admin resolution of reported problems: release to seller, or refund the customer via Nomba.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS issue_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS issue_resolution text CHECK (issue_resolution IN ('released', 'refunded', 'partially_refunded')),
  ADD COLUMN IF NOT EXISTS issue_resolution_note text;

-- One row per refund attempt (idempotency + audit)
CREATE TABLE IF NOT EXISTS public.order_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  amount numeric NOT NULL CHECK (amount > 0),
  account_number text NOT NULL,
  bank_code text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  provider_response jsonb,
  admin_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS order_refunds_one_pending ON public.order_refunds (order_id) WHERE status = 'pending';
ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read refunds" ON public.order_refunds FOR SELECT TO authenticated USING (public.is_admin());

-- Admin: problem resolved in the seller's favour -> release escrow
CREATE OR REPLACE FUNCTION public.admin_resolve_issue_release(p_order_id uuid, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501'; END IF;
  UPDATE orders SET buyer_reported_issue = false, issue_resolved_at = now(), issue_resolution = 'released',
                    issue_resolution_note = left(trim(COALESCE(p_note, '')), 1000), updated_at = now()
  WHERE id = p_order_id AND NOT COALESCE(is_escrow_released, false);
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found or already released' USING ERRCODE = '22023'; END IF;
  PERFORM release_escrow_funds_internal(p_order_id);
END $$;
REVOKE ALL ON FUNCTION public.admin_resolve_issue_release(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_issue_release(uuid, text) TO authenticated;

-- Ledger side of a refund. Called ONLY by the admin-refund edge function after Nomba confirms.
-- Takes the refund out of held (escrow) money: store owner first, then suppliers, then platform
-- commission. Whatever can't be covered (Nomba's fee isn't returned) is booked as a platform cost.
CREATE OR REPLACE FUNCTION public.refund_order_escrow(p_refund_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rf order_refunds%ROWTYPE; o orders%ROWTYPE; v_owner uuid; v_platform uuid;
  v_left numeric; v_take numeric; w record; v_wallet uuid; v_after numeric; v_total_refunded numeric;
BEGIN
  SELECT * INTO rf FROM order_refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund not found'; END IF;
  IF rf.status = 'succeeded' THEN RETURN jsonb_build_object('already', true); END IF;
  SELECT * INTO o FROM orders WHERE id = rf.order_id FOR UPDATE;
  IF COALESCE(o.is_escrow_released, false) THEN RAISE EXCEPTION 'payment already released; refund must come from the seller'; END IF;
  SELECT owner_id INTO v_owner FROM stores WHERE id = o.store_id;
  SELECT (value->>'user_id')::uuid INTO v_platform FROM platform_settings WHERE key = 'platform_wallet_user_id';

  v_left := rf.amount;
  FOR w IN
    SELECT t.user_id, SUM(t.amount) AS held,
           CASE WHEN t.user_id = v_owner THEN 1 WHEN t.user_id = v_platform THEN 3 ELSE 2 END AS prio
    FROM wallet_transactions t
    WHERE t.reference = o.payment_reference AND t.status = 'escrow' AND (t.metadata->>'order_id')::uuid = o.id
    GROUP BY t.user_id HAVING SUM(t.amount) > 0
    ORDER BY 3
  LOOP
    EXIT WHEN v_left <= 0;
    v_take := LEAST(v_left, w.held);
    UPDATE wallets SET escrow_balance = GREATEST(0, escrow_balance - v_take), updated_at = now()
      WHERE user_id = w.user_id RETURNING id, escrow_balance INTO v_wallet, v_after;
    INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, balance_after, description, reference, status, metadata)
    VALUES (v_wallet, w.user_id, 'debit', -v_take, (SELECT balance FROM wallets WHERE id = v_wallet),
            format('Refund to customer (order #%s)', o.order_number), o.payment_reference, 'escrow',
            jsonb_build_object('order_id', o.id, 'refund_id', rf.id, 'escrow_balance_after', v_after));
    v_left := v_left - v_take;
  END LOOP;

  IF v_left > 0 THEN
    UPDATE wallets SET balance = balance - v_left, updated_at = now() WHERE user_id = v_platform RETURNING id INTO v_wallet;
    INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, balance_after, description, reference, status, metadata)
    VALUES (v_wallet, v_platform, 'debit', -v_left, (SELECT balance FROM wallets WHERE id = v_wallet),
            format('Refund cost not covered by held funds, e.g. payment fee (order #%s)', o.order_number),
            o.payment_reference, 'completed', jsonb_build_object('order_id', o.id, 'refund_id', rf.id, 'platform_cost', true));
  END IF;

  v_total_refunded := COALESCE(o.refund_amount, 0) + rf.amount;
  UPDATE orders SET refund_amount = v_total_refunded,
    status = CASE WHEN v_total_refunded >= o.total THEN 'refunded' ELSE status END,
    buyer_reported_issue = false, issue_resolved_at = now(),
    issue_resolution = CASE WHEN v_total_refunded >= o.total THEN 'refunded' ELSE 'partially_refunded' END,
    issue_resolution_note = rf.note, updated_at = now()
  WHERE id = o.id;
  UPDATE order_refunds SET status = 'succeeded', completed_at = now() WHERE id = rf.id;
  RETURN jsonb_build_object('refunded', rf.amount, 'platform_cost', GREATEST(v_left, 0));
END $$;
REVOKE ALL ON FUNCTION public.refund_order_escrow(uuid) FROM public, anon, authenticated;
