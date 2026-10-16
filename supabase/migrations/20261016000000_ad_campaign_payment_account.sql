alter table public.ad_campaign_payments
  add column if not exists payment_account jsonb,
  add column if not exists payment_expires_at timestamptz;

create index if not exists ad_campaign_payments_user_reference_idx
  on public.ad_campaign_payments (user_id, reference);
