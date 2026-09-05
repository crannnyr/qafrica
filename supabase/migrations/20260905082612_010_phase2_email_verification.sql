-- Phase 2: email confirmation + auth rate limiting
--
-- Design notes:
--   * Codes are stored ONLY as SHA-256 hashes. The edge function generates the
--     plaintext, emails it, and sends us the hash. A database leak therefore
--     does not hand anyone a working verification code.
--   * Verification is deliberately NON-BLOCKING. An unverified customer can
--     still browse, order and pay. The flag exists to protect the sending
--     domain (marketing goes to verified addresses only), not to gate the
--     product. 0 of 6,352 importers are currently verified -- gating anything
--     on this would lock out the entire customer base.
--   * Customers may correct their address during verification. A large share
--     of the 1-2 Sep signups typo'd their email (gamil.com, gmail.con,
--     gmal.com); those people currently have no way to fix it.

create table if not exists email_verification_codes (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null,
  email         text not null,           -- target address (may differ from current)
  code_hash     text not null,           -- SHA-256 of the 6-digit code, never plaintext
  purpose       text not null default 'verify_email',
  attempts      int  not null default 0,
  max_attempts  int  not null default 5,
  expires_at    timestamptz not null,
  consumed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_evc_customer on email_verification_codes (customer_id, created_at desc);
create index if not exists idx_evc_lookup   on email_verification_codes (customer_id, purpose, consumed_at, expires_at);

alter table email_verification_codes enable row level security;

-- Issue a code. Enforces 3 per customer per hour so the endpoint cannot be
-- used as a free email cannon against an arbitrary address.
create or replace function public.request_email_verification(
  p_customer_id uuid,
  p_email       text,
  p_code_hash   text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_recent int;
  v_expires timestamptz;
begin
  if p_customer_id is null or coalesce(trim(p_email), '') = '' or coalesce(p_code_hash,'') = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_request');
  end if;

  select count(*) into v_recent
  from email_verification_codes
  where customer_id = p_customer_id
    and created_at > now() - interval '1 hour';

  if v_recent >= 3 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited',
      'retry_after_minutes', 60);
  end if;

  -- Any previously issued, still-live code is retired. Only the newest code
  -- can ever be valid.
  update email_verification_codes
  set consumed_at = now()
  where customer_id = p_customer_id
    and purpose = 'verify_email'
    and consumed_at is null;

  v_expires := now() + interval '15 minutes';

  insert into email_verification_codes (customer_id, email, code_hash, expires_at)
  values (p_customer_id, lower(trim(p_email)), p_code_hash, v_expires);

  return jsonb_build_object('ok', true, 'expires_at', v_expires);
end;
$function$;

-- Verify a submitted code. On success marks the customer verified and, when
-- the code was issued against a corrected address, moves them to it.
create or replace function public.verify_email_code(
  p_customer_id uuid,
  p_code_hash   text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_row email_verification_codes%rowtype;
begin
  select * into v_row
  from email_verification_codes
  where customer_id = p_customer_id
    and purpose = 'verify_email'
    and consumed_at is null
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_active_code');
  end if;

  if v_row.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if v_row.attempts >= v_row.max_attempts then
    return jsonb_build_object('ok', false, 'reason', 'too_many_attempts');
  end if;

  -- Count the attempt before comparing, so a wrong guess always costs one.
  update email_verification_codes
  set attempts = attempts + 1
  where id = v_row.id;

  if v_row.code_hash <> p_code_hash then
    return jsonb_build_object('ok', false, 'reason', 'incorrect',
      'attempts_remaining', greatest(0, v_row.max_attempts - (v_row.attempts + 1)));
  end if;

  update email_verification_codes set consumed_at = now() where id = v_row.id;

  update customers
  set email = v_row.email,
      is_verified = true,
      updated_at = now()
  where id = p_customer_id;

  return jsonb_build_object('ok', true, 'email', v_row.email);
end;
$function$;

-- Housekeeping: verification codes are short-lived and there is no reason to
-- retain them once spent or expired.
create or replace function public.purge_expired_verification_codes()
returns void
language sql
set search_path to 'public', 'pg_temp'
as $function$
  delete from email_verification_codes
  where created_at < now() - interval '7 days';
$function$;

-- NOTE: revoking from anon/authenticated alone is a no-op, because Postgres
-- grants EXECUTE to the PUBLIC pseudo-role by default and both roles inherit
-- it. PUBLIC must be named explicitly. These SECURITY DEFINER functions issue
-- verification codes and flip customers.is_verified, so they must be reachable
-- only by the service role via the edge function.
revoke execute on function public.request_email_verification(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.verify_email_code(uuid, text)                from public, anon, authenticated;
revoke execute on function public.purge_expired_verification_codes()           from public, anon, authenticated;

grant execute on function public.request_email_verification(uuid, text, text) to service_role;
grant execute on function public.verify_email_code(uuid, text)                to service_role;
grant execute on function public.purge_expired_verification_codes()           to service_role;
