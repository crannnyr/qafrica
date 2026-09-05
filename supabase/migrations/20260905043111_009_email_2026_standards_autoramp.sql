-- Email hardening, part 3: warm-up auto-ramp
-- Resend's guidance was to start near the pre-26-August volume and roughly
-- double each day while the delays clear. Doing that by hand means somebody
-- has to remember, and means nobody pulls the cap back down at 3am when
-- things go wrong. This does both, steering on live webhook data.
--
-- Rules per domain, over a trailing 24h window:
--   fewer than 50 measurable events -> hold (not enough signal to act on)
--   bounce rate < 2%                -> double the cap, up to ramp_ceiling
--   bounce rate 2-5%                -> hold
--   bounce rate > 5%                -> halve the cap, floor of 50
--
-- Run daily. Safe to run more often; it is idempotent within a window.
create or replace function public.email_ramp_tick()
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_global   email_global_settings%rowtype;
  v_row      record;
  v_total    int;
  v_bad      int;
  v_rate     numeric;
  v_old_cap  int;
  v_new_cap  int;
  v_results  jsonb := '[]'::jsonb;
begin
  select * into v_global from email_global_settings where id = 1;
  if not found or not v_global.auto_ramp_enabled then
    return jsonb_build_object('ran', false, 'reason', 'auto_ramp_disabled');
  end if;

  for v_row in select * from email_domain_throttle loop
    select
      count(*) filter (where event_type in ('delivered', 'bounced', 'complained')),
      count(*) filter (where event_type in ('bounced', 'complained'))
    into v_total, v_bad
    from email_delivery_events
    where domain = v_row.domain
      and occurred_at > now() - interval '24 hours';

    v_old_cap := v_row.hourly_cap;

    if v_total < 50 then
      v_new_cap := v_old_cap;                                   -- not enough signal
      v_rate    := null;
    else
      v_rate := round((v_bad::numeric / v_total::numeric) * 100, 2);

      if v_rate < 2 then
        v_new_cap := least(v_old_cap * 2, coalesce(v_row.ramp_ceiling, v_old_cap));
      elsif v_rate <= 5 then
        v_new_cap := v_old_cap;
      else
        v_new_cap := greatest(v_old_cap / 2, 50);
      end if;
    end if;

    if v_new_cap <> v_old_cap then
      update email_domain_throttle
      set hourly_cap = v_new_cap, updated_at = now()
      where domain = v_row.domain;
    end if;

    v_results := v_results || jsonb_build_object(
      'domain', v_row.domain,
      'events_24h', v_total,
      'bounce_rate', v_rate,
      'old_cap', v_old_cap,
      'new_cap', v_new_cap
    );
  end loop;

  update email_global_settings set ramp_last_run_at = now(), updated_at = now() where id = 1;

  return jsonb_build_object('ran', true, 'domains', v_results);
end;
$function$;

-- Live health view: what the ramp is steering on, and what an admin should
-- look at before asking "is email OK right now?".
create or replace view email_health_24h as
select
  coalesce(domain, '(all)')                                                    as domain,
  count(*) filter (where event_type = 'delivered')                             as delivered,
  count(*) filter (where event_type = 'bounced')                               as bounced,
  count(*) filter (where event_type = 'complained')                            as complained,
  count(*) filter (where event_type = 'delivery_delayed')                      as delayed,
  round(
    100.0 * count(*) filter (where event_type in ('bounced', 'complained'))
    / nullif(count(*) filter (where event_type in ('delivered', 'bounced', 'complained')), 0)
  , 2)                                                                         as bounce_rate_pct
from email_delivery_events
where occurred_at > now() - interval '24 hours'
group by rollup (domain);

-- Views default to SECURITY DEFINER semantics, which would expose delivery
-- events regardless of RLS on the underlying table. Admin diagnostics only.
alter view email_health_24h set (security_invoker = on);

-- Suppress an address from a webhook bounce/complaint event.
create or replace function public.record_email_bounce(
  p_email text, p_bounce_type text, p_reason text
)
returns void
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- Only permanent failures earn a suppression. A transient bounce is usually
  -- Gmail deferring us, which is our rate problem to fix, not the customer's
  -- address to throw away. Suppressing those would have deleted most of the
  -- list during the 1-2 Sep surge.
  if lower(coalesce(p_bounce_type, '')) in ('permanent', 'hard')
     or lower(coalesce(p_reason, '')) ~ 'does not exist|no such user|invalid recipient|mailbox.*(full|unavailable)|account.*disabled'
  then
    insert into email_suppression_cache (email, reason)
    values (lower(p_email), coalesce(nullif(p_reason, ''), 'hard_bounce'))
    on conflict (email) do nothing;
  end if;
end;
$function$;

-- The existing daily cron (jobid 17, 06:00) called ramp_email_domain_caps(),
-- which doubled every domain's cap unconditionally, with no reference to
-- whether anything was actually being delivered. From 200/hour it reaches the
-- 2,000 ceiling in four days -- straight back to the volume that got the
-- domain throttled by Gmail, with no mechanism to ever come back down.
--
-- Redefined to delegate to email_ramp_tick(), which steers on the trailing
-- 24h bounce rate and can reduce the cap as well as raise it. The existing
-- cron entry keeps working unchanged.
create or replace function public.ramp_email_domain_caps()
returns void
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_result jsonb;
begin
  v_result := email_ramp_tick();
  raise notice 'ramp_email_domain_caps -> %', v_result;
end;
$function$;
