-- SECURITY: signed-in users could edit protected columns on their own profile row,
-- including `role` (is_admin() reads it), email_verified, wallet_balance and block flags.
-- Same pattern as guard_store_protected_columns: only admins and trusted server code
-- (service role, security-definer functions) may change these.
CREATE OR REPLACE FUNCTION public.guard_profile_protected_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A user creating their own profile can only be a store owner or developer, unverified, with no money.
    IF COALESCE(NEW.role, 'store_owner') NOT IN ('store_owner', 'developer') THEN
      RAISE EXCEPTION 'Not allowed to set this role' USING ERRCODE = '42501';
    END IF;
    NEW.email_verified   := false;
    NEW.wallet_balance   := 0;
    NEW.total_earnings   := 0;
    NEW.is_store_blocked := false;
    NEW.block_reason     := NULL;
    RETURN NEW;
  END IF;

  IF NEW.role             IS DISTINCT FROM OLD.role
  OR NEW.email_verified   IS DISTINCT FROM OLD.email_verified
  OR NEW.wallet_balance   IS DISTINCT FROM OLD.wallet_balance
  OR NEW.total_earnings   IS DISTINCT FROM OLD.total_earnings
  OR NEW.is_store_blocked IS DISTINCT FROM OLD.is_store_blocked
  OR NEW.block_reason     IS DISTINCT FROM OLD.block_reason
  OR NEW.id               IS DISTINCT FROM OLD.id
  OR NEW.created_at       IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only QAFRICA admins can change this account setting' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_protected_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_protected_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_protected_columns();
