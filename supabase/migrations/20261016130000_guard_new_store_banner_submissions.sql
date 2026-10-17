create or replace function public.guard_store_banner_submission() returns trigger language plpgsql security definer set search_path=public as $$
declare is_admin boolean; banner_changed boolean;
begin
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') into is_admin;
 if tg_op='INSERT' then
  if is_admin then
   if nullif(trim(new.banner_url),'') is not null then new.banner_approval_status:='approved'; new.banner_reviewed_at:=now(); new.banner_reviewed_by:=auth.uid(); end if;
  elsif nullif(trim(new.banner_url),'') is not null then
   new.pending_banner_url:=new.banner_url; new.banner_url:=null; new.banner_approval_status:='pending'; new.banner_submitted_at:=now(); new.banner_reviewed_at:=null; new.banner_reviewed_by:=null; new.banner_rejection_reason:=null;
  end if;
  return new;
 end if;
 banner_changed := new.banner_url is distinct from old.banner_url;
 if is_admin then
  if banner_changed then new.banner_approval_status:='approved'; new.banner_reviewed_at:=now(); new.banner_reviewed_by:=auth.uid(); new.pending_banner_url:=null; new.banner_rejection_reason:=null; end if;
  return new;
 end if;
 if banner_changed then
  new.pending_banner_url:=new.banner_url; new.banner_url:=old.banner_url; new.banner_approval_status:='pending'; new.banner_submitted_at:=now(); new.banner_reviewed_at:=null; new.banner_reviewed_by:=null; new.banner_rejection_reason:=null;
 elsif new.banner_approval_status is distinct from old.banner_approval_status or new.banner_reviewed_at is distinct from old.banner_reviewed_at or new.banner_reviewed_by is distinct from old.banner_reviewed_by or new.pending_banner_url is distinct from old.pending_banner_url or new.banner_submitted_at is distinct from old.banner_submitted_at or new.banner_rejection_reason is distinct from old.banner_rejection_reason then
  new.banner_approval_status:=old.banner_approval_status; new.banner_reviewed_at:=old.banner_reviewed_at; new.banner_reviewed_by:=old.banner_reviewed_by; new.pending_banner_url:=old.pending_banner_url; new.banner_submitted_at:=old.banner_submitted_at; new.banner_rejection_reason:=old.banner_rejection_reason;
 end if;
 return new;
end; $$;
drop trigger if exists trg_guard_store_banner_submission on public.stores;
create trigger trg_guard_store_banner_submission before insert or update on public.stores for each row execute function public.guard_store_banner_submission();