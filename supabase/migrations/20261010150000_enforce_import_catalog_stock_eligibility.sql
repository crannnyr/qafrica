-- Enforce the shared seller-import catalog stock rule in the database.
-- Products remain on their owner's storefront; this only governs whether a
-- product may be newly added/reactivated in another seller's import catalog.
CREATE OR REPLACE FUNCTION public.enforce_import_catalog_stock_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
  v_needs_validation boolean := true;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Price edits and other unrelated edits to an existing import must remain
    -- possible even if supplier stock has since fallen below the threshold.
    v_needs_validation :=
      NEW.original_product_id IS DISTINCT FROM OLD.original_product_id
      OR NEW.importer_store_id IS DISTINCT FROM OLD.importer_store_id
      OR (NEW.is_active IS TRUE AND OLD.is_active IS DISTINCT FROM TRUE);

    IF NOT v_needs_validation THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT *
    INTO v_product
    FROM public.products
   WHERE id = NEW.original_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This product is no longer available for import'
      USING ERRCODE = '23503';
  END IF;

  IF v_product.store_id = NEW.importer_store_id THEN
    RAISE EXCEPTION 'You cannot import a product from your own store'
      USING ERRCODE = '23514';
  END IF;

  IF NOT COALESCE(v_product.is_active, false)
     OR NOT COALESCE(v_product.is_importable, false) THEN
    RAISE EXCEPTION 'This product is not available for importing'
      USING ERRCODE = '23514';
  END IF;

  IF COALESCE(v_product.is_out_of_stock, false)
     OR COALESCE(v_product.stock_quantity, 0) < 5 THEN
    RAISE EXCEPTION 'A product must have at least 5 available units to be imported'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_import_catalog_stock_eligibility
  ON public.import_catalog;

CREATE TRIGGER enforce_import_catalog_stock_eligibility
  BEFORE INSERT OR UPDATE ON public.import_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_import_catalog_stock_eligibility();

COMMENT ON FUNCTION public.enforce_import_catalog_stock_eligibility()
IS 'Validates minimum stock and importability when a seller adds or reactivates an original seller product in import_catalog. Does not deactivate or hide the source product.';
