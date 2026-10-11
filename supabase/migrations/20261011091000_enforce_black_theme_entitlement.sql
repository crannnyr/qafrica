-- Enforce the premium Black theme entitlement at the database boundary too.
create or replace function public.require_paid_black_theme()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.theme = 'black' and old.theme is distinct from new.theme
     and not exists (
       select 1
       from public.store_theme_purchases p
       where p.store_id = new.id
         and p.theme_id = 'black'
         and p.payment_status = 'paid'
     ) then
    raise exception 'The Black theme requires a completed ₦5,000 add-on purchase.';
  end if;
  return new;
end;
$$;

drop trigger if exists stores_require_paid_black_theme on public.stores;
create trigger stores_require_paid_black_theme
before update of theme on public.stores
for each row execute function public.require_paid_black_theme();

revoke all on function public.require_paid_black_theme() from public, anon, authenticated;
