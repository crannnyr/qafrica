-- The ₦500,000 threshold suggests Sea freight; Air/Flight remains the default.
-- Idempotent because this migration was also applied directly in production.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'import_admin_credentials'
      and column_name = 'air_shipping_suggestion_threshold_ngn'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'import_admin_credentials'
      and column_name = 'sea_shipping_suggestion_threshold_ngn'
  ) then
    alter table public.import_admin_credentials
      rename column air_shipping_suggestion_threshold_ngn to sea_shipping_suggestion_threshold_ngn;
  end if;
end $$;
