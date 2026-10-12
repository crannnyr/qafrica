-- Deactivate products that cannot be sold with upfront air and sea shipping.
-- Keep existing inactive products unchanged. Re-running this migration is safe.
UPDATE public.china_import_products
SET is_active = false,
    updated_at = now()
WHERE is_active = true
  AND (
    air_shipping_customer_ngn IS NULL
    OR air_shipping_customer_ngn <= 0
    OR sea_shipping_customer_ngn IS NULL
    OR sea_shipping_customer_ngn <= 0
  );
