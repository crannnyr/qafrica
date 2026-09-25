-- Applied live 2026-09-25 (name: help_pay_and_cart_clearers). Verified (rolled back): repeat pair counts once,
-- undelivered excluded until delivery, self-clear 0, profile needs a clear, bad handles rejected, can't post others'
-- links, public feed hides address/phone/email/surname.
-- Help Pay (public cart board) + Cart Clearers leaderboard.

-- Public posting of pay-for-me links
ALTER TABLE public.shared_carts
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS amount_snapshot numeric,
  ADD COLUMN IF NOT EXISTS preview_images text[];
CREATE INDEX IF NOT EXISTS shared_carts_public_feed ON public.shared_carts (published_at DESC) WHERE is_public AND status = 'active';

-- Who paid (signed-in payer or a guest who claimed afterwards)
ALTER TABLE public.checkout_sessions ADD COLUMN IF NOT EXISTS payer_claimed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.cart_clearer_profiles (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 2 AND 30),
  instagram text CHECK (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  tiktok text CHECK (tiktok ~ '^[A-Za-z0-9._]{1,30}$'),
  x_handle text CHECK (x_handle ~ '^[A-Za-z0-9_]{1,15}$'),
  show_on_board boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cart_clearer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read clearer profiles" ON public.cart_clearer_profiles FOR SELECT TO authenticated USING (public.is_admin());

-- Snapshot amount + preview images when a link is created (keeps the public feed fast)
CREATE OR REPLACE FUNCTION public.snapshot_shared_cart() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q jsonb;
BEGIN
  q := checkout_quote(NEW.items, NEW.delivery->>'state', '{}'::jsonb);
  NEW.amount_snapshot := (q->>'amount')::numeric;
  SELECT array_agg(img) INTO NEW.preview_images FROM (
    SELECT l->>'image' AS img FROM jsonb_array_elements(q->'stores') s, jsonb_array_elements(s->'items') l
    WHERE l->>'image' IS NOT NULL LIMIT 4) x;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_snapshot_shared_cart ON public.shared_carts;
CREATE TRIGGER trg_snapshot_shared_cart BEFORE INSERT ON public.shared_carts FOR EACH ROW EXECUTE FUNCTION public.snapshot_shared_cart();

-- Post / unpost my link on Help Pay (signed-in owner only)
CREATE OR REPLACE FUNCTION public.set_help_pay_public(p_code text, p_public boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sc shared_carts%ROWTYPE;
BEGIN
  SELECT * INTO sc FROM shared_carts WHERE code = upper(trim(p_code)) FOR UPDATE;
  IF NOT FOUND OR sc.created_by IS NULL OR sc.created_by <> auth.uid() THEN
    RAISE EXCEPTION 'Sign in with the account that created this link to post it on Help Pay' USING ERRCODE = '42501';
  END IF;
  IF p_public AND (sc.status <> 'active' OR sc.expires_at < now()) THEN
    RAISE EXCEPTION 'This link is no longer active' USING ERRCODE = '22023';
  END IF;
  IF p_public AND (SELECT count(*) FROM shared_carts WHERE created_by = auth.uid() AND is_public AND status = 'active' AND expires_at > now() AND id <> sc.id) >= 3 THEN
    RAISE EXCEPTION 'You can have up to 3 carts on Help Pay at a time' USING ERRCODE = '22023';
  END IF;
  UPDATE shared_carts SET is_public = p_public, published_at = CASE WHEN p_public THEN now() ELSE published_at END WHERE id = sc.id;
END $$;
REVOKE ALL ON FUNCTION public.set_help_pay_public(text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_help_pay_public(text, boolean) TO authenticated;

-- Public feed: never address, phone, email or surname
CREATE OR REPLACE FUNCTION public.help_pay_feed(p_sort text DEFAULT 'newest', p_max_amount numeric DEFAULT NULL, p_limit int DEFAULT 20, p_offset int DEFAULT 0)
RETURNS TABLE (code text, first_name text, city text, state text, note text, amount numeric, preview_images text[], item_count int, published_at timestamptz, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sc.code, split_part(sc.recipient_name, ' ', 1), sc.delivery->>'city', sc.delivery->>'state', sc.note,
         sc.amount_snapshot, sc.preview_images, jsonb_array_length(sc.items), sc.published_at, sc.expires_at
  FROM shared_carts sc
  WHERE sc.is_public AND sc.status = 'active' AND sc.expires_at > now() AND sc.amount_snapshot IS NOT NULL
    AND (p_max_amount IS NULL OR sc.amount_snapshot <= p_max_amount)
  ORDER BY
    CASE WHEN p_sort = 'cheapest' THEN sc.amount_snapshot END ASC NULLS LAST,
    CASE WHEN p_sort = 'ending' THEN sc.expires_at END ASC NULLS LAST,
    sc.published_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 50) OFFSET GREATEST(p_offset, 0);
$$;
REVOKE ALL ON FUNCTION public.help_pay_feed(text, numeric, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.help_pay_feed(text, numeric, int, int) TO anon, authenticated;

-- A clear counts when: paid pay-for-me checkout, payer has an account, payer isn't the recipient,
-- and every order in it is delivered (or its payment released). One per payer+recipient pair.
CREATE OR REPLACE VIEW public.cart_clears_counted AS
SELECT DISTINCT ON (cs.payer_customer_id, COALESCE(sc.created_by::text, lower(sc.recipient_email)))
  cs.payer_customer_id, cs.id AS session_id, cs.paid_at
FROM checkout_sessions cs
JOIN shared_carts sc ON sc.id = cs.shared_cart_id
WHERE cs.status = 'paid'
  AND cs.payer_customer_id IS NOT NULL
  AND (sc.created_by IS NULL OR sc.created_by <> cs.payer_customer_id)
  AND lower(COALESCE(cs.payer_email, '')) <> lower(sc.recipient_email)
  AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.checkout_session_id = cs.id
                  AND NOT (o.status = 'delivered' OR COALESCE(o.is_escrow_released, false)))
ORDER BY cs.payer_customer_id, COALESCE(sc.created_by::text, lower(sc.recipient_email)), cs.paid_at;
REVOKE ALL ON public.cart_clears_counted FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cart_clearers_leaderboard()
RETURNS TABLE (rank int, display_name text, instagram text, tiktok text, x_handle text, carts_cleared int, is_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH counts AS (
    SELECT c.payer_customer_id AS cid, count(*)::int AS n, max(c.paid_at) AS last_at
    FROM cart_clears_counted c GROUP BY c.payer_customer_id)
  SELECT (row_number() OVER (ORDER BY n DESC, last_at ASC))::int,
         COALESCE(p.display_name, split_part(cu.full_name, ' ', 1), 'Cart Clearer'),
         p.instagram, p.tiktok, p.x_handle, n, cid = auth.uid()
  FROM counts JOIN customers cu ON cu.id = counts.cid
  LEFT JOIN cart_clearer_profiles p ON p.customer_id = counts.cid
  WHERE COALESCE(p.show_on_board, true)
  ORDER BY n DESC, last_at ASC
  LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.cart_clearers_leaderboard() FROM public;
GRANT EXECUTE ON FUNCTION public.cart_clearers_leaderboard() TO anon, authenticated;

-- My stats (counted = delivered; pending = paid but not delivered yet)
CREATE OR REPLACE FUNCTION public.my_cart_clearer_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'counted', (SELECT count(*) FROM cart_clears_counted WHERE payer_customer_id = auth.uid()),
    'paid', (SELECT count(*) FROM checkout_sessions WHERE payer_customer_id = auth.uid() AND status = 'paid' AND shared_cart_id IS NOT NULL),
    'profile', (SELECT to_jsonb(p) - 'customer_id' FROM cart_clearer_profiles p WHERE p.customer_id = auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.my_cart_clearer_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_cart_clearer_stats() TO authenticated;

-- Social links / display name: only after at least one paid clear
CREATE OR REPLACE FUNCTION public.save_cart_clearer_profile(p_display_name text, p_instagram text, p_tiktok text, p_x text, p_show boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE norm text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = auth.uid()) THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM checkout_sessions WHERE payer_customer_id = auth.uid() AND status = 'paid' AND shared_cart_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Clear a cart first to join the Cart Clearers board' USING ERRCODE = '22023';
  END IF;
  INSERT INTO cart_clearer_profiles (customer_id, display_name, instagram, tiktok, x_handle, show_on_board, updated_at)
  VALUES (auth.uid(), trim(p_display_name),
          NULLIF(regexp_replace(trim(COALESCE(p_instagram, '')), '^@', ''), ''),
          NULLIF(regexp_replace(trim(COALESCE(p_tiktok, '')), '^@', ''), ''),
          NULLIF(regexp_replace(trim(COALESCE(p_x, '')), '^@', ''), ''), COALESCE(p_show, true), now())
  ON CONFLICT (customer_id) DO UPDATE SET display_name = EXCLUDED.display_name, instagram = EXCLUDED.instagram,
    tiktok = EXCLUDED.tiktok, x_handle = EXCLUDED.x_handle, show_on_board = EXCLUDED.show_on_board, updated_at = now();
EXCEPTION WHEN check_violation THEN
  RAISE EXCEPTION 'Use a name of 2-30 characters and plain handles (letters, numbers, . or _)' USING ERRCODE = '22023';
END $$;
REVOKE ALL ON FUNCTION public.save_cart_clearer_profile(text, text, text, text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_cart_clearer_profile(text, text, text, text, boolean) TO authenticated;

-- Guest payer claims their clear after creating an account, using the payment reference their browser holds
CREATE OR REPLACE FUNCTION public.claim_cart_clear(p_reference text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cs checkout_sessions%ROWTYPE; sc shared_carts%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = auth.uid()) THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  SELECT * INTO cs FROM checkout_sessions WHERE reference = p_reference FOR UPDATE;
  IF NOT FOUND OR cs.shared_cart_id IS NULL OR cs.status <> 'paid' THEN RAISE EXCEPTION 'Payment not found' USING ERRCODE = '22023'; END IF;
  IF cs.payer_customer_id IS NOT NULL THEN
    RETURN jsonb_build_object('claimed', cs.payer_customer_id = auth.uid(), 'already', true);
  END IF;
  IF cs.paid_at < now() - interval '30 days' THEN RAISE EXCEPTION 'This payment is too old to claim' USING ERRCODE = '22023'; END IF;
  SELECT * INTO sc FROM shared_carts WHERE id = cs.shared_cart_id;
  IF sc.created_by = auth.uid() THEN RAISE EXCEPTION 'You can''t claim your own cart' USING ERRCODE = '22023'; END IF;
  UPDATE checkout_sessions SET payer_customer_id = auth.uid(), payer_claimed_at = now() WHERE id = cs.id;
  RETURN jsonb_build_object('claimed', true);
END $$;
REVOKE ALL ON FUNCTION public.claim_cart_clear(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_cart_clear(text) TO authenticated;

-- My pay-for-me links (for the Me page)
CREATE OR REPLACE FUNCTION public.my_shared_carts()
RETURNS TABLE (code text, status text, is_public boolean, amount numeric, note text, created_at timestamptz, expires_at timestamptz, preview_images text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT code, CASE WHEN status = 'active' AND expires_at < now() THEN 'expired' ELSE status END, is_public, amount_snapshot, note, created_at, expires_at, preview_images
  FROM shared_carts WHERE created_by = auth.uid() ORDER BY created_at DESC LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.my_shared_carts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_shared_carts() TO authenticated;
