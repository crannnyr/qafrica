alter table public.ad_campaigns add column if not exists image_url text;
create index if not exists ad_campaigns_public_placement_idx
  on public.ad_campaigns(campaign_type, approval_status, status, start_date, end_date);
