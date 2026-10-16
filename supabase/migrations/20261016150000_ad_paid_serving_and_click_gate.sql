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
  if request_role = 'service_role'
     or current_setting('qafrica.ad_campaign_internal_write', true) = 'on' then
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

-- Gate direct read access and click billing on completed campaign payments.
-- The exhausted state is required by the CPC functions to stop campaigns at budget limit.
alter table public.ad_campaigns
  drop constraint if exists ad_campaigns_status_check;
alter table public.ad_campaigns
  add constraint ad_campaigns_status_check
  check (status in ('active','paused','ended','exhausted'));

drop policy if exists "Public can read active approved campaigns" on public.ad_campaigns;
create policy "Public can read active approved paid campaigns"
  on public.ad_campaigns for select to anon, authenticated
  using (
    approval_status = 'approved'
    and payment_status = 'paid'
    and status = 'active'
    and start_date <= now()
    and (end_date is null or end_date > now())
  );

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
  if p_click_key is null or length(trim(p_click_key)) < 12 or length(p_click_key) > 160 then
    raise exception 'Invalid click key';
  end if;
  select * into c from public.ad_campaigns where id = p_campaign_id for update;
  if c.id is null or c.campaign_type <> 'placement' or c.approval_status <> 'approved'
     or c.payment_status <> 'paid' or c.status <> 'active' or c.start_date > now()
     or (c.end_date is not null and c.end_date <= now()) then
    raise exception 'Placement ad is not currently active and paid';
  end if;
  select flat_cpc_ngn into rate from public.placement_ad_settings where id = true;
  if rate is null or rate <= 0 then raise exception 'Placement Ads CPC rate has not been configured'; end if;
  select * into existing from public.placement_ad_clicks
    where campaign_id = p_campaign_id and click_key = trim(p_click_key);
  if existing.id is not null then return jsonb_build_object('recorded',false,'duplicate',true,'charged',0); end if;
  if coalesce(c.spent,0) + rate > c.budget then
    perform set_config('qafrica.ad_campaign_internal_write','on',true);
    update public.ad_campaigns set status = 'exhausted' where id = c.id;
    return jsonb_build_object('recorded',false,'exhausted',true,'charged',0);
  end if;
  insert into public.placement_ad_clicks(campaign_id,click_key,charged_cpc_ngn)
    values(c.id,trim(p_click_key),rate) on conflict(campaign_id,click_key) do nothing;
  if not found then return jsonb_build_object('recorded',false,'duplicate',true,'charged',0); end if;
  perform set_config('qafrica.ad_campaign_internal_write','on',true);
  update public.ad_campaigns
    set spent = coalesce(spent,0) + rate,
        clicks = coalesce(clicks,0) + 1,
        status = case when coalesce(spent,0) + rate >= budget then 'exhausted' else status end
    where id = c.id;
  return jsonb_build_object('recorded',true,'duplicate',false,'charged',rate);
end;
$$;
revoke all on function public.record_placement_ad_click(uuid,text) from public;
grant execute on function public.record_placement_ad_click(uuid,text) to anon, authenticated;

create or replace function public.record_banner_ad_click(p_campaign_id uuid, p_click_key text)
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
  if p_click_key is null or length(trim(p_click_key)) < 12 or length(p_click_key) > 160 then
    raise exception 'Invalid click key';
  end if;
  select * into c from public.ad_campaigns where id = p_campaign_id for update;
  if c.id is null or c.campaign_type <> 'banner' or c.approval_status <> 'approved'
     or c.payment_status <> 'paid' or c.status <> 'active' or c.start_date > now()
     or (c.end_date is not null and c.end_date <= now()) then
    raise exception 'Banner ad is not currently active and paid';
  end if;
  select banner_cpc_ngn into rate from public.placement_ad_settings where id = true;
  if rate is null or rate <= 0 then raise exception 'Banner Ads CPC rate has not been configured'; end if;
  select * into existing from public.placement_ad_clicks
    where campaign_id = p_campaign_id and click_key = trim(p_click_key);
  if existing.id is not null then return jsonb_build_object('recorded',false,'duplicate',true,'charged',0); end if;
  if coalesce(c.spent,0) + rate > c.budget then
    perform set_config('qafrica.ad_campaign_internal_write','on',true);
    update public.ad_campaigns set status = 'exhausted' where id = c.id;
    return jsonb_build_object('recorded',false,'exhausted',true,'charged',0);
  end if;
  insert into public.placement_ad_clicks(campaign_id,click_key,charged_cpc_ngn)
    values(c.id,trim(p_click_key),rate) on conflict(campaign_id,click_key) do nothing;
  if not found then return jsonb_build_object('recorded',false,'duplicate',true,'charged',0); end if;
  perform set_config('qafrica.ad_campaign_internal_write','on',true);
  update public.ad_campaigns
    set spent = coalesce(spent,0) + rate,
        clicks = coalesce(clicks,0) + 1,
        status = case when coalesce(spent,0) + rate >= budget then 'exhausted' else status end
    where id = c.id;
  return jsonb_build_object('recorded',true,'duplicate',false,'charged',rate);
end;
$$;
revoke all on function public.record_banner_ad_click(uuid,text) from public;
grant execute on function public.record_banner_ad_click(uuid,text) to anon, authenticated;
