create or replace function public.ai_update_import_order_address(p_customer_id uuid,p_order_id uuid,p_address jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order public.china_import_orders%rowtype; v_address jsonb; v_is_jumia boolean;
begin
  select * into v_order from public.china_import_orders where id=p_order_id and user_id=p_customer_id for update;
  if not found then raise exception 'Order not found'; end if;
  v_is_jumia := lower(coalesce(v_order.delivery_mode,''))='pickup_station' or lower(coalesce(v_order.delivery_type,''))='jumia';
  if v_is_jumia then raise exception 'Jumia/pickup-station delivery addresses cannot be changed by AI'; end if;
  if v_order.shipped_at is not null or v_order.status in ('shipped_and_closed','clearance_and_closed','received','delivered') then raise exception 'This order can no longer have its delivery address changed'; end if;
  if jsonb_typeof(p_address) <> 'object' then raise exception 'A valid address object is required'; end if;
  if coalesce(trim(p_address->>'name'),'')='' or coalesce(trim(p_address->>'phone'),'')='' or coalesce(trim(p_address->>'address_line1'),'')='' or coalesce(trim(p_address->>'city'),'')='' or coalesce(trim(p_address->>'state'),'')='' then raise exception 'Name, phone, street address, city and state are required'; end if;
  v_address=jsonb_build_object('name',trim(p_address->>'name'),'phone',trim(p_address->>'phone'),'address_line1',trim(p_address->>'address_line1'),'address_line2',nullif(trim(p_address->>'address_line2'),''),'city',trim(p_address->>'city'),'state',trim(p_address->>'state'),'landmark',nullif(trim(p_address->>'landmark'),''));
  update public.china_import_orders set delivery_address=v_address,address_id=null,updated_at=now() where id=v_order.id;
  return jsonb_build_object('success',true,'order_id',v_order.id,'code',v_order.code,'delivery_address',v_address);
end; $$;
revoke all on function public.ai_update_import_order_address(uuid,uuid,jsonb) from public;
