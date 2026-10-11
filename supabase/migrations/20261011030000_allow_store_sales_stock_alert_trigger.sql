-- Store-owner POS sales update product stock through order_items triggers.
-- check_stock_levels is a SECURITY DEFINER trigger function; its admin-only
-- assertion incorrectly blocked legitimate stock changes from store owners.
-- Authorization for the sale is enforced by record_pos_sale/assert_store_access.
CREATE OR REPLACE FUNCTION public.check_stock_levels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_threshold INTEGER;
  alert_type TEXT;
  v_email TEXT;
  v_store_name TEXT;
BEGIN
  v_threshold := COALESCE(NEW.low_stock_threshold, 10);

  IF NEW.stock_quantity = 0 THEN
    alert_type := 'out_of_stock';
  ELSIF NEW.stock_quantity <= v_threshold THEN
    alert_type := 'low_stock';
  ELSE
    RETURN NEW;
  END IF;

  IF OLD.stock_quantity = NEW.stock_quantity THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.stock_alerts (
    product_id, store_id, owner_id, alert_type,
    previous_stock, current_stock, threshold
  ) VALUES (
    NEW.id, NEW.store_id, NEW.owner_id, alert_type,
    OLD.stock_quantity, NEW.stock_quantity, v_threshold
  );

  INSERT INTO public.notifications (user_id, store_id, type, title, message, data)
  VALUES (
    NEW.owner_id, NEW.store_id, alert_type,
    CASE WHEN NEW.stock_quantity = 0 THEN 'Out of Stock' ELSE 'Low Stock Alert' END,
    CASE WHEN NEW.stock_quantity = 0
      THEN NEW.name || ' is now out of stock'
      ELSE NEW.name || ' is running low — ' || NEW.stock_quantity || ' units left'
    END,
    jsonb_build_object(
      'product_id', NEW.id,
      'product_name', NEW.name,
      'stock', NEW.stock_quantity,
      'threshold', v_threshold
    )
  );

  SELECT au.email, s.name
    INTO v_email, v_store_name
    FROM auth.users au
    JOIN public.stores s ON s.id = NEW.store_id
   WHERE au.id = NEW.owner_id;

  IF v_email IS NOT NULL THEN
    INSERT INTO public.email_queue (to_email, template_name, template_data)
    VALUES (
      v_email,
      CASE WHEN NEW.stock_quantity = 0 THEN 'out_of_stock' ELSE 'low_stock' END,
      jsonb_build_object(
        'product_name', NEW.name,
        'current_stock', NEW.stock_quantity,
        'threshold', v_threshold,
        'store_name', v_store_name,
        'product_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;