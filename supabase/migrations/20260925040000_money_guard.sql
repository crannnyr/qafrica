-- Applied live 2026-09-25 (name: money_guard_wallets_escrow_release). Verified (rolled back, 9 checks): seller can't
-- release own escrow or edit balance/escrow; bank name still editable; same-email stranger blocked; customer can't
-- confirm before dispatch, can after (releases); issue report freezes release; trusted/cron release works.
-- Audit after applying: 0 wallets with balance exceeding earnings or without transactions.
-- SECURITY: money could be changed from the browser.
-- 1) "Users can update own wallet" let any signed-in user set their own balance/escrow/earnings.
-- 2) release_escrow_funds() had no caller check (anyone could release any order's escrow early).
-- 3) Shoppers had no way to report a problem or confirm receipt (no customer UPDATE rights on orders).

-- 1) Wallet money columns are server-only. Bank details / OTP fields stay editable by the owner.
CREATE OR REPLACE FUNCTION public.guard_wallet_money()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.balance, 0) <> 0 OR COALESCE(NEW.total_earned, 0) <> 0 OR COALESCE(NEW.total_withdrawn, 0) <> 0
       OR COALESCE(NEW.pending_balance, 0) <> 0 OR COALESCE(NEW.escrow_balance, 0) <> 0 THEN
      RAISE EXCEPTION 'New wallets must start at zero' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.balance IS DISTINCT FROM OLD.balance
     OR NEW.total_earned IS DISTINCT FROM OLD.total_earned
     OR NEW.total_withdrawn IS DISTINCT FROM OLD.total_withdrawn
     OR NEW.pending_balance IS DISTINCT FROM OLD.pending_balance
     OR NEW.escrow_balance IS DISTINCT FROM OLD.escrow_balance
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Wallet balances can only be changed by QAFRICA' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_wallet_money ON public.wallets;
CREATE TRIGGER trg_guard_wallet_money BEFORE INSERT OR UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.guard_wallet_money();

-- 2) Escrow release: the original logic becomes internal; the public name checks who is asking.
ALTER FUNCTION public.release_escrow_funds(uuid) RENAME TO release_escrow_funds_internal;
REVOKE ALL ON FUNCTION public.release_escrow_funds_internal(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.release_escrow_funds(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE;
BEGIN
  -- Trusted callers (cron auto-release, edge functions, admins) keep the old behaviour
  -- NB: inside SECURITY DEFINER, current_user is the owner; the caller's role is in the 'role' setting
  IF COALESCE(current_setting('role', true), 'none') NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    PERFORM release_escrow_funds_internal(p_order_id);
    RETURN;
  END IF;

  -- Everyone else: only the shopper who placed the order, confirming they received it
  SELECT * INTO o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = '42501'; END IF;
  -- Account ownership only: sign-up emails are not verified, so an email match is not proof
  IF o.customer_id IS NULL OR o.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the customer who placed this order can confirm receipt' USING ERRCODE = '42501';
  END IF;
  IF o.payment_status <> 'paid' THEN RAISE EXCEPTION 'This order has not been paid' USING ERRCODE = '42501'; END IF;
  IF COALESCE(o.buyer_reported_issue, false) THEN
    RAISE EXCEPTION 'You reported a problem with this order. QAFRICA will resolve it before releasing payment.' USING ERRCODE = '42501';
  END IF;
  IF o.status NOT IN ('shipped', 'out_for_delivery', 'delivered') THEN
    RAISE EXCEPTION 'You can confirm receipt once the seller has sent your order' USING ERRCODE = '42501';
  END IF;

  UPDATE orders SET status = 'delivered', delivered_at = COALESCE(delivered_at, now()),
                    delivery_confirmed_at = now(), updated_at = now()
  WHERE id = p_order_id;
  PERFORM release_escrow_funds_internal(p_order_id);
END $$;
REVOKE ALL ON FUNCTION public.release_escrow_funds(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.release_escrow_funds(uuid) TO authenticated;

-- 3) Shoppers report a problem (freezes the escrow until an admin resolves it)
CREATE OR REPLACE FUNCTION public.report_order_issue(p_order_id uuid, p_description text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE; v_owner uuid; v_desc text := left(trim(COALESCE(p_description, '')), 1000);
BEGIN
  IF length(v_desc) < 10 THEN RAISE EXCEPTION 'Please describe the problem in a few words' USING ERRCODE = '22023'; END IF;
  SELECT * INTO o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR o.customer_id IS NULL OR o.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(o.is_escrow_released, false) THEN
    RAISE EXCEPTION 'Payment for this order was already released. Please contact support.' USING ERRCODE = '22023';
  END IF;
  UPDATE orders SET buyer_reported_issue = true, issue_description = v_desc, issue_reported_at = now(), updated_at = now()
  WHERE id = p_order_id;
  SELECT owner_id INTO v_owner FROM stores WHERE id = o.store_id;
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (v_owner, 'order_issue', 'Customer reported a problem',
          format('Order #%s: "%s". Payment is on hold until QAFRICA resolves this.', o.order_number, left(v_desc, 140)),
          jsonb_build_object('order_id', o.id, 'order_number', o.order_number));
END $$;
REVOKE ALL ON FUNCTION public.report_order_issue(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.report_order_issue(uuid, text) TO authenticated;
