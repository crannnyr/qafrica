-- The in-app QAFRICA banner/placement campaign flow uses platform values
-- beyond the legacy external social-network list. Keep platform required,
-- but do not reject valid QAFRICA-owned placements at the database layer.
ALTER TABLE public.ad_campaigns
  DROP CONSTRAINT IF EXISTS ad_campaigns_platform_check;

ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_platform_check
  CHECK (length(trim(platform)) > 0);
