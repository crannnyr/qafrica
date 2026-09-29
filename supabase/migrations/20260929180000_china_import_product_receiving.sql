create or replace function public.china_import_receive_product_lines(
  p_product_id uuid,
  p_lines jsonb,
  p_manager_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line jsonb;
  v_variant jsonb;
  v_quantity integer;
  v_total integer := 0;
  v_product_exists boolean;
begin
  if p_product_id is null or p_manager_id is null then
    raise exception 'Product and manager are required';
  end if;
  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Receiving lines must be an array';
  end if;

  select exists(select 1 from public.china_import_products where id=p_product_id)
    into v_product_exists;
  if not v_product_exists then
    raise exception 'Product not found';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_variant := coalesce(v_line->'variant_options','{}'::jsonb);
    v_quantity := nullif(v_line->>'quantity','')::integer;

    if jsonb_typeof(v_variant) <> 'object' then
      raise exception 'Invalid variant options';
    end if;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Every received quantity must be greater than zero';
    end if;

    perform public.add_china_import_inventory_stock(
      p_product_id,
      v_variant,
      v_quantity,
      p_manager_id
    );

    insert into public.china_import_receiving_events(
      invoice_item_id, product_id, variant_options, quantity_received, source, manager_id
    )
    values (
      null, p_product_id, v_variant, v_quantity, 'product_barcode', p_manager_id
    );

    v_total := v_total + v_quantity;
  end loop;

  if v_total = 0 then
    raise exception 'No stock was selected for receiving';
  end if;

  return v_total;
end;
$$;

revoke all on function public.china_import_receive_product_lines(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.china_import_receive_product_lines(uuid, jsonb, uuid) to service_role;
