-- Batch 4 (Timed Out Orders / Restore): reminder cadence for customers
-- whose restored order is missing shipping method / delivery details.
-- Hourly for the first 24h after restore, then once daily at 6pm WAT
-- (17:00 UTC) after that. See order-reminders' run-shipping-info-reminders
-- / run-shipping-info-evening-reminders actions.

select cron.schedule(
  'shipping-info-reminders-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://bahiqhpypapvktpxrths.supabase.co/functions/v1/order-reminders?action=run-shipping-info-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'shipping-info-reminders-evening',
  '0 17 * * *',
  $$
  select net.http_post(
    url := 'https://bahiqhpypapvktpxrths.supabase.co/functions/v1/order-reminders?action=run-shipping-info-evening-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
