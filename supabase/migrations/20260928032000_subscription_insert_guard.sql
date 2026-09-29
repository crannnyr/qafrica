-- APPLY TOGETHER WITH THE FRONTEND THAT CALLS activate-subscription.
-- Paid subscriptions are created only by server code (activate-subscription edge function,
-- payment webhooks, admins). A signed-in user may at most create a free trial row.
CREATE OR REPLACE FUNCTION public.guard_subscription_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.tier IS DISTINCT FROM 'free' OR COALESCE(NEW.amount_paid, 0) <> 0 OR NEW.is_trial IS NOT TRUE
     OR NEW.expires_at > now() + interval '14 days' THEN
    RAISE EXCEPTION 'Paid plans are activated after payment is confirmed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_subscription_insert ON public.subscriptions;
CREATE TRIGGER trg_guard_subscription_insert
  BEFORE INSERT ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.guard_subscription_insert();

-- One subscription per payment from now on (older duplicates came from webhook + callback both inserting).
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_payment_reference_unique_new
  ON public.subscriptions (payment_reference)
  WHERE payment_reference IS NOT NULL AND payment_reference <> 'FREE_PLAN_DIRECT' AND created_at >= '2026-09-28';
