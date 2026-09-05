-- Email hardening, part 2: the rate limiter
-- Replaces can_send_email_now(text, text). Changes from the previous version:
--
--   1. Transactional mail bypasses the per-type daily limit and the global
--      ceiling. A password reset must never be refused because a newsletter
--      spent the budget.
--   2. Bulk mail may only consume 80% of a domain's hourly cap. The remaining
--      20% is reserved headroom so transactional mail can always get out even
--      when Gmail is throttling us.
--   3. A global daily ceiling applies to all non-transactional mail.
--   4. Daily counters self-reset on the Africa/Lagos day boundary instead of
--      relying on an external cron to zero them.
create or replace function public.can_send_email_now(p_email_type text, p_to_email text default null::text)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_settings        email_type_settings%rowtype;
  v_global          email_global_settings%rowtype;
  v_throttle        email_domain_throttle%rowtype;
  v_tomorrow        timestamptz;
  v_domain          text;
  v_retry_at        timestamptz;
  v_transactional   boolean := false;
  v_effective_cap   int;
  v_today_start     timestamptz;
begin
  v_today_start := date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
  v_tomorrow    := v_today_start + interval '1 day' + interval '5 minutes';

  -- 1. Suppression always wins. Never send to a known-bad address.
  if p_to_email is not null and exists (
    select 1 from email_suppression_cache where email = lower(p_to_email)
  ) then
    return jsonb_build_object('can_send', false, 'reason', 'suppressed');
  end if;

  -- 2. Per-type settings.
  select * into v_settings from email_type_settings where email_type = p_email_type;

  if found then
    v_transactional := coalesce(v_settings.is_transactional, false);

    if not v_settings.is_enabled then
      return jsonb_build_object('can_send', false, 'reason', 'disabled', 'scheduled_for', null);
    end if;

    -- Roll the per-type daily counter over on the Lagos day boundary.
    if v_settings.last_reset_at < v_today_start then
      update email_type_settings
      set sent_today = 0, last_reset_at = now(), updated_at = now()
      where email_type = p_email_type;
      v_settings.sent_today := 0;
    end if;

    if not v_transactional and v_settings.sent_today >= v_settings.daily_limit then
      return jsonb_build_object(
        'can_send', false, 'reason', 'limit_reached', 'scheduled_for', v_tomorrow,
        'limit', v_settings.daily_limit, 'sent_today', v_settings.sent_today
      );
    end if;
  else
    -- An unknown type used to mean "no limit at all". Treat it as bulk so it
    -- is still bound by the global ceiling and the domain throttle.
    v_transactional := false;
  end if;

  -- 3. Global daily ceiling (bulk only).
  select * into v_global from email_global_settings where id = 1;
  if found then
    if v_global.last_reset_at < v_today_start then
      update email_global_settings
      set sent_today = 0, last_reset_at = now(), updated_at = now()
      where id = 1;
      v_global.sent_today := 0;
    end if;

    if not v_transactional and v_global.sent_today >= v_global.daily_ceiling then
      return jsonb_build_object(
        'can_send', false, 'reason', 'limit_reached', 'scheduled_for', v_tomorrow,
        'limit', v_global.daily_ceiling, 'sent_today', v_global.sent_today,
        'scope', 'global'
      );
    end if;
  end if;

  -- 4. Per-domain hourly throttle, with headroom reserved for transactional.
  if p_to_email is not null then
    v_domain := lower(split_part(p_to_email, '@', 2));
    select * into v_throttle from email_domain_throttle where domain = v_domain for update;

    if found then
      if now() - v_throttle.window_start >= interval '1 hour' then
        update email_domain_throttle
        set sent_count = 0, window_start = now(), updated_at = now()
        where domain = v_domain;
        v_throttle.sent_count  := 0;
        v_throttle.window_start := now();
      end if;

      -- Bulk gets 80% of the cap; the top 20% is transactional-only.
      v_effective_cap := case
        when v_transactional then v_throttle.hourly_cap
        else greatest(1, (v_throttle.hourly_cap * 8) / 10)
      end;

      if v_throttle.sent_count >= v_effective_cap then
        v_retry_at := v_throttle.window_start + interval '1 hour';
        return jsonb_build_object(
          'can_send', false, 'reason', 'domain_rate_limited', 'scheduled_for', v_retry_at,
          'domain', v_domain, 'hourly_cap', v_throttle.hourly_cap,
          'effective_cap', v_effective_cap, 'transactional', v_transactional
        );
      end if;

      update email_domain_throttle
      set sent_count = sent_count + 1, updated_at = now()
      where domain = v_domain;
    end if;
  end if;

  return jsonb_build_object('can_send', true, 'reason', 'ok', 'transactional', v_transactional);
end;
$function$;

-- record_email_sent now also advances the global counter.
create or replace function public.record_email_sent(p_email_type text)
returns void
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  update email_type_settings
  set sent_today          = sent_today + 1,
      total_sent_all_time = total_sent_all_time + 1,
      updated_at          = now()
  where email_type = p_email_type;

  update email_global_settings
  set sent_today = sent_today + 1, updated_at = now()
  where id = 1;
end;
$function$;
