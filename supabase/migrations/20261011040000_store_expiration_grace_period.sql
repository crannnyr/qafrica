-- Task 15: deduplicated subscription lifecycle and seven-day storefront grace.
CREATE TABLE IF NOT EXISTS public.subscription_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  store_id uuid,
  user_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('reminder_3d','expired','grace_ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id,event_type)
);
CREATE INDEX IF NOT EXISTS subscription_lifecycle_events_store_idx
  ON public.subscription_lifecycle_events(store_id,event_type);

CREATE OR REPLACE FUNCTION public.expire_overdue_subscriptions()
RETURNS void LANGUAGE plpgsql SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  r record; st record; ev uuid; covered boolean;
  expired_count int := 0; closed_count int := 0;
  owner_name text; store_name_safe text; owner_name_safe text;
BEGIN
  -- Reminder once within three days of expiry. Unique event is the idempotency key.
  FOR r IN
    SELECT s.id,s.store_id,s.user_id,s.tier,s.expires_at,p.full_name,p.email,
           COALESCE(st.name,'your QAFRICA store') AS store_name
      FROM public.subscriptions s
      JOIN public.profiles p ON p.id=s.user_id
      LEFT JOIN public.stores st ON st.id=s.store_id
     WHERE s.is_active IS TRUE AND s.expires_at>now()
       AND s.expires_at<=now()+interval '3 days'
       AND NOT EXISTS (SELECT 1 FROM public.subscription_lifecycle_events e
        WHERE e.subscription_id=s.id AND e.event_type='reminder_3d')
  LOOP
    ev := NULL;
    INSERT INTO public.subscription_lifecycle_events(subscription_id,store_id,user_id,event_type)
    VALUES(r.id,r.store_id,r.user_id,'reminder_3d')
    ON CONFLICT(subscription_id,event_type) DO NOTHING RETURNING id INTO ev;
    IF ev IS NOT NULL AND COALESCE(r.email,'')<>'' THEN
      owner_name := COALESCE(r.full_name,'there');
      owner_name_safe := replace(replace(replace(owner_name,'&','&amp;'),'<','&lt;'),'>','&gt;');
      store_name_safe := replace(replace(replace(r.store_name,'&','&amp;'),'<','&lt;'),'>','&gt;');
      INSERT INTO public.email_queue(to_email,to_name,template_name,template_data,status,scheduled_for,email_type,priority,subject,html_body)
      VALUES(r.email,r.full_name,'generic','{}'::jsonb,'pending',now(),'subscription_lifecycle',2,
       'Your QAFRICA subscription expires in 3 days',
       '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:28px;color:#1f2937"><h2 style="color:#f97316">Your store subscription expires soon</h2><p>Hello '||owner_name_safe||',</p><p>Your subscription for <strong>'||store_name_safe||'</strong> expires on <strong>'||to_char(r.expires_at AT TIME ZONE 'Africa/Lagos','DD Mon YYYY, HH12:MI AM')||' WAT</strong>.</p><p>Renew now to keep your store online without interruption.</p><p><a href="https://qafrica.store/dashboard/subscription" style="background:#f97316;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">Renew subscription</a></p><p>QAFRICA</p></div>');
    END IF;
  END LOOP;

  -- Expire the subscription row but leave its store online through expires_at + 7 days.
  FOR r IN
    SELECT s.id,s.store_id,s.user_id,s.tier,s.is_trial,s.expires_at,p.full_name,p.email,
           COALESCE(st.name,'your QAFRICA store') AS store_name
      FROM public.subscriptions s
      LEFT JOIN public.profiles p ON p.id=s.user_id
      LEFT JOIN public.stores st ON st.id=s.store_id
     WHERE s.is_active IS TRUE AND s.expires_at IS NOT NULL AND s.expires_at<now()
  LOOP
    UPDATE public.subscriptions SET is_active=false,updated_at=now() WHERE id=r.id;
    covered := false;
    IF r.store_id IS NOT NULL THEN
      SELECT EXISTS(SELECT 1 FROM public.subscriptions s2
       WHERE s2.store_id=r.store_id AND s2.id<>r.id AND s2.is_active IS TRUE
         AND s2.is_trial IS FALSE AND s2.expires_at>now()) INTO covered;
    END IF;

    INSERT INTO public.system_failure_logs(failure_type,entity_type,entity_id,affected_user_id,error_message,metadata)
    VALUES('subscription_expired','subscription',r.id::text,r.user_id,
      format('Subscription tier=%s expired; seven-day storefront grace started (store: %s)%s',
       r.tier,COALESCE(r.store_name,'none'),CASE WHEN covered THEN ' — another paid subscription still covers this store' ELSE '' END),
      jsonb_build_object('store_id',r.store_id,'tier',r.tier,'was_trial',r.is_trial,
       'still_covered',covered,'grace_ends_at',r.expires_at+interval '7 days'));

    ev := NULL;
    INSERT INTO public.subscription_lifecycle_events(subscription_id,store_id,user_id,event_type)
    VALUES(r.id,r.store_id,r.user_id,'expired')
    ON CONFLICT(subscription_id,event_type) DO NOTHING RETURNING id INTO ev;
    IF ev IS NOT NULL AND COALESCE(r.email,'')<>'' THEN
      owner_name := COALESCE(r.full_name,'there');
      owner_name_safe := replace(replace(replace(owner_name,'&','&amp;'),'<','&lt;'),'>','&gt;');
      store_name_safe := replace(replace(replace(r.store_name,'&','&amp;'),'<','&lt;'),'>','&gt;');
      INSERT INTO public.email_queue(to_email,to_name,template_name,template_data,status,scheduled_for,email_type,priority,subject,html_body)
      VALUES(r.email,r.full_name,'generic','{}'::jsonb,'pending',now(),'subscription_lifecycle',1,
       'Your QAFRICA subscription has expired — 7 days to renew',
       '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:28px;color:#1f2937"><h2 style="color:#dc2626">Your subscription has expired</h2><p>Hello '||owner_name_safe||',</p><p>The subscription for <strong>'||store_name_safe||'</strong> has expired. Your storefront remains online for a <strong>7-day grace period</strong>, until <strong>'||to_char((r.expires_at+interval '7 days') AT TIME ZONE 'Africa/Lagos','DD Mon YYYY, HH12:MI AM')||' WAT</strong>.</p><p>Renew during this period. If you do not renew, visitors will see “Store Not Found” and imported listings from your store will be deactivated.</p><p><a href="https://qafrica.store/dashboard/subscription" style="background:#f97316;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">Renew subscription</a></p><p>QAFRICA</p></div>');
    END IF;
    expired_count := expired_count+1;
  END LOOP;

  -- Close only uncovered stores whose seven-day grace has ended.
  FOR st IN
    SELECT x.id,x.owner_id,x.name,x.slug
      FROM public.stores x
     WHERE x.is_active IS TRUE
       AND NOT EXISTS(SELECT 1 FROM public.subscriptions s
        WHERE s.store_id=x.id AND s.is_active IS TRUE AND s.is_trial IS FALSE AND s.expires_at>now())
       AND EXISTS(SELECT 1 FROM public.subscriptions s
        JOIN public.subscription_lifecycle_events e ON e.subscription_id=s.id AND e.event_type='expired'
        WHERE s.store_id=x.id AND s.expires_at<=now()-interval '7 days')
  LOOP
    SELECT s.id,s.user_id INTO r FROM public.subscriptions s
      JOIN public.subscription_lifecycle_events e ON e.subscription_id=s.id AND e.event_type='expired'
     WHERE s.store_id=st.id AND s.expires_at<=now()-interval '7 days'
     ORDER BY s.expires_at DESC LIMIT 1;
    ev := NULL;
    INSERT INTO public.subscription_lifecycle_events(subscription_id,store_id,user_id,event_type)
    VALUES(r.id,st.id,r.user_id,'grace_ended')
    ON CONFLICT(subscription_id,event_type) DO NOTHING RETURNING id INTO ev;
    IF ev IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.notifications(user_id,type,title,message,data,store_id)
    SELECT DISTINCT ic.importer_owner_id,'supplier_store_expired',
      'Supplier store is no longer available',
      format('Supplier store "%s" went offline after its subscription grace period. Its imported listings have been deactivated.',st.name),
      jsonb_build_object('supplier_store_id',st.id,'supplier_store_name',st.name,'reason','subscription_expired'),
      ic.importer_store_id
      FROM public.import_catalog ic
     WHERE ic.original_store_id=st.id AND ic.is_active IS TRUE;

    UPDATE public.stores SET is_active=false,deactivation_reason='subscription_expired',updated_at=now()
     WHERE id=st.id AND is_active IS TRUE;
    UPDATE public.products SET is_active=false,is_importable=false,updated_at=now()
     WHERE store_id=st.id AND (is_active IS TRUE OR is_importable IS TRUE);
    UPDATE public.import_catalog SET is_active=false
     WHERE original_store_id=st.id AND is_active IS TRUE;
    INSERT INTO public.system_failure_logs(failure_type,entity_type,entity_id,affected_user_id,error_message,metadata)
    VALUES('subscription_grace_ended','store',st.id::text,st.owner_id,
      format('Store %s was taken offline after its seven-day subscription grace period',st.name),
      jsonb_build_object('store_id',st.id,'store_slug',st.slug));
    closed_count := closed_count+1;
  END LOOP;

  IF expired_count>0 OR closed_count>0 THEN
    RAISE NOTICE 'subscription lifecycle: % expired subscription(s), % store(s) closed after grace',expired_count,closed_count;
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.expire_overdue_subscriptions()
IS 'Queues deduplicated subscription expiry emails, keeps storefronts online for seven days after expiry, then closes uncovered stores and notifies/deactivates affected imported listings. The existing hourly cron continues to invoke this function.';
