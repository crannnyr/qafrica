-- Ad campaign payment gate: every campaign must be approved and paid before serving.
alter table public.ad_campaigns
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists paid_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ad_campaigns_payment_status_check'
    and conrelid = 'public.ad_campaigns'::regclass) then
    alter table public.ad_campaigns add constraint ad_campaigns_payment_status_check
      check (payment_status in ('unpaid','pending','paid','review','failed'));
  end if;
end $$;

create table if not exists public.ad_campaign_payments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'NGN',
  provider text not null default 'flutterwave',
  reference text not null unique,
  status text not null default 'pending' check (status in ('pending','paid','review','failed','expired')),
  provider_charge_id text,
  paid_amount numeric(12,2),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ad_campaign_payments_campaign_id_idx
  on public.ad_campaign_payments(campaign_id);
create index if not exists ad_campaign_payments_store_id_idx
  on public.ad_campaign_payments(store_id);
create index if not exists ad_campaign_payments_user_reference_idx
  on public.ad_campaign_payments(user_id, reference);

alter table public.ad_campaign_payments enable row level security;
grant select on public.ad_campaign_payments to authenticated;
drop policy if exists "Campaign owners can read own ad payments" on public.ad_campaign_payments;
drop policy if exists "Paid approved campaigns can be publicly selected" on public.ad_campaign_payments;
create policy "Campaign owners can read own ad payments"
  on public.ad_campaign_payments for select to authenticated
  using (exists (select 1 from public.stores s
    where s.id = ad_campaign_payments.store_id and s.owner_id = (select auth.uid())));

create or replace function public.guard_ad_campaign_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
  request_role text := current_setting('request.jwt.claim.role', true);
begin
  -- Server-side payment verification uses the service-role key. It alone may update payment state.
  if request_role = 'service_role' then
    return new;
  end if;

  select exists(select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','super_admin')) into is_admin;

  if is_admin then
    if new.approval_status is distinct from old.approval_status then
      new.reviewed_at := now();
      new.reviewed_by := auth.uid();
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.approval_status := 'pending';
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.payment_status := 'unpaid';
    new.paid_at := null;
  else
    new.approval_status := old.approval_status;
    new.reviewed_at := old.reviewed_at;
    new.reviewed_by := old.reviewed_by;
    new.spent := old.spent;
    new.clicks := old.clicks;
    new.impressions := old.impressions;
    new.conversions := old.conversions;
    new.payment_status := old.payment_status;
    new.paid_at := old.paid_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_ad_campaign_approval on public.ad_campaigns;
create trigger trg_guard_ad_campaign_approval
  before insert or update on public.ad_campaigns
  for each row execute function public.guard_ad_campaign_approval();

create or replace function public.admin_review_ad_campaign(p_campaign_id uuid, p_decision text)
returns public.ad_campaigns
language plpgsql
security definer
set search_path = public
as $$
declare result public.ad_campaigns;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role in ('admin','super_admin')
  ) then raise exception 'Administrator access required'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Invalid review decision'; end if;
  update public.ad_campaigns
    set approval_status = p_decision, reviewed_at = now(), reviewed_by = auth.uid()
    where id = p_campaign_id
    returning * into result;
  if result.id is null then raise exception 'Campaign not found'; end if;
  return result;
end;
$$;
revoke all on function public.admin_review_ad_campaign(uuid,text) from public, anon;
grant execute on function public.admin_review_ad_campaign(uuid,text) to authenticated;
