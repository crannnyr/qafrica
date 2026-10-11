-- Task 5: provide all Nigerian delivery states to existing and newly created stores.
-- Preserve any state price/availability the owner has already configured.
DO $$
DECLARE
  v_state text;
  v_states text[] := ARRAY[
    'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
    'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT - Abuja','Gombe',
    'Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos',
    'Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto',
    'Taraba','Yobe','Zamfara'
  ];
BEGIN
  FOREACH v_state IN ARRAY v_states LOOP
    INSERT INTO public.delivery_zones (store_id, owner_id, state, price, is_active)
    SELECT s.id, s.owner_id, v_state, 1500, true
    FROM public.stores s
    ON CONFLICT (store_id, state) DO NOTHING;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.seed_default_delivery_zones_for_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state text;
  v_states text[] := ARRAY[
    'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
    'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT - Abuja','Gombe',
    'Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos',
    'Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto',
    'Taraba','Yobe','Zamfara'
  ];
BEGIN
  FOREACH v_state IN ARRAY v_states LOOP
    INSERT INTO public.delivery_zones (store_id, owner_id, state, price, is_active)
    VALUES (NEW.id, NEW.owner_id, v_state, 1500, true)
    ON CONFLICT (store_id, state) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_delivery_zones ON public.stores;
CREATE TRIGGER trg_seed_default_delivery_zones
AFTER INSERT ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.seed_default_delivery_zones_for_store();

ALTER TABLE public.orders
  ALTER COLUMN platform_fee SET DEFAULT 120;
