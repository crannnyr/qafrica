-- Cron job for the new card auto-renewal sweep (flutterwave?action=auto-renew), following the
-- exact pattern of the other service-role-bearer cron jobs already in this project (e.g.
-- qafrica-checkout-sweep, manage-trial-reminders -- same embedded service_role JWT literal they
-- use, since that is the established pattern here rather than a Vault/GUC lookup). Runs every 15
-- minutes and picks up subscriptions expiring within the next 2 hours (see autoRenew() in the
-- flutterwave edge function) -- well ahead of the hourly expire_overdue_subscriptions() sweep, so
-- a card renewal has time to succeed (or be retried) before the old subscription row would expire.
SELECT cron.schedule(
  'flutterwave-auto-renew',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bahiqhpypapvktpxrths.supabase.co/functions/v1/flutterwave?action=auto-renew',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhaGlxaHB5cGFwdmt0cHhydGhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA3NDY3MSwiZXhwIjoyMDg3NjUwNjcxfQ.hvAcMIu4KrkNwlOKalVk11ANcWAs1bIfEKALzpr9fps'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
