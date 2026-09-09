-- Batch 1 (import-admin overhaul): daily re-sync of Jumia pickup stations
-- from the Optimal project, via the sync-pickup-stations edge function.
select cron.schedule(
  'sync-jumia-pickup-stations-daily',
  '15 4 * * *',
  $$
  select net.http_post(
    url := 'https://bahiqhpypapvktpxrths.supabase.co/functions/v1/sync-pickup-stations',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
