-- Task 12: automated seller re-engagement drip campaign.
-- Enrollment is automatic for paid-store owners with no paid sales. Emails are
-- queued through the existing email_queue so suppression and rate limits apply.

CREATE TABLE IF NOT EXISTS public.seller_reengagement_campaign (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'exited', 'completed')),
  current_step integer NOT NULL DEFAULT 0 CHECK (current_step BETWEEN 0 AND 10),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz,
  next_send_at timestamptz NOT NULL DEFAULT now(),
  exited_at timestamptz,
  exit_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seller_reengagement_due_idx
  ON public.seller_reengagement_campaign(status, next_send_at)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.seller_reengagement_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.seller_reengagement_campaign(id) ON DELETE CASCADE,
  step integer NOT NULL CHECK (step BETWEEN 0 AND 9),
  email_queue_id uuid,
  subject text NOT NULL,
  queued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, step)
);

ALTER TABLE public.seller_reengagement_campaign ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_reengagement_sends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seller_reengagement_campaign FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.seller_reengagement_sends FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_reengagement_campaign TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_reengagement_sends TO service_role;

CREATE OR REPLACE FUNCTION public.sync_seller_reengagement_enrollments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_added integer := 0;
  v_exited integer := 0;
BEGIN
  -- Any paid sale means the seller has activated and must leave the campaign.
  UPDATE public.seller_reengagement_campaign c
     SET status = 'exited',
         exited_at = now(),
         exit_reason = 'seller_made_a_sale',
         updated_at = now()
   WHERE c.status = 'active'
     AND EXISTS (
       SELECT 1
         FROM public.stores owned_store
         JOIN public.orders o ON o.store_id = owned_store.id
        WHERE owned_store.owner_id = c.user_id
          AND o.payment_status = 'paid'
     );
  GET DIAGNOSTICS v_exited = ROW_COUNT;

  -- Enrol automatically when a store and a paid subscription exist. This also
  -- catches older paid sellers and new users missed by an individual trigger.
  WITH eligible AS (
    SELECT s.id AS store_id, s.owner_id AS user_id
      FROM public.stores s
      JOIN public.profiles p ON p.id = s.owner_id
     WHERE coalesce(s.is_active, true)
       AND NOT coalesce(s.is_blocked, false)
       AND coalesce(s.is_hidden, false) = false
       AND nullif(trim(p.email), '') IS NOT NULL
       AND EXISTS (
         SELECT 1
           FROM public.subscriptions sub
          WHERE sub.user_id = s.owner_id
            AND sub.amount_paid > 0
            AND (sub.store_id = s.id OR sub.store_id IS NULL)
       )
       AND NOT EXISTS (
         SELECT 1
           FROM public.stores owned_store
           JOIN public.orders o ON o.store_id = owned_store.id
          WHERE owned_store.owner_id = s.owner_id
            AND o.payment_status = 'paid'
       )
  ), inserted AS (
    INSERT INTO public.seller_reengagement_campaign(user_id, store_id)
    SELECT user_id, store_id FROM eligible
    ON CONFLICT (store_id) DO NOTHING
    RETURNING id
  )
  SELECT count(*)::integer INTO v_added FROM inserted;

  RETURN jsonb_build_object('enrolled', v_added, 'exited', v_exited);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_seller_reengagement_due()
RETURNS TABLE (
  campaign_id uuid,
  user_id uuid,
  store_id uuid,
  email text,
  full_name text,
  store_name text,
  niches text[],
  product_count bigint,
  current_step integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.id, c.user_id, c.store_id, p.email, p.full_name, s.name, s.niches,
         (SELECT count(*) FROM public.products pr WHERE pr.store_id = s.id),
         c.current_step
    FROM public.seller_reengagement_campaign c
    JOIN public.profiles p ON p.id = c.user_id
    JOIN public.stores s ON s.id = c.store_id
   WHERE c.status = 'active'
     AND c.current_step < 10
     AND c.next_send_at <= now()
     AND nullif(trim(p.email), '') IS NOT NULL
     AND coalesce(s.is_active, true)
     AND NOT coalesce(s.is_blocked, false)
     AND NOT EXISTS (
       SELECT 1
         FROM public.stores owned_store
         JOIN public.orders o ON o.store_id = owned_store.id
        WHERE owned_store.owner_id = c.user_id
          AND o.payment_status = 'paid'
     )
   ORDER BY c.next_send_at, c.enrolled_at
   LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.queue_seller_reengagement_email(
  p_campaign_id uuid,
  p_step integer,
  p_subject text,
  p_html text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_campaign public.seller_reengagement_campaign%rowtype;
  v_email_queue_id uuid;
BEGIN
  SELECT * INTO v_campaign
    FROM public.seller_reengagement_campaign
   WHERE id = p_campaign_id
   FOR UPDATE;

  IF NOT FOUND OR v_campaign.status <> 'active'
     OR v_campaign.current_step <> p_step
     OR p_step < 0 OR p_step > 9 THEN
    RETURN jsonb_build_object('queued', false, 'reason', 'campaign_not_due');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.seller_reengagement_sends
     WHERE campaign_id = p_campaign_id AND step = p_step
  ) THEN
    RETURN jsonb_build_object('queued', false, 'reason', 'already_queued');
  END IF;

  -- Recheck sale status at the last responsible moment.
  IF EXISTS (
    SELECT 1
      FROM public.stores owned_store
      JOIN public.orders o ON o.store_id = owned_store.id
     WHERE owned_store.owner_id = v_campaign.user_id
       AND o.payment_status = 'paid'
  ) THEN
    UPDATE public.seller_reengagement_campaign
       SET status = 'exited', exited_at = now(),
           exit_reason = 'seller_made_a_sale', updated_at = now()
     WHERE id = p_campaign_id;
    RETURN jsonb_build_object('queued', false, 'reason', 'seller_made_a_sale');
  END IF;

  INSERT INTO public.email_queue (
    to_email, to_name, template_name, template_data, status, attempts,
    scheduled_for, email_type, priority, is_manually_triggered, subject, html_body
  )
  SELECT p.email, p.full_name, 'seller_reengagement',
         jsonb_build_object('campaign_id', p_campaign_id, 'step', p_step),
         'pending', 0, now(), 'seller_reengagement', 5, false, p_subject, p_html
    FROM public.profiles p
   WHERE p.id = v_campaign.user_id
  RETURNING id INTO v_email_queue_id;

  IF v_email_queue_id IS NULL THEN
    RETURN jsonb_build_object('queued', false, 'reason', 'recipient_missing');
  END IF;

  INSERT INTO public.seller_reengagement_sends(campaign_id, step, email_queue_id, subject)
  VALUES (p_campaign_id, p_step, v_email_queue_id, p_subject);

  UPDATE public.seller_reengagement_campaign
     SET current_step = p_step + 1,
         last_sent_at = now(),
         next_send_at = now() + interval '3 days 12 hours',
         status = CASE WHEN p_step = 9 THEN 'completed' ELSE 'active' END,
         updated_at = now()
   WHERE id = p_campaign_id;

  RETURN jsonb_build_object('queued', true, 'email_queue_id', v_email_queue_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.exit_seller_reengagement_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  IF NEW.payment_status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM NEW.payment_status) THEN
    SELECT owner_id INTO v_owner_id FROM public.stores WHERE id = NEW.store_id;
    IF v_owner_id IS NOT NULL THEN
      UPDATE public.seller_reengagement_campaign
         SET status = 'exited',
             exited_at = now(),
             exit_reason = 'seller_made_a_sale',
             updated_at = now()
       WHERE user_id = v_owner_id AND status = 'active';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exit_seller_reengagement_on_sale ON public.orders;
CREATE TRIGGER trg_exit_seller_reengagement_on_sale
AFTER INSERT OR UPDATE OF payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.exit_seller_reengagement_on_sale();

REVOKE ALL ON FUNCTION public.sync_seller_reengagement_enrollments() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_seller_reengagement_due() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_seller_reengagement_email(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_seller_reengagement_enrollments() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_seller_reengagement_due() TO service_role;
GRANT EXECUTE ON FUNCTION public.queue_seller_reengagement_email(uuid, integer, text, text) TO service_role;

-- Before applying this migration, store the service-role JWT in Supabase Vault as
-- `qafrica_service_role_key`. Do not commit the key to source control. The
-- function only queues messages; the existing queue processor applies email
-- suppression, per-domain throttling, and global daily caps before sending.
SELECT cron.schedule(
  'seller-reengagement-campaign-daily',
  '0 8 * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://bahiqhpypapvktpxrths.supabase.co/functions/v1/seller-reengagement-campaign',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'qafrica_service_role_key' LIMIT 1)
      ),
      body := '{}'::jsonb
    );
  $cron$
);
