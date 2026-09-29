-- Runs inside the subscription INSERT; must be allowed to switch off the owner's older plans
-- even when the insert comes from a signed-in user (the owner-change guard blocks that otherwise).
ALTER FUNCTION public.deactivate_old_subscriptions() SECURITY DEFINER;
ALTER FUNCTION public.deactivate_old_subscriptions() SET search_path TO 'public', 'pg_temp';
REVOKE EXECUTE ON FUNCTION public.deactivate_old_subscriptions() FROM PUBLIC, anon, authenticated;
