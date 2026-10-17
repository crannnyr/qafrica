create or replace function public.record_placement_ad_click(p_campaign_id uuid,p_click_key text) returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.ad_campaigns; rate numeric(12,2); existing public.placement_ad_clicks;
begin
 if p_click_key is null or length(trim(p_click_key))<12 or length(p_click_key)>160 then raise exception 'Invalid click key'; end if;
 select * into c from public.ad_campaigns where id=p_campaign_id for update;
 if c.id is null or c.campaign_type<>'placement' or c.approval_status<>'approved' or c.status<>'active' or c.start_date>now() or (c.end_date is not null and c.end_date<=now()) then raise exception 'Placement ad is not currently active'; end if;
 select flat_cpc_ngn into rate from public.placement_ad_settings where id=true;
 if rate is null then raise exception 'Placement Ads CPC rate has not been configured'; end if;
 select * into existing from public.placement_ad_clicks where campaign_id=p_campaign_id and click_key=trim(p_click_key);
 if existing.id is not null then return jsonb_build_object('recorded',false,'duplicate',true,'charged',0); end if;
 if coalesce(c.spent,0)+rate>c.budget then update public.ad_campaigns set status='exhausted' where id=c.id; return jsonb_build_object('recorded',false,'exhausted',true,'charged',0); end if;
 insert into public.placement_ad_clicks(campaign_id,click_key,charged_cpc_ngn) values(c.id,trim(p_click_key),rate) on conflict(campaign_id,click_key) do nothing;
 if not found then return jsonb_build_object('recorded',false,'duplicate',true,'charged',0); end if;
 update public.ad_campaigns set spent=coalesce(spent,0)+rate,clicks=coalesce(clicks,0)+1,status=case when coalesce(spent,0)+rate>=budget then 'exhausted' else status end where id=c.id;
 return jsonb_build_object('recorded',true,'duplicate',false,'charged',rate);
end; $$;
revoke all on function public.record_placement_ad_click(uuid,text) from public;
grant execute on function public.record_placement_ad_click(uuid,text) to anon,authenticated;