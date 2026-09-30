-- Bug fix (found while building card auto-renewal): expire_overdue_subscriptions() deactivated
-- a store the moment an OLD subscription row crossed its expires_at, even when a renewal
-- (manual or auto) had already created a fresh row for the same store with a later expiry.
-- Renewals never flip the old row inactive early (by design — running plans are computed by
-- querying, not by a single row's flag), so the old row's own expiry would always eventually
-- fire and silently undo a renewal that had already happened. Now it only deactivates the
-- store when no other active, unexpired subscription row still covers it.
CREATE OR REPLACE FUNCTION public.expire_overdue_subscriptions()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_sub record;
  v_expired_count int := 0;
  v_still_covered boolean;
BEGIN
  FOR v_sub IN
    SELECT s.id, s.store_id, s.user_id, s.tier, s.is_trial,
           (SELECT name FROM public.stores st WHERE st.id = s.store_id) as store_name
    FROM public.subscriptions s
    WHERE s.is_active = true
      AND s.expires_at IS NOT NULL
      AND s.expires_at < now()
      AND s.cancel_at_period_end IS NOT TRUE
  LOOP
    UPDATE public.subscriptions
    SET is_active = false, updated_at = now()
    WHERE id = v_sub.id;

    v_still_covered := false;
    IF v_sub.store_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.subscriptions s2
        WHERE s2.store_id = v_sub.store_id AND s2.id <> v_sub.id
          AND s2.is_active = true AND s2.is_trial = false
          AND s2.expires_at > now()
      ) INTO v_still_covered;
    END IF;

    IF v_sub.store_id IS NOT NULL AND NOT v_still_covered THEN
      UPDATE public.stores
      SET is_active = false,
          deactivation_reason = CASE WHEN v_sub.is_trial THEN 'trial_expired' ELSE 'subscription_expired' END,
          updated_at = now()
      WHERE id = v_sub.store_id;
    END IF;

    INSERT INTO public.system_failure_logs (failure_type, entity_type, entity_id, affected_user_id, error_message, metadata)
    VALUES (
      'subscription_expired', 'subscription', v_sub.id::text, v_sub.user_id,
      format('Subscription tier=%s expired and was deactivated (store: %s)%s', v_sub.tier, COALESCE(v_sub.store_name, 'none'),
             CASE WHEN v_still_covered THEN ' — store left active, a newer subscription still covers it' ELSE '' END),
      jsonb_build_object('store_id', v_sub.store_id, 'tier', v_sub.tier, 'was_trial', v_sub.is_trial, 'still_covered', v_still_covered)
    );

    v_expired_count := v_expired_count + 1;
  END LOOP;

  IF v_expired_count > 0 THEN
    RAISE NOTICE 'expire_overdue_subscriptions: deactivated % subscription(s)', v_expired_count;
  END IF;
END;
$function$;
