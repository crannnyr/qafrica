-- Applied live via apply_migration on 2026-09-24 (name: store_switching_for_approved_accounts).
-- Verified with rolled-back tests (6 scenarios): owner switch, others' store blocked, self-grant blocked, non-approved user blocked.
-- Store switching for approved multi-store accounts only.
-- Previously the dashboard switched stores only in the browser, then reloaded; the reload
-- re-read profiles.active_store_id (unchanged) and snapped back to the old store.

CREATE TABLE IF NOT EXISTS public.store_switch_access (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  note text
);
ALTER TABLE public.store_switch_access ENABLE ROW LEVEL SECURITY;
-- No policies: only admins/service role (SQL) can grant or revoke access.

-- Stores the current user may switch between (empty unless granted access).
CREATE OR REPLACE FUNCTION public.list_switchable_stores()
RETURNS TABLE (id uuid, name text, slug text, logo_url text, is_active boolean, is_current boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.name, s.slug, s.logo_url, s.is_active,
         s.id = (SELECT active_store_id FROM profiles WHERE profiles.id = auth.uid())
  FROM stores s
  WHERE s.owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM store_switch_access a WHERE a.user_id = auth.uid())
  ORDER BY s.is_active DESC, s.is_primary DESC NULLS LAST, s.created_at;
$$;

-- Switch the current user's active store (server-side, so it survives reloads and devices).
CREATE OR REPLACE FUNCTION public.switch_active_store(p_store_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM store_switch_access WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Store switching is not enabled for this account' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'You do not own this store' USING ERRCODE = '42501';
  END IF;
  UPDATE profiles SET active_store_id = p_store_id, updated_at = now() WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.list_switchable_stores() FROM public;
REVOKE ALL ON FUNCTION public.switch_active_store(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.list_switchable_stores() TO authenticated;
GRANT EXECUTE ON FUNCTION public.switch_active_store(uuid) TO authenticated;

INSERT INTO public.store_switch_access (user_id, note)
VALUES ('da9db136-523d-489e-a832-dc51a87cea3f', 'Platform owner: vibecityyyy@gmail.com (6 stores)')
ON CONFLICT (user_id) DO NOTHING;
