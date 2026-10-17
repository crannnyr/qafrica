-- Banner review workflow and Placement Ads CPC foundation.
alter table public.stores
  add column if not exists pending_banner_url text,
  add column if not exists banner_approval_status text not null default 'approved',
  add column if not exists banner_submitted_at timestamptz,
  add column if not exists banner_reviewed_at timestamptz,
  add column if not exists banner_reviewed_by uuid references auth.users(id),
  add column if not exists banner_rejection_reason text;

alter table public.stores
  drop constraint if exists stores_banner_approval_status_check;
alter table public.stores
  add constraint stores_banner_approval_status_check
  check (banner_approval_status in ('pending','approved','rejected'));

-- Preserve every currently displayed banner as approved.
update public.stores
set banner_approval_status = 'approved'
where nullif(trim(banner_url), '') is not null
  and banner_approval_status is distinct from 'approved';

create or replace function public.guard_store_banner_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) into is_admin;

  if is_admin then
    if new.banner_url is distinct from old.banner_url then
      new.banner_approval_status := 'approved';
      new.banner_reviewed_at := now();
      new.banner_reviewed_by := auth.uid();
      new.pending_banner_url := null;
      new.banner_rejection_reason := null;
    end if;
    return new;
  end if;

  if new.banner_url is distinct from old.banner_url then
    -- Keep the currently approved banner live while a replacement is reviewed.
    new.pending_banner_url := new.banner_url;
    new.banner_url := old.banner_url;
    new.banner_approval_status := 'pending';
    new.banner_submitted_at := now();
    new.banner_reviewed_at := null;
    new.banner_reviewed_by := null;
    new.banner_rejection_reason := null;
  end if;

  -- Non-admins may not write approval metadata or the pending URL directly.
  if new.banner_approval_status is distinct from old.banner_approval_status
     or new.banner_reviewed_at is distinct from old.banner_reviewed_at
     or new.banner_reviewed_by is distinct from old.banner_reviewed_by
     or (new.pending_banner_url is distinct from old.pending_banner_url
         and new.banner_url is not distinct from old.banner_url) then
    new.banner_approval_status := old.banner_approval_status;
    new.banner_reviewed_at := old.banner_reviewed_at;
    new.banner_reviewed_by := old.banner_reviewed_by;
    new.pending_banner_url := old.pending_banner_url;
    new.banner_submitted_at := old.banner_submitted_at;
    new.banner_rejection_reason := old.banner_rejection_reason;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_store_banner_submission on public.stores;
create trigger trg_guard_store_banner_submission
before update on public.stores
for each row execute function public.guard_store_banner_submission();

create or replace function public.admin_review_store_banner(
  p_store_id uuid,
  p_decision text,
  p_rejection_reason text default null
)
returns public.stores
language plpgsql
security definer
set search_path = public
as $$
declare
  reviewed public.stores;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Admin access required';
  end if;
  if p_decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  update public.stores s
  set banner_url = case when p_decision = 'approved' then coalesce(s.pending_banner_url, s.banner_url) else s.banner_url end,
      pending_banner_url = null,
      banner_approval_status = p_decision,
      banner_reviewed_at = now(),
      banner_reviewed_by = auth.uid(),
      banner_rejection_reason = case when p_decision = 'rejected' then nullif(trim(p_rejection_reason), '') else null end
  where s.id = p_store_id
    and s.pending_banner_url is not null
  returning s.* into reviewed;

  if reviewed.id is null then
    raise exception 'No pending banner submission found';
  end if;
  return reviewed;
end;
$$;
revoke all on function public.admin_review_store_banner(uuid,text,text) from public;
grant execute on function public.admin_review_store_banner(uuid,text,text) to authenticated;

alter table public.ad_campaigns
  add column if not exists campaign_type text not null default 'placement',
  add column if not exists approval_status text not null default 'pending',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists category text,
  add column if not exists target_url text;

alter table public.ad_campaigns
  drop constraint if exists ad_campaigns_campaign_type_check;
alter table public.ad_campaigns
  add constraint ad_campaigns_campaign_type_check
  check (campaign_type in ('banner','placement'));

alter table public.ad_campaigns
  drop constraint if exists ad_campaigns_approval_status_check;
alter table public.ad_campaigns
  add constraint ad_campaigns_approval_status_check
  check (approval_status in ('pending','approved','rejected'));

create table if not exists public.placement_ad_settings (
  id boolean primary key default true check (id),
  flat_cpc_ngn numeric(12,2),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint placement_ad_cpc_nonnegative check (flat_cpc_ngn is null or flat_cpc_ngn >= 0)
);
insert into public.placement_ad_settings(id, flat_cpc_ngn)
values (true, null)
on conflict (id) do nothing;
alter table public.placement_ad_settings enable row level security;
drop policy if exists "Admins manage placement ad settings" on public.placement_ad_settings;
create policy "Admins manage placement ad settings"
on public.placement_ad_settings for all to authenticated
using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create table if not exists public.placement_ad_clicks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  click_key text not null,
  charged_cpc_ngn numeric(12,2) not null,
  clicked_at timestamptz not null default now(),
  unique(campaign_id, click_key)
);
alter table public.placement_ad_clicks enable row level security;
revoke all on public.placement_ad_clicks from anon, authenticated;

create or replace function public.record_placement_ad_click(p_campaign_id uuid, p_click_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.ad_campaigns;
  rate numeric(12,2);
  existing public.placement_ad_clicks;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_click_key is null or length(trim(p_click_key)) < 12 or length(p_click_key) > 160 then
    raise exception 'Invalid click key';
  end if;

  select * into c from public.ad_campaigns where id = p_campaign_id for update;
  if c.id is null or c.campaign_type <> 'placement' or c.approval_status <> 'approved'
     or c.status <> 'active' or c.start_date > now()
     or (c.end_date is not null and c.end_date <= now()) then
    raise exception 'Placement ad is not currently active';
  end if;

  select flat_cpc_ngn into rate from public.placement_ad_settings where id = true;
  if rate is null then raise exception 'Placement Ads CPC rate has not been configured'; end if;

  select * into existing from public.placement_ad_clicks
  where campaign_id = p_campaign_id and click_key = p_click_key;
  if existing.id is not null then
    return jsonb_build_object('recorded', false, 'duplicate', true, 'charged', 0);
  end if;

  if coalesce(c.spent, 0) + rate > c.budget then
    update public.ad_campaigns set status = 'exhausted' where id = c.id;
    return jsonb_build_object('recorded', false, 'exhausted', true, 'charged', 0);
  end if;

  insert into public.placement_ad_clicks(campaign_id, click_key, charged_cpc_ngn)
  values (c.id, trim(p_click_key), rate)
  on conflict (campaign_id, click_key) do nothing;

  if not found then
    return jsonb_build_object('recorded', false, 'duplicate', true, 'charged', 0);
  end if;

  update public.ad_campaigns
  set spent = coalesce(spent, 0) + rate,
      clicks = coalesce(clicks, 0) + 1,
      status = case when coalesce(spent, 0) + rate >= budget then 'exhausted' else status end
  where id = c.id;

  return jsonb_build_object('recorded', true, 'duplicate', false, 'charged', rate);
end;
$$;
revoke all on function public.record_placement_ad_click(uuid,text) from public, anon;
grant execute on function public.record_placement_ad_click(uuid,text) to authenticated;
