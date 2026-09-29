-- SECURITY: 81 SECURITY DEFINER functions were callable by anyone (anon + authenticated) through
-- /rest/v1/rpc. Many move money or act as an admin and trusted an "admin id" argument instead of
-- checking the caller. This adds a caller check at the start of each risky function:
--   * admin/server functions: only admins, the service role (edge functions) or direct DB jobs
--   * owner functions: only the owner (or staff for store data), admins or the service role
-- Function bodies are otherwise unchanged (the check is inserted right after BEGIN).

CREATE OR REPLACE FUNCTION public.is_admin_or_service()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT coalesce(auth.role(), '') = 'service_role'
      OR session_user <> 'authenticator'       -- cron / direct database jobs
      OR public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.assert_admin_or_service()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  IF NOT public.is_admin_or_service() THEN
    RAISE EXCEPTION 'Only QAFRICA admins can do this' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_self_or_admin(p_user uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  IF public.is_admin_or_service() THEN RETURN; END IF;
  IF auth.uid() IS NULL OR p_user IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_store_access(p_store uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  IF public.is_admin_or_service() THEN RETURN; END IF;
  IF auth.uid() IS NOT NULL AND (
       EXISTS (SELECT 1 FROM stores WHERE id = p_store AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM store_staff WHERE store_id = p_store AND staff_user_id = auth.uid())
  ) THEN RETURN; END IF;
  RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
END;
$$;

-- Insert a guard statement right after the (single) BEGIN of each function.
DO $$
DECLARE
  r record;
  def text;
  guarded text;
  targets jsonb := '{
    "admin_process_refund":"PERFORM public.assert_admin_or_service();",
    "admin_release_escrow":"PERFORM public.assert_admin_or_service();",
    "mark_jumia_withdrawal_paid":"PERFORM public.assert_admin_or_service();",
    "reject_jumia_withdrawal":"PERFORM public.assert_admin_or_service();",
    "mark_jumia_dropoff_missed":"PERFORM public.assert_admin_or_service();",
    "record_jumia_sale":"PERFORM public.assert_admin_or_service();",
    "get_admin_dashboard_stats":"PERFORM public.assert_admin_or_service();",
    "get_developer_stats":"PERFORM public.assert_admin_or_service();",
    "activate_developer_plan":"PERFORM public.assert_admin_or_service();",
    "credit_developer_wallet":"PERFORM public.assert_admin_or_service();",
    "debit_developer_wallet":"PERFORM public.assert_admin_or_service();",
    "record_product_earnings":"PERFORM public.assert_admin_or_service();",
    "increment_dev_rate_limit":"PERFORM public.assert_admin_or_service();",
    "log_abandoned_payments":"PERFORM public.assert_admin_or_service();",
    "check_stock_levels":"PERFORM public.assert_admin_or_service();",
    "purge_old_developer_logs":"PERFORM public.assert_admin_or_service();",
    "ship_batch_customers":"PERFORM public.assert_admin_or_service();",
    "cancel_batch_customer_bill":"PERFORM public.assert_admin_or_service();",
    "close_batch_billing":"PERFORM public.assert_admin_or_service();",
    "mark_batch_customers_received":"PERFORM public.assert_admin_or_service();",
    "create_china_import_shipment":"PERFORM public.assert_admin_or_service();",
    "update_china_import_shipment_status":"PERFORM public.assert_admin_or_service();",
    "receive_china_import_fulfillment_item":"PERFORM public.assert_admin_or_service();",
    "confirm_cod_payment":"PERFORM public.assert_self_or_admin(p_store_owner_id);",
    "get_stock_alerts":"PERFORM public.assert_self_or_admin(p_owner_id);",
    "calculate_tax_for_period":"PERFORM public.assert_store_access(p_store_id);",
    "get_expense_categories_summary":"PERFORM public.assert_store_access(p_store_id);",
    "get_product_earnings_summary":"PERFORM public.assert_store_access(p_store_id);",
    "accept_staff_invitation":"IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin_or_service() THEN RAISE EXCEPTION ''Not allowed'' USING ERRCODE = ''42501''; END IF;"
  }';
BEGIN
  FOR r IN
    SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (SELECT jsonb_object_keys(targets))
  LOOP
    def := pg_get_functiondef(r.oid);
    IF position('/*qafrica-guard*/' in def) > 0 THEN CONTINUE; END IF;   -- already guarded
    IF (SELECT count(*) FROM regexp_matches(def, '\mBEGIN\M', 'gi')) <> 1 THEN
      RAISE EXCEPTION 'Unexpected body shape in %', r.proname;
    END IF;
    guarded := regexp_replace(def, '\m(BEGIN)\M', '\1 /*qafrica-guard*/ ' || (targets->>r.proname), 'i');
    EXECUTE guarded;
  END LOOP;
END;
$$;

-- The two withdrawal functions already required a signed-in admin, which blocked the
-- admin-withdrawal-action edge function (it calls with the service role). Allow both.
DO $$
DECLARE r record; def text;
BEGIN
  FOR r IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname IN ('mark_withdrawal_paid', 'reject_withdrawal') LOOP
    def := pg_get_functiondef(r.oid);
    def := replace(def,
      'IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ''admin'') THEN',
      'IF NOT public.is_admin_or_service() THEN');
    EXECUTE def;
  END LOOP;
END;
$$;

-- SQL-language function used only by edge functions.
REVOKE EXECUTE ON FUNCTION public.increment_units_sold(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_units_sold(uuid, integer) TO service_role;

-- Helpers are for use inside other functions only.
REVOKE EXECUTE ON FUNCTION public.assert_admin_or_service() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assert_self_or_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assert_store_access(uuid) FROM PUBLIC, anon;

-- ── Subscriptions: owners may only change their renewal preferences ──────────────
CREATE OR REPLACE FUNCTION public.guard_subscription_owner_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - ARRAY['auto_renew','auto_renew_method','cancel_at_period_end','updated_at'])
     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['auto_renew','auto_renew_method','cancel_at_period_end','updated_at']) THEN
    RAISE EXCEPTION 'Only renewal settings can be changed here' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_subscription_owner_changes ON public.subscriptions;
CREATE TRIGGER trg_guard_subscription_owner_changes
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.guard_subscription_owner_changes();
