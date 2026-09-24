-- Applied live via apply_migration on 2026-09-24 (name: guard_store_protected_columns).
-- Verified with rolled-back tests: owner/admin/subscription-trigger paths (12 scenarios).
-- Store owners (and staff) could previously change ANY column on their own store row via the
-- "Owners can update own store" policy, including is_blocked / is_verified / owner_id.
-- This trigger limits what non-admin browser sessions can change. Admins, the service role
-- (edge functions) and SECURITY DEFINER functions (e.g. activate_store_on_subscription) are
-- unaffected because they don't run as the `authenticated` / `anon` roles or pass is_admin().
CREATE OR REPLACE FUNCTION public.guard_store_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Trusted callers: service role, postgres, security-definer functions, admins
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.is_blocked IS DISTINCT FROM OLD.is_blocked
     OR NEW.block_reason IS DISTINCT FROM OLD.block_reason
     OR NEW.is_developer_shadow IS DISTINCT FROM OLD.is_developer_shadow
     OR NEW.deactivation_reason IS DISTINCT FROM OLD.deactivation_reason
     OR NEW.location_flagged IS DISTINCT FROM OLD.location_flagged
     OR NEW.location_flagged_reason IS DISTINCT FROM OLD.location_flagged_reason
     OR NEW.is_hidden IS DISTINCT FROM OLD.is_hidden
     OR NEW.is_primary IS DISTINCT FROM OLD.is_primary
  THEN
    RAISE EXCEPTION 'Only QAFRICA admins can change this store setting'
      USING ERRCODE = '42501';
  END IF;

  -- Owners may request a domain (pending) or clear it (none); approval is admin-only
  IF NEW.domain_status IS DISTINCT FROM OLD.domain_status
     AND NEW.domain_status NOT IN ('none', 'pending') THEN
    RAISE EXCEPTION 'Only QAFRICA admins can approve a custom domain'
      USING ERRCODE = '42501';
  END IF;

  -- Owners may switch their store off, but switching it on needs an unblocked store
  -- with an active, unexpired subscription.
  IF NEW.is_active AND NOT COALESCE(OLD.is_active, false) THEN
    IF NEW.is_blocked THEN
      RAISE EXCEPTION 'This store is blocked. Contact QAFRICA support.'
        USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.store_id = NEW.id
        AND s.is_active
        AND (s.expires_at IS NULL OR s.expires_at > now())
    ) THEN
      RAISE EXCEPTION 'Your store needs an active subscription to go live'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_store_protected_columns ON public.stores;
CREATE TRIGGER trg_guard_store_protected_columns
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.guard_store_protected_columns();
