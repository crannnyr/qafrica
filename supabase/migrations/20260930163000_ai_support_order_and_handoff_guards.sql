create or replace function public.ai_update_import_order_address(p_customer_id uuid,p_order_id uuid,p_address jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_order public.china_import_orders%rowtype;
  v_failed public.china_import_failed_orders%rowtype;
  v_address jsonb;
  v_is_jumia boolean;
  v_status text;
begin
  select * into v_order from public.china_import_orders where id=p_order_id and user_id=p_customer_id for update;
  if not found then
    select * into v_failed from public.china_import_failed_orders where id=p_order_id and user_id=p_customer_id;
    if found then
      return jsonb_build_object('success',false,'blocked',true,'reason','This order is expired or removed and is no longer active, so its delivery address cannot be changed.','order_id',v_failed.id,'code',v_failed.code,'order_state','expired_or_removed');
    end if;
    raise exception 'Order not found';
  end if;
  v_status := lower(coalesce(v_order.status,''));
  if v_status in ('cancelled','canceled','expired','removed','failed','cancelled_and_closed','canceled_and_closed') then
    return jsonb_build_object('success',false,'blocked',true,'reason','This order is cancelled, expired, or removed and is no longer active, so its delivery address cannot be changed.','order_id',v_order.id,'code',v_order.code,'order_state',v_status);
  end if;
  v_is_jumia := lower(coalesce(v_order.delivery_mode,''))='pickup_station' or lower(coalesce(v_order.delivery_type,''))='jumia';
  if v_is_jumia then
    return jsonb_build_object('success',false,'blocked',true,'reason','Jumia/pickup-station delivery addresses cannot be changed by AI.','order_id',v_order.id,'code',v_order.code,'order_state','pickup_station');
  end if;
  if v_order.shipped_at is not null or v_status in ('shipped_and_closed','clearance_and_closed','received','delivered') then
    return jsonb_build_object('success',false,'blocked',true,'reason','This order has progressed too far for an AI delivery-address change.','order_id',v_order.id,'code',v_order.code,'order_state',v_status);
  end if;
  if jsonb_typeof(p_address) <> 'object' then raise exception 'A valid address object is required'; end if;
  if coalesce(trim(p_address->>'name'),'')='' or coalesce(trim(p_address->>'phone'),'')='' or coalesce(trim(p_address->>'address_line1'),'')='' or coalesce(trim(p_address->>'city'),'')='' or coalesce(trim(p_address->>'state'),'')='' then raise exception 'Name, phone, street address, city and state are required'; end if;
  v_address=jsonb_build_object('name',trim(p_address->>'name'),'phone',trim(p_address->>'phone'),'address_line1',trim(p_address->>'address_line1'),'address_line2',nullif(trim(p_address->>'address_line2'),''),'city',trim(p_address->>'city'),'state',trim(p_address->>'state'),'landmark',nullif(trim(p_address->>'landmark'),''));
  update public.china_import_orders set delivery_address=v_address,address_id=null,updated_at=now() where id=v_order.id;
  return jsonb_build_object('success',true,'order_id',v_order.id,'code',v_order.code,'delivery_address',v_address,'order_state',v_status);
end; $$;

create or replace function public.import_ai_human_handoff_allowed(p_conversation_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare
  v_allowed boolean := false;
  v_body text;
begin
  select lower(coalesce(body,'')) into v_body
  from public.import_ai_whatsapp_messages
  where conversation_id=p_conversation_id and direction='inbound' and sender_type='customer'
  order by created_at desc limit 1;
  if v_body is null then return false; end if;
  v_allowed := v_body ~ '(\m(i want|i need|can i|let me|please connect me|connect me|transfer me|put me in touch|speak to|talk to|chat with|human|real person|live agent|support agent|customer service)\M).*?(human|person|agent|support|representative|someone)'
    or v_body ~ '(\m(human|live agent|real person|support agent|customer service)\M).*?(please|now|connect|talk|speak|want|need)';
  return v_allowed;
end; $$;

create or replace function public.import_ai_guard_human_requested()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='human_requested' and (tg_op='INSERT' or old.status is distinct from new.status) then
    if not public.import_ai_human_handoff_allowed(new.id) then
      raise exception 'HUMAN_HANDOFF_REQUIRES_EXPLICIT_CUSTOMER_REQUEST';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_import_ai_guard_human_requested on public.import_ai_whatsapp_conversations;
create trigger trg_import_ai_guard_human_requested before insert or update of status on public.import_ai_whatsapp_conversations for each row execute function public.import_ai_guard_human_requested();

revoke all on function public.import_ai_human_handoff_allowed(uuid) from public;
revoke all on function public.import_ai_guard_human_requested() from public;
