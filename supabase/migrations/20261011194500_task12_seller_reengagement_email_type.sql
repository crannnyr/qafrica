-- Register the campaign email type so the existing queue processor can
-- apply a dedicated daily cap and an admin-controlled enable/disable switch.
INSERT INTO public.email_type_settings (
  email_type, display_name, description, is_enabled, daily_limit,
  sent_today, total_sent_all_time, last_reset_at, priority, is_transactional
)
VALUES (
  'seller_reengagement',
  'Seller re-engagement campaign',
  'Automated educational check-ins for paid store owners who have not recorded a sale.',
  true,
  100,
  0,
  0,
  now(),
  5,
  false
)
ON CONFLICT (email_type) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_enabled = true,
  daily_limit = GREATEST(public.email_type_settings.daily_limit, 100),
  priority = 5,
  is_transactional = false,
  updated_at = now();
