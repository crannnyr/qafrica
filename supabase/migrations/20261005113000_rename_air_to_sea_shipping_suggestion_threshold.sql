-- The ₦500,000 threshold suggests Sea freight; Air/Flight remains the default.
alter table public.import_admin_credentials
  rename column air_shipping_suggestion_threshold_ngn to sea_shipping_suggestion_threshold_ngn;
