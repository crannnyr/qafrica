-- Applied live via apply_migration on 2026-09-24 (name: store_slug_for_subdomain).
-- Resolves <label>.qafrica.store to a store slug. Tolerates legacy slugs with leading/trailing
-- hyphens (54 stores), which aren't valid DNS labels: "mani-" is reachable as mani.qafrica.store.
CREATE OR REPLACE FUNCTION public.store_slug_for_subdomain(p_label text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.slug FROM stores s
  WHERE (s.slug = lower(p_label) OR trim(both '-' from s.slug) = lower(p_label))
    AND s.is_active AND NOT COALESCE(s.is_blocked, false) AND NOT COALESCE(s.is_developer_shadow, false)
  ORDER BY (s.slug = lower(p_label)) DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.store_slug_for_subdomain(text) FROM public;
GRANT EXECUTE ON FUNCTION public.store_slug_for_subdomain(text) TO anon, authenticated;
