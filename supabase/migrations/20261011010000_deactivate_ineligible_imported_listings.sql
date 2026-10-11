-- Automatically deactivate seller-to-seller imported listings when the source
-- product is no longer eligible. This is intentionally one-way: stock recovery
-- does not reactivate a seller's listing without an explicit seller action.
CREATE OR REPLACE FUNCTION public.deactivate_ineligible_imported_listings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT COALESCE(NEW.is_active, false)
     OR NOT COALESCE(NEW.is_importable, false)
     OR COALESCE(NEW.is_out_of_stock, false)
     OR COALESCE(NEW.stock_quantity, 0) < 5 THEN
    UPDATE public.import_catalog
       SET is_active = false
     WHERE original_product_id = NEW.id
       AND is_active IS TRUE;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS deactivate_ineligible_imported_listings
  ON public.products;

CREATE TRIGGER deactivate_ineligible_imported_listings
  AFTER UPDATE OF is_active, is_importable, is_out_of_stock, stock_quantity
  ON public.products
  FOR EACH ROW
  WHEN (
    OLD.is_active IS DISTINCT FROM NEW.is_active
    OR OLD.is_importable IS DISTINCT FROM NEW.is_importable
    OR OLD.is_out_of_stock IS DISTINCT FROM NEW.is_out_of_stock
    OR OLD.stock_quantity IS DISTINCT FROM NEW.stock_quantity
  )
  EXECUTE FUNCTION public.deactivate_ineligible_imported_listings();

COMMENT ON FUNCTION public.deactivate_ineligible_imported_listings()
IS 'Deactivates seller-to-seller import_catalog listings when their source product becomes inactive, non-importable, out of stock, or has fewer than five units. Does not auto-reactivate listings when stock recovers.';


-- Enable Postgres Changes for the dashboard's per-user notification subscription.
DO $publication$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_publication
     WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END;
$publication$;
