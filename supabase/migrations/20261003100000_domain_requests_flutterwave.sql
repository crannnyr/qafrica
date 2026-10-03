-- Custom domains: paid through Flutterwave, verified on the server, managed by admins through one RPC.
--
-- Before this, the dashboard inserted a domain_requests row marked payment_status='paid' straight from
-- the browser after the Paystack popup said "success". Nothing on the server checked the payment, so a
-- row could be marked paid without any money moving. The admin page also wrote statuses ('completed',
-- 'rejected') that the status CHECK constraint did not allow, so Approve, Reject and Revert always failed.
--
-- Lifecycle now:
--   awaiting_payment  row created by the flutterwave edge function, bank account issued
--   pending           payment confirmed with Flutterwave, waiting for an admin
--   processing        admin is setting the domain up
--   connected         live; stores.custom_domain + domain_status='connected'
--   rejected          admin declined (refund due if paid)
--   disconnected      admin removed a domain that had been connected
--   failed / cancelled  payment never completed

-- ── Columns ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.domain_requests
  ADD COLUMN IF NOT EXISTS payment_provider      text,
  ADD COLUMN IF NOT EXISTS provider_charge_id    text,
  ADD COLUMN IF NOT EXISTS provider_customer_id  text,
  ADD COLUMN IF NOT EXISTS paid_amount           numeric(12,2),
  ADD COLUMN IF NOT EXISTS payment_expires_at    timestamptz,
  ADD COLUMN IF NOT EXISTS payment_account       jsonb,
  ADD COLUMN IF NOT EXISTS raw_confirm           jsonb,
  ADD COLUMN IF NOT EXISTS payment_error         text,
  ADD COLUMN IF NOT EXISTS rejected_at           timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at           timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at            timestamptz DEFAULT now();

-- Rows from before this change were paid (if at all) through the Paystack popup, never verified.
UPDATE public.domain_requests SET payment_provider = 'paystack'
WHERE payment_provider IS NULL;

-- ── Status values ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.domain_requests DROP CONSTRAINT IF EXISTS domain_requests_status_check;
ALTER TABLE public.domain_requests ADD CONSTRAINT domain_requests_status_check CHECK (status IN (
  'awaiting_payment', 'pending', 'processing', 'purchased', 'connected',
  'rejected', 'disconnected', 'failed', 'cancelled'
));

ALTER TABLE public.domain_requests DROP CONSTRAINT IF EXISTS domain_requests_payment_status_check;
ALTER TABLE public.domain_requests ADD CONSTRAINT domain_requests_payment_status_check CHECK (payment_status IN (
  'pending', 'paid', 'review', 'failed', 'refunded'
));

CREATE UNIQUE INDEX IF NOT EXISTS domain_requests_payment_reference_key
  ON public.domain_requests (payment_reference) WHERE payment_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_domain_requests_customer
  ON public.domain_requests (provider_customer_id) WHERE provider_customer_id IS NOT NULL;

-- ── RLS: owners read their own; only the server (service role) creates rows ───────────
DROP POLICY IF EXISTS "Users can insert own domain requests" ON public.domain_requests;
DROP POLICY IF EXISTS "Store owners can manage their domain requests" ON public.domain_requests;
-- "Users can view own domain requests" (SELECT) and "Admins can manage all domain requests" stay.

-- ── Stores: owners can no longer set custom_domain themselves ─────────────────────────
CREATE OR REPLACE FUNCTION public.guard_store_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN RETURN NEW; END IF;
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
  OR NEW.marketplace_enabled IS DISTINCT FROM OLD.marketplace_enabled
  OR NEW.marketplace_agreed_at IS DISTINCT FROM OLD.marketplace_agreed_at THEN
    RAISE EXCEPTION 'Only QAFRICA admins can change this store setting' USING ERRCODE = '42501';
  END IF;
  -- Custom domains are set by the payment flow and by admins only
  IF NEW.custom_domain IS DISTINCT FROM OLD.custom_domain
  OR NEW.domain_paid_amount IS DISTINCT FROM OLD.domain_paid_amount THEN
    RAISE EXCEPTION 'Custom domains are managed from the Domain page' USING ERRCODE = '42501';
  END IF;
  IF NEW.domain_status IS DISTINCT FROM OLD.domain_status AND NEW.domain_status NOT IN ('none', 'pending') THEN
    RAISE EXCEPTION 'Only QAFRICA admins can approve a custom domain' USING ERRCODE = '42501';
  END IF;
  IF NEW.is_active AND NOT COALESCE(OLD.is_active, false) THEN
    IF NEW.is_blocked THEN RAISE EXCEPTION 'This store is blocked. Contact QAFRICA support.' USING ERRCODE = '42501'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.store_id = NEW.id AND s.is_active AND (s.expires_at IS NULL OR s.expires_at > now())) THEN
      RAISE EXCEPTION 'Your store needs an active subscription to go live' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── Admin actions: one transaction for the request and the store ──────────────────────
-- p_action: 'processing' | 'connect' | 'reject' | 'disconnect' | 'mark_refunded' | 'note'
CREATE OR REPLACE FUNCTION public.admin_domain_request_action(p_request_id uuid, p_action text, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r   public.domain_requests%ROWTYPE;
  s   public.stores%ROWTYPE;
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO r FROM public.domain_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Domain request not found'; END IF;
  SELECT * INTO s FROM public.stores WHERE id = r.store_id FOR UPDATE;

  IF p_action = 'note' THEN
    UPDATE public.domain_requests SET admin_notes = v_note, updated_at = now() WHERE id = r.id;

  ELSIF p_action = 'processing' THEN
    IF r.status <> 'pending' THEN RAISE EXCEPTION 'Only a paid request waiting for review can move to processing'; END IF;
    UPDATE public.domain_requests
      SET status = 'processing', admin_notes = COALESCE(v_note, admin_notes), updated_at = now()
      WHERE id = r.id;
    UPDATE public.stores SET custom_domain = r.domain_name, domain_status = 'processing' WHERE id = r.store_id;

  ELSIF p_action = 'connect' THEN
    IF r.status NOT IN ('pending', 'processing') THEN RAISE EXCEPTION 'This request cannot be connected from status %', r.status; END IF;
    IF EXISTS (SELECT 1 FROM public.stores o WHERE o.id <> r.store_id
               AND lower(o.custom_domain) = lower(r.domain_name) AND o.domain_status = 'connected') THEN
      RAISE EXCEPTION '% is already connected to another store', r.domain_name;
    END IF;
    UPDATE public.domain_requests
      SET status = 'connected', admin_approved = true, approved_at = now(), approved_by = auth.uid(),
          completed_at = now(), admin_notes = COALESCE(v_note, admin_notes), updated_at = now()
      WHERE id = r.id;
    UPDATE public.stores SET custom_domain = r.domain_name, domain_status = 'connected' WHERE id = r.store_id;

  ELSIF p_action = 'reject' THEN
    IF r.status NOT IN ('awaiting_payment', 'pending', 'processing') THEN RAISE EXCEPTION 'This request cannot be rejected from status %', r.status; END IF;
    UPDATE public.domain_requests
      SET status = 'rejected', admin_approved = false, rejected_at = now(),
          admin_notes = COALESCE(v_note, admin_notes), updated_at = now()
      WHERE id = r.id;
    -- Clear the store only if it still points at this request's domain and it isn't live
    IF lower(COALESCE(s.custom_domain, '')) = lower(r.domain_name) AND s.domain_status <> 'connected' THEN
      UPDATE public.stores SET custom_domain = NULL, domain_status = 'none' WHERE id = r.store_id;
    END IF;

  ELSIF p_action = 'disconnect' THEN
    IF r.status <> 'connected' THEN RAISE EXCEPTION 'Only a connected domain can be disconnected'; END IF;
    UPDATE public.domain_requests
      SET status = 'disconnected', admin_notes = COALESCE(v_note, admin_notes), updated_at = now()
      WHERE id = r.id;
    IF lower(COALESCE(s.custom_domain, '')) = lower(r.domain_name) THEN
      UPDATE public.stores SET custom_domain = NULL, domain_status = 'none' WHERE id = r.store_id;
    END IF;

  ELSIF p_action = 'mark_refunded' THEN
    IF r.payment_status NOT IN ('paid', 'review') THEN RAISE EXCEPTION 'Only a paid request can be marked refunded'; END IF;
    IF r.status NOT IN ('rejected', 'disconnected', 'failed', 'cancelled') THEN
      RAISE EXCEPTION 'Reject the request before marking it refunded';
    END IF;
    UPDATE public.domain_requests
      SET payment_status = 'refunded', refunded_at = now(), admin_notes = COALESCE(v_note, admin_notes), updated_at = now()
      WHERE id = r.id;

  ELSE
    RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;

  SELECT * INTO r FROM public.domain_requests WHERE id = p_request_id;
  RETURN to_jsonb(r);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_domain_request_action(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_domain_request_action(uuid, text, text) TO authenticated;
