-- Marketplace becomes opt-in. Stores choose to list on /stores; the marketplace seller rules
-- (48-hour ready-to-ship, strikes, 5% late-cancel penalty) apply only while it is on.
-- Owners switch it via set_marketplace_enabled(), which checks the requirements server-side.

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS marketplace_enabled   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketplace_agreed_at timestamptz;

-- Stores listed today stay listed (they are emailed the new rules with 7 days' notice).
UPDATE public.stores SET marketplace_enabled = true
WHERE id IN (SELECT public.marketplace_store_ids()) AND NOT marketplace_enabled;

-- Listing now also requires the switch.
CREATE OR REPLACE FUNCTION public.marketplace_store_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.id FROM stores s
  WHERE s.marketplace_enabled
    AND s.is_active AND NOT COALESCE(s.is_blocked, false) AND NOT COALESCE(s.is_developer_shadow, false)
    AND NOT COALESCE(s.is_hidden, false) AND s.logo_url IS NOT NULL
    AND EXISTS (SELECT 1 FROM subscriptions x WHERE x.user_id = s.owner_id AND x.is_active AND x.tier <> 'free'
                AND (x.expires_at IS NULL OR x.expires_at > now()))
    AND (SELECT count(*) FROM products p WHERE p.store_id = s.id AND p.is_active) >= 5;
$$;

-- What a store still needs before it can switch on (for the dashboard checklist).
CREATE OR REPLACE FUNCTION public.marketplace_readiness(p_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s stores%ROWTYPE; v_products int; v_paid boolean; v_email boolean;
BEGIN
  SELECT * INTO s FROM stores WHERE id = p_store_id;
  IF NOT FOUND OR (s.owner_id <> auth.uid() AND NOT is_admin()) THEN
    RAISE EXCEPTION 'Not your store' USING ERRCODE = '42501';
  END IF;
  SELECT count(*) INTO v_products FROM products WHERE store_id = s.id AND is_active;
  SELECT EXISTS (SELECT 1 FROM subscriptions x WHERE x.user_id = s.owner_id AND x.is_active AND x.tier <> 'free'
                 AND (x.expires_at IS NULL OR x.expires_at > now())) INTO v_paid;
  SELECT COALESCE(email_verified, false) INTO v_email FROM profiles WHERE id = s.owner_id;
  RETURN jsonb_build_object(
    'enabled', s.marketplace_enabled,
    'agreed_at', s.marketplace_agreed_at,
    'checks', jsonb_build_array(
      jsonb_build_object('key', 'paid_plan',      'ok', v_paid),
      jsonb_build_object('key', 'email_verified', 'ok', v_email),
      jsonb_build_object('key', 'logo',           'ok', s.logo_url IS NOT NULL),
      jsonb_build_object('key', 'products',       'ok', v_products >= 5, 'have', v_products, 'need', 5),
      jsonb_build_object('key', 'not_blocked',    'ok', NOT COALESCE(s.is_blocked, false))
    )
  );
END;
$$;

-- Switch on (requirements + agreement) or off (always allowed).
CREATE OR REPLACE FUNCTION public.set_marketplace_enabled(p_store_id uuid, p_enabled boolean, p_agree boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r jsonb; v_missing jsonb;
BEGIN
  r := public.marketplace_readiness(p_store_id);  -- also checks ownership
  IF p_enabled THEN
    SELECT COALESCE(jsonb_agg(c->>'key'), '[]'::jsonb) INTO v_missing
    FROM jsonb_array_elements(r->'checks') c WHERE NOT (c->>'ok')::boolean;
    IF jsonb_array_length(v_missing) > 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_ready', 'missing', v_missing);
    END IF;
    IF NOT p_agree THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'must_agree');
    END IF;
    UPDATE stores SET marketplace_enabled = true, marketplace_agreed_at = now() WHERE id = p_store_id;
  ELSE
    UPDATE stores SET marketplace_enabled = false WHERE id = p_store_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'enabled', p_enabled);
END;
$$;
GRANT EXECUTE ON FUNCTION public.marketplace_readiness(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_marketplace_enabled(uuid, boolean, boolean) TO authenticated;

-- Owners can't flip the switch directly with a table update (must go through the function).
CREATE OR REPLACE FUNCTION public.guard_store_protected_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
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
  OR NEW.marketplace_enabled IS DISTINCT FROM OLD.marketplace_enabled
  OR NEW.marketplace_agreed_at IS DISTINCT FROM OLD.marketplace_agreed_at THEN
    RAISE EXCEPTION 'Only QAFRICA admins can change this store setting' USING ERRCODE = '42501';
  END IF;
  -- Owners may request a domain (pending) or clear it (none); approval is admin-only
  IF NEW.domain_status IS DISTINCT FROM OLD.domain_status AND NEW.domain_status NOT IN ('none', 'pending') THEN
    RAISE EXCEPTION 'Only QAFRICA admins can approve a custom domain' USING ERRCODE = '42501';
  END IF;
  -- Owners may switch their store off, but switching it on needs an unblocked store
  -- with an active, unexpired subscription.
  IF NEW.is_active AND NOT COALESCE(OLD.is_active, false) THEN
    IF NEW.is_blocked THEN
      RAISE EXCEPTION 'This store is blocked. Contact QAFRICA support.' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.store_id = NEW.id AND s.is_active
                   AND (s.expires_at IS NULL OR s.expires_at > now())) THEN
      RAISE EXCEPTION 'Your store needs an active subscription to go live' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
