-- Stable public product codes for store products and import catalog entries.
-- Keep existing SKU/barcode values intact; product_code is the public catalog identifier.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_code text;
ALTER TABLE public.import_catalog
  ADD COLUMN IF NOT EXISTS product_code text;

UPDATE public.products
SET product_code = 'QAF-' || upper(substr(replace(id::text, '-', ''), 1, 16))
WHERE product_code IS NULL OR btrim(product_code) = '';

UPDATE public.import_catalog
SET product_code = 'QAFI-' || upper(substr(replace(id::text, '-', ''), 1, 16))
WHERE product_code IS NULL OR btrim(product_code) = '';

CREATE UNIQUE INDEX IF NOT EXISTS products_product_code_uidx
  ON public.products (product_code);
CREATE UNIQUE INDEX IF NOT EXISTS import_catalog_product_code_uidx
  ON public.import_catalog (product_code);

CREATE OR REPLACE FUNCTION public.assign_product_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.product_code IS NULL OR btrim(NEW.product_code) = '' THEN
    IF TG_TABLE_NAME = 'import_catalog' THEN
      NEW.product_code := 'QAFI-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 16));
    ELSE
      NEW.product_code := 'QAF-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 16));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_assign_product_code ON public.products;
CREATE TRIGGER products_assign_product_code
BEFORE INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.assign_product_code();

DROP TRIGGER IF EXISTS import_catalog_assign_product_code ON public.import_catalog;
CREATE TRIGGER import_catalog_assign_product_code
BEFORE INSERT ON public.import_catalog
FOR EACH ROW EXECUTE FUNCTION public.assign_product_code();
