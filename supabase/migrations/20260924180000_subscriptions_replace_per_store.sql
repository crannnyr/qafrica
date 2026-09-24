-- Applied live via apply_migration on 2026-09-24 (name: subscriptions_replace_per_store).
-- A new plan now replaces older plans for the SAME store (or store-less plans) instead of every
-- plan on the account. Multi-store accounts could previously only keep one store covered.
-- Verified (rolled back): multi-store account keeps other stores' plans; single-store account
-- still ends up with exactly one active plan.
CREATE OR REPLACE FUNCTION public.deactivate_old_subscriptions()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.subscriptions
  SET is_active = false, updated_at = NOW()
  WHERE user_id = NEW.user_id
    AND id != NEW.id
    AND is_active = true
    AND (store_id IS NOT DISTINCT FROM NEW.store_id OR store_id IS NULL OR NEW.store_id IS NULL);
  RETURN NEW;
END;
$$;
