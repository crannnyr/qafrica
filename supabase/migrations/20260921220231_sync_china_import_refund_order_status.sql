-- Keep cancelled import orders for audit/history and synchronize the original order when a full-order refund is actually paid.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'china_import_orders_status_check') THEN
    ALTER TABLE public.china_import_orders DROP CONSTRAINT china_import_orders_status_check;
  END IF;
  ALTER TABLE public.china_import_orders ADD CONSTRAINT china_import_orders_status_check CHECK (status = ANY (ARRAY['pending','confirmed','billed','to_review','ordered','ordered_and_closed','shipped_and_closed','clearance_and_closed','received','cancelled','refunded']));
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'china_import_orders_payment_status_check') THEN
    ALTER TABLE public.china_import_orders DROP CONSTRAINT china_import_orders_payment_status_check;
  END IF;
  ALTER TABLE public.china_import_orders ADD CONSTRAINT china_import_orders_payment_status_check CHECK (payment_status = ANY (ARRAY['unpaid','awaiting_confirmation','paid','failed','refunded']));
END $$;

CREATE OR REPLACE FUNCTION public.sync_china_import_order_refund()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' AND NEW.cancellation_type = 'full_order' THEN
    UPDATE public.china_import_orders SET status = 'refunded', payment_status = 'refunded', updated_at = now()
    WHERE id = NEW.original_order_id AND status <> 'refunded';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_china_import_refund_paid ON public.china_import_refunds;
CREATE TRIGGER trg_china_import_refund_paid AFTER UPDATE OF status ON public.china_import_refunds
FOR EACH ROW WHEN (NEW.status = 'paid') EXECUTE FUNCTION public.sync_china_import_order_refund();

UPDATE public.china_import_orders o
SET status = 'refunded', payment_status = 'refunded', updated_at = now()
WHERE o.status <> 'refunded'
  AND EXISTS (SELECT 1 FROM public.china_import_refunds r WHERE r.original_order_id = o.id AND r.status = 'paid' AND r.cancellation_type = 'full_order');