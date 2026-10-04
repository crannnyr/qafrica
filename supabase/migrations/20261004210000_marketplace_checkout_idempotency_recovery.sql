-- Phase 2: service-only recovery for a paid checkout session that hit a
-- fulfilment error. This preserves the session as the idempotency boundary
-- while allowing a safe retry after the underlying failure is fixed.

create or replace function public.retry_marketplace_checkout_session(p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_status text;
begin
  if current_user <> 'service_role' then
    raise exception 'service role required';
  end if;

  select id, status into v_id, v_status
  from public.marketplace_checkout_sessions
  where reference = p_reference
  for update;

  if not found then
    return jsonb_build_object('status','unknown_reference');
  end if;

  if v_status = 'paid' then
    return jsonb_build_object('status','paid','already',true);
  end if;

  if v_status <> 'fulfilment_error' then
    return jsonb_build_object('status',v_status,'retryable',false);
  end if;

  update public.marketplace_checkout_sessions
  set status = 'awaiting_payment',
      error = null,
      updated_at = now()
  where id = v_id;

  return jsonb_build_object('status','awaiting_payment','retryable',true);
end;
$$;

revoke all on function public.retry_marketplace_checkout_session(text) from public;
grant execute on function public.retry_marketplace_checkout_session(text) to service_role;
