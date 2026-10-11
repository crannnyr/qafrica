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


-- Database-native campaign runner: no Vault secret or Edge Function HTTP call is
-- required. pg_cron runs this function inside Postgres, and emails still enter
-- the existing email_queue so its normal suppression and rate limits apply.
CREATE OR REPLACE FUNCTION public.process_seller_reengagement_campaigns()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sync jsonb;
  v_candidate record;
  v_subject text;
  v_heading text;
  v_body text;
  v_cta text;
  v_href text;
  v_html text;
  v_result jsonb;
  v_queued integer := 0;
  v_skipped integer := 0;
  v_errors integer := 0;
  v_first_name text;
  v_store_name text;
BEGIN
  v_sync := public.sync_seller_reengagement_enrollments();

  FOR v_candidate IN SELECT * FROM public.get_seller_reengagement_due()
  LOOP
    v_first_name := split_part(coalesce(nullif(trim(v_candidate.full_name), ''), 'there'), ' ', 1);
    v_store_name := coalesce(nullif(trim(v_candidate.store_name), ''), 'your store');

    CASE v_candidate.current_step
      WHEN 0 THEN
        v_subject := 'Your first QAfrica sale starts with one small step';
        v_heading := 'Let’s get your store moving';
        v_body := CASE WHEN v_candidate.product_count = 0
          THEN 'Start by choosing one product that fits the customer you want to serve. Browse the import catalog and review the current product details before adding it.'
          ELSE 'Start with your strongest product. Check that its photo, title, price, and description make the value clear within a few seconds.' END;
        v_cta := CASE WHEN v_candidate.product_count = 0 THEN 'Browse products to import' ELSE 'Review my products' END;
        v_href := CASE WHEN v_candidate.product_count = 0 THEN '/dashboard/catalog' ELSE '/dashboard/products' END;
      WHEN 1 THEN
        v_subject := 'A simple product-picking method for ' || v_store_name;
        v_heading := 'Choose for a specific customer';
        v_body := 'Instead of listing everything, think of one customer group and the problem they want solved. Choose products that fit that audience.';
        v_cta := 'Explore the import catalog'; v_href := '/dashboard/catalog';
      WHEN 2 THEN
        v_subject := 'One product photo can change the first impression';
        v_heading := 'Make the product easy to understand';
        v_body := 'Use a clear, well-lit image that shows the item itself. Add extra angles when available, and make sure the first image is easy to understand on a phone screen.';
        v_cta := 'Improve my product pages'; v_href := '/dashboard/products';
      WHEN 3 THEN
        v_subject := 'Check your price before you share your store';
        v_heading := 'Make the price make sense';
        v_body := 'Compare similar products, account for delivery and platform charges, and decide what value your store adds. Do not set a price based only on what another seller charges.';
        v_cta := 'Review my product prices'; v_href := '/dashboard/products';
      WHEN 4 THEN
        v_subject := 'A product idea for your QAfrica niche';
        v_heading := 'Review products that fit your niche';
        v_body := 'Open the import catalog and filter for products that match your store niche. Check photos, current stock, and the current cost before importing.';
        v_cta := 'View the import catalog'; v_href := '/dashboard/catalog';
      WHEN 5 THEN
        v_subject := 'Help customers trust your store';
        v_heading := 'Answer the questions buyers already have';
        v_body := 'Clear product details, accurate delivery expectations, and visible contact information reduce uncertainty. Review your storefront as if you were a first-time visitor.';
        v_cta := 'Open my storefront settings'; v_href := '/dashboard/store-setup';
      WHEN 6 THEN
        v_subject := 'Try a focused product collection this week';
        v_heading := 'Keep your store easy to browse';
        v_body := 'A small collection around one theme can be easier to understand than a scattered catalog. Add related products or remove anything that distracts from your main offer.';
        v_cta := 'Manage products'; v_href := '/dashboard/products';
      WHEN 7 THEN
        v_subject := 'Give your store link a real audience';
        v_heading := 'Share where your customers already are';
        v_body := 'Share a useful product or collection with people likely to care about it. Add a short explanation of who it helps instead of posting a bare link with no context.';
        v_cta := 'Open my store dashboard'; v_href := '/dashboard';
      WHEN 8 THEN
        v_subject := 'A quick 10-minute QAfrica store check';
        v_heading := 'Use this quick checklist';
        v_body := 'Check four things: a clear product image, a specific title, a complete description, and a price that covers your costs. Then test the buying steps on your phone.';
        v_cta := 'Run through my store'; v_href := '/dashboard/products';
      WHEN 9 THEN
        v_subject := 'Your QAfrica next step: turn setup into action';
        v_heading := 'Ready for your next step?';
        v_body := CASE WHEN v_candidate.product_count = 0
          THEN 'Pick one suitable product today and complete its details. Getting one product live is a practical first milestone.'
          ELSE 'Choose one product to improve, share it with a relevant audience, and review the result. Small, repeatable improvements are more useful than changing everything at once.' END;
        v_cta := CASE WHEN v_candidate.product_count = 0 THEN 'Add my first product' ELSE 'Open my products' END;
        v_href := CASE WHEN v_candidate.product_count = 0 THEN '/dashboard/products/add' ELSE '/dashboard/products' END;
      ELSE
        v_skipped := v_skipped + 1;
        CONTINUE;
    END CASE;

    -- Escape interpolated profile/store values before placing them in HTML.
    v_first_name := replace(replace(replace(replace(replace(v_first_name, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
    v_store_name := replace(replace(replace(replace(replace(v_store_name, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
    v_html := '<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#172033"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:16px"><tr><td style="background:#f97316;padding:20px 28px;color:#fff;font-size:21px;font-weight:800">QAFRICA</td></tr><tr><td style="padding:28px;line-height:1.65"><p style="color:#475569">Hi ' || v_first_name || ',</p><h1 style="font-size:25px;line-height:1.25;color:#111827">' || v_heading || '</h1><p style="color:#475569">Your store, <strong>' || v_store_name || '</strong>, is part of your QAfrica journey. Here is one practical next step:</p><p style="color:#475569">' || v_body || '</p><p style="margin:24px 0"><a href="https://qafrica.store' || v_href || '" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:9px">' || v_cta || ' →</a></p><p style="color:#64748b;font-size:13px">You are receiving this because you have a paid QAfrica store. These check-ins stop when your store records a sale. If you need help, reply to this email and our team can assist.</p></td></tr><tr><td style="padding:16px 28px;background:#fff7ed;color:#9a3412;font-size:12px">QAfrica · Build your store, one step at a time.</td></tr></table></td></tr></table></body></html>';

    BEGIN
      v_result := public.queue_seller_reengagement_email(
        v_candidate.campaign_id, v_candidate.current_step, v_subject, v_html
      );
      IF coalesce((v_result->>'queued')::boolean, false) THEN
        v_queued := v_queued + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE WARNING 'Seller re-engagement campaign % step % failed: %',
        v_candidate.campaign_id, v_candidate.current_step, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'enrolled', coalesce((v_sync->>'enrolled')::integer, 0),
    'exited', coalesce((v_sync->>'exited')::integer, 0),
    'queued', v_queued, 'skipped', v_skipped, 'errors', v_errors
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_seller_reengagement_campaigns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_seller_reengagement_campaigns() TO service_role;

-- Run entirely inside Postgres. No service-role key needs to be stored in Vault.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'seller-reengagement-campaign-daily';
SELECT cron.schedule(
  'seller-reengagement-campaign-daily',
  '0 8 * * *',
  $$SELECT public.process_seller_reengagement_campaigns();$$
);
