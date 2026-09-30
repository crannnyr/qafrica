create table if not exists public.import_ai_resolution_examples (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.import_ai_whatsapp_conversations(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  category text,
  issue_summary text,
  resolution_summary text,
  transcript jsonb,
  approved boolean not null default false,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists import_ai_resolution_examples_approved_idx
  on public.import_ai_resolution_examples (approved, created_at desc);

create or replace function public.ai_update_import_order_address(p_customer_id uuid,p_order_id uuid,p_address jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order public.china_import_orders%rowtype; v_address jsonb;
begin
  select * into v_order from public.china_import_orders where id=p_order_id and user_id=p_customer_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.shipped_at is not null or v_order.status in ('shipped_and_closed','clearance_and_closed','received','delivered') then raise exception 'This order can no longer have its delivery address changed'; end if;
  if jsonb_typeof(p_address) <> 'object' then raise exception 'A valid address object is required'; end if;
  if coalesce(trim(p_address->>'name'),'')='' or coalesce(trim(p_address->>'phone'),'')='' or coalesce(trim(p_address->>'address_line1'),'')='' or coalesce(trim(p_address->>'city'),'')='' or coalesce(trim(p_address->>'state'),'')='' then raise exception 'Name, phone, street address, city and state are required'; end if;
  v_address=jsonb_build_object('name',trim(p_address->>'name'),'phone',trim(p_address->>'phone'),'address_line1',trim(p_address->>'address_line1'),'address_line2',nullif(trim(p_address->>'address_line2'),''),'city',trim(p_address->>'city'),'state',trim(p_address->>'state'),'landmark',nullif(trim(p_address->>'landmark'),''));
  update public.china_import_orders set delivery_address=v_address,address_id=null,updated_at=now() where id=v_order.id;
  return jsonb_build_object('success',true,'order_id',v_order.id,'code',v_order.code,'delivery_address',v_address);
end; $$;

create or replace function public.ai_update_import_order_variant(p_customer_id uuid,p_order_id uuid,p_product_id uuid,p_variant_options jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order public.china_import_orders%rowtype; v_product public.china_import_products%rowtype; v_items jsonb; v_item jsonb; v_new_items jsonb:='[]'::jsonb; v_found boolean:=false; v_group jsonb; v_name text; v_value text; v_price numeric; v_delta numeric:=0; v_subtotal numeric:=0; v_jumia numeric; v_shipping numeric; v_total numeric;
begin
  if jsonb_typeof(p_variant_options) <> 'object' then raise exception 'Variant selection must be an object'; end if;
  select * into v_order from public.china_import_orders where id=p_order_id and user_id=p_customer_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.shipped_at is not null or v_order.status in ('billed','ordered_and_closed','shipped_and_closed','clearance_and_closed','received','delivered') then raise exception 'This order can no longer have its product variant changed'; end if;
  select * into v_product from public.china_import_products where id=p_product_id;
  if not found then raise exception 'Product not found'; end if;
  if coalesce(v_product.has_variants,false) is false or jsonb_typeof(v_product.variants) <> 'array' then raise exception 'This product has no selectable variants'; end if;
  for v_group in select value from jsonb_array_elements(v_product.variants) loop
    v_name:=v_group->>'name'; v_value:=p_variant_options->>v_name;
    if coalesce(v_value,'')='' then raise exception 'Please choose %',v_name; end if;
    if not exists(select 1 from jsonb_array_elements_text(coalesce(v_group->'options','[]'::jsonb)) x where x=v_value) then raise exception 'The selected % option is not available',v_name; end if;
    v_delta:=v_delta+coalesce((v_group->'price_deltas'->>v_value)::numeric,0);
  end loop;
  v_price:=coalesce(v_product.price_ngn,0)+v_delta; v_items:=coalesce(v_order.items,'[]'::jsonb);
  for v_item in select value from jsonb_array_elements(v_items) loop
    if (v_item->>'id')::uuid=p_product_id and not v_found then v_found:=true; v_item:=jsonb_set(v_item,'{variant_options}',p_variant_options,true); v_item:=jsonb_set(v_item,'{price_ngn}',to_jsonb(v_price),true); end if;
    v_subtotal:=v_subtotal+coalesce((v_item->>'price_ngn')::numeric,0)*coalesce((v_item->>'quantity')::numeric,0); v_new_items:=v_new_items||jsonb_build_array(v_item);
  end loop;
  if not v_found then raise exception 'The requested product is not in this order'; end if;
  v_jumia:=coalesce(v_order.jumia_fee_ngn,0); v_shipping:=coalesce(v_order.shipping_ngn,0); v_total:=v_subtotal+v_jumia+v_shipping;
  update public.china_import_orders set items=v_new_items,subtotal_ngn=v_subtotal,total_ngn=v_total,updated_at=now() where id=v_order.id;
  return jsonb_build_object('success',true,'order_id',v_order.id,'code',v_order.code,'product_id',p_product_id,'variant_options',p_variant_options,'unit_price_ngn',v_price,'subtotal_ngn',v_subtotal,'total_ngn',v_total);
end; $$;

revoke all on function public.ai_update_import_order_address(uuid,uuid,jsonb) from public;
revoke all on function public.ai_update_import_order_variant(uuid,uuid,uuid,jsonb) from public;

create or replace function public.ai_get_approved_resolution_examples(p_limit integer default 5)
returns setof public.import_ai_resolution_examples language sql security definer set search_path=public as $$
  select * from public.import_ai_resolution_examples where approved=true order by created_at desc limit greatest(1,least(coalesce(p_limit,5),20));
$$;
revoke all on function public.ai_get_approved_resolution_examples(integer) from public;
