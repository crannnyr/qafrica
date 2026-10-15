-- Enforce seller/admin boundaries for marketplace approval and provide admin review RPCs.
create or replace function public.guard_product_marketplace_approval()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then new.marketplace_approval_status := 'pending';
    else new.marketplace_approval_status := coalesce(new.marketplace_approval_status, 'pending'); end if;
  elsif new.marketplace_approval_status is distinct from old.marketplace_approval_status and not public.is_admin() then
    raise exception 'Only QAFRICA admins can change marketplace approval status' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists products_guard_marketplace_approval on public.products;
create trigger products_guard_marketplace_approval before insert or update of marketplace_approval_status on public.products
for each row execute function public.guard_product_marketplace_approval();

create or replace function public.admin_review_marketplace_product(p_product_id uuid, p_decision text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if p_decision not in ('approved','rejected','pending') then raise exception 'Invalid approval decision' using errcode = '22023'; end if;
  update public.products set marketplace_approval_status = p_decision where id = p_product_id;
  if not found then raise exception 'Product not found' using errcode = 'P0002'; end if;
  return jsonb_build_object('ok', true, 'product_id', p_product_id, 'status', p_decision);
end;
$$;
revoke all on function public.admin_review_marketplace_product(uuid,text) from public;
grant execute on function public.admin_review_marketplace_product(uuid,text) to authenticated;

create or replace function public.admin_list_marketplace_pending_products()
returns table(id uuid, name text, description text, images text[], selling_price numeric, created_at timestamptz, store_id uuid, store_name text, marketplace_approval_status text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return query select p.id,p.name,p.description,p.images,p.selling_price,p.created_at,p.store_id,s.name,p.marketplace_approval_status
  from public.products p join public.stores s on s.id=p.store_id
  where p.marketplace_approval_status in ('pending','rejected')
  order by case when p.marketplace_approval_status='pending' then 0 else 1 end,p.created_at desc;
end;
$$;
revoke all on function public.admin_list_marketplace_pending_products() from public;
grant execute on function public.admin_list_marketplace_pending_products() to authenticated;
