-- Applied live via apply_migration on 2026-09-24 (name: payment_health_checks).
-- Admin-requested provider health checks. A row must exist (created by an admin/SQL) before the
-- nomba-health function will run, so the public URL can't be used to spam Nomba.
CREATE TABLE IF NOT EXISTS public.payment_health_checks (
  id bigserial PRIMARY KEY,
  provider text NOT NULL DEFAULT 'nomba',
  requested_at timestamptz NOT NULL DEFAULT now(),
  ran_at timestamptz,
  ok boolean,
  result jsonb
);
ALTER TABLE public.payment_health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read health checks" ON public.payment_health_checks
  FOR SELECT TO authenticated USING (public.is_admin());
