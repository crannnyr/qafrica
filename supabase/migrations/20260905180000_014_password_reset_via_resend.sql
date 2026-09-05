-- Code-based password reset, sent through Resend rather than Supabase Auth's
-- built-in mailer.
--
-- Why not Supabase's OTP: signInWithOtp() renders the "Magic Link" template,
-- which by default contains a clickable link and no token -- which is why a
-- customer received a magic link while the UI asked for a 6-digit code.
-- Making that template show a code means hand-editing a dashboard setting that
-- cannot be read, tested or version-controlled, and the same template is
-- shared with the dropship signup verification flow.
--
-- Codes are stored ONLY as SHA-256 hashes; the edge function generates the
-- plaintext, emails it, and persists the digest.
create table if not exists password_reset_codes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  email        text not null,
  code_hash    text not null,
  attempts     int  not null default 0,
  max_attempts int  not null default 5,
  expires_at   timestamptz not null,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_prc_email  on password_reset_codes (lower(email), created_at desc);
create index if not exists idx_prc_active on password_reset_codes (lower(email), consumed_at, expires_at);

alter table password_reset_codes enable row level security;

-- 3 codes per address per hour: enough for a genuine "it didn't arrive" retry,
-- not enough to use this endpoint as a mail cannon aimed at someone's inbox.
create or replace function public.request_password_reset(
  p_user_id uuid, p_email text, p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_recent  int;
  v_expires timestamptz;
begin
  if p_user_id is null or coalesce(trim(p_email), '') = '' or coalesce(p_code_hash, '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_request');
  end if;

  select count(*) into v_recent
  from password_reset_codes
  where lower(email) = lower(trim(p_email))
    and created_at > now() - interval '1 hour';

  if v_recent >= 3 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  -- Only the newest code is ever valid, or an attacker who saw an older email
  -- keeps a working token.
  update password_reset_codes
  set consumed_at = now()
  where lower(email) = lower(trim(p_email)) and consumed_at is null;

  v_expires := now() + interval '15 minutes';

  insert into password_reset_codes (user_id, email, code_hash, expires_at)
  values (p_user_id, lower(trim(p_email)), p_code_hash, v_expires);

  return jsonb_build_object('ok', true, 'expires_at', v_expires);
end;
$function$;

create or replace function public.verify_password_reset(
  p_email text, p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_row password_reset_codes%rowtype;
begin
  select * into v_row
  from password_reset_codes
  where lower(email) = lower(trim(p_email)) and consumed_at is null
  order by created_at desc
  limit 1;

  if not found then return jsonb_build_object('ok', false, 'reason', 'no_active_code'); end if;
  if v_row.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  if v_row.attempts >= v_row.max_attempts then
    return jsonb_build_object('ok', false, 'reason', 'too_many_attempts');
  end if;

  -- Count the attempt before comparing, so a wrong guess always costs one.
  update password_reset_codes set attempts = attempts + 1 where id = v_row.id;

  if v_row.code_hash <> p_code_hash then
    return jsonb_build_object('ok', false, 'reason', 'incorrect',
      'attempts_remaining', greatest(0, v_row.max_attempts - (v_row.attempts + 1)));
  end if;

  update password_reset_codes set consumed_at = now() where id = v_row.id;

  return jsonb_build_object('ok', true, 'user_id', v_row.user_id);
end;
$function$;

create or replace function public.purge_expired_password_reset_codes()
returns void
language sql
set search_path to 'public', 'pg_temp'
as $function$
  delete from password_reset_codes where created_at < now() - interval '7 days';
$function$;

-- Resolve an address to an auth user id. listUsers() is paginated, so finding
-- one address among 6,000+ accounts would mean walking every page per request.
--
-- SECURITY DEFINER because auth.users is not reachable by the service role via
-- PostgREST. Locked to service_role: exposed to anon it becomes an
-- account-existence oracle, the exact thing the generic responses prevent.
create or replace function public.find_auth_user_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path to 'auth', 'public', 'pg_temp'
as $function$
  select id from auth.users
  where lower(email) = lower(trim(p_email)) and deleted_at is null
  limit 1;
$function$;

-- NOTE: revoking from anon/authenticated alone is a no-op -- PUBLIC holds
-- EXECUTE by default and both roles inherit it. PUBLIC must be named.
revoke all on table password_reset_codes from public, anon, authenticated;
revoke execute on function public.request_password_reset(uuid, text, text)  from public, anon, authenticated;
revoke execute on function public.verify_password_reset(text, text)         from public, anon, authenticated;
revoke execute on function public.purge_expired_password_reset_codes()      from public, anon, authenticated;
revoke execute on function public.find_auth_user_by_email(text)             from public, anon, authenticated;

grant execute on function public.request_password_reset(uuid, text, text) to service_role;
grant execute on function public.verify_password_reset(text, text)        to service_role;
grant execute on function public.purge_expired_password_reset_codes()     to service_role;
grant execute on function public.find_auth_user_by_email(text)            to service_role;
