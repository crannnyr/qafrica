-- Paid sourcing allocations
--
-- A batch order and a sourcing commitment are intentionally separate concepts.
-- An allocation is an immutable snapshot of one customer's paid order line that
-- has been released for China sourcing. Re-running the sync only inserts lines
-- that do not already have an allocation, so late payers can be added safely
-- without changing or duplicating quantities already released.

create table if not exists public.import_sourcing_allocations (
  id uuid primary key default gen_random_uuid(),
  batch_key text not null,
  order_id uuid not null references public.china_import_orders(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  product_id uuid not null references public.china_import_products(id) on delete restrict,
  variant_options jsonb not null default '{}'::jsonb,
  variant_key text generated always as (md5(variant_options::text)) stored,
  quantity integer not null check (quantity > 0),
  status text not null default 'committed'
    check (status in ('committed', 'purchased', 'received', 'shipped', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_key, order_id, product_id, variant_key)
);

create index if not exists idx_import_sourcing_allocations_batch
  on public.import_sourcing_allocations(batch_key, status);
create index if not exists idx_import_sourcing_allocations_customer
  on public.import_sourcing_allocations(batch_key, customer_id, status);

comment on table public.import_sourcing_allocations is
  'Immutable per-customer sourcing commitments released from paid consolidation/shipping orders. Re-sync only adds missing paid lines; it never recalculates or overwrites an existing allocation.';

create or replace function public.prepare_paid_sourcing(p_batch_key text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_inserted integer := 0;
  v_customers integer := 0;
  v_paid_customers integer := 0;
  v_waiting_customers integer := 0;
begin
  if p_batch_key is null or btrim(p_batch_key) = '' then
    return jsonb_build_object('error', 'Missing batch key', 'status', 400);
  end if;

  with paid_orders as (
    select distinct o.id, o.user_id
    from public.china_import_orders o
    where o.staged_at = p_batch_key::timestamptz
      and o.user_id is not null
      and o.status not in ('cancelled', 'refunded')
      and exists (
        select 1
        from public.china_import_consolidation_bills b
        where b.order_id = o.id
          and b.user_id = o.user_id
          and b.kind = 'consolidation_shipping'
          and b.status = 'paid'
      )
  ),
  inserted as (
    insert into public.import_sourcing_allocations (
      batch_key, order_id, customer_id, product_id, variant_options, quantity
    )
    select
      p_batch_key,
      o.id,
      o.user_id,
      (item->>'id')::uuid,
      coalesce(item->'variant_options', '{}'::jsonb),
      greatest(coalesce((item->>'quantity')::integer, 0), 0)
    from public.china_import_orders o
    join paid_orders po on po.id = o.id
    cross join lateral jsonb_array_elements(o.items) item
    where item->>'id' is not null
      and greatest(coalesce((item->>'quantity')::integer, 0), 0) > 0
      and order_status_rank(o.status) < order_status_rank('shipped_and_closed')
    on conflict (batch_key, order_id, product_id, variant_key) do nothing
    returning customer_id
  )
  select count(*)::integer, count(distinct customer_id)::integer
  into v_inserted, v_customers
  from inserted;

  select count(distinct o.user_id)::integer
  into v_paid_customers
  from public.china_import_orders o
  where o.staged_at = p_batch_key::timestamptz
    and o.user_id is not null
    and o.status not in ('cancelled', 'refunded')
    and exists (
      select 1
      from public.china_import_consolidation_bills b
      where b.order_id = o.id
        and b.user_id = o.user_id
        and b.kind = 'consolidation_shipping'
        and b.status = 'paid'
    );

  select count(distinct o.user_id)::integer
  into v_waiting_customers
  from public.china_import_orders o
  where o.staged_at = p_batch_key::timestamptz
    and o.user_id is not null
    and o.status not in ('cancelled', 'refunded')
    and not exists (
      select 1
      from public.china_import_consolidation_bills b
      where b.order_id = o.id
        and b.user_id = o.user_id
        and b.kind = 'consolidation_shipping'
        and b.status = 'paid'
    );

  return jsonb_build_object(
    'batch_key', p_batch_key,
    'new_allocations', v_inserted,
    'customers_added', v_customers,
    'paid_customers', v_paid_customers,
    'waiting_payment_customers', v_waiting_customers
  );
end;
$$;

create or replace function public.get_paid_sourcing_allocations(p_batch_key text)
returns table (
  product_id uuid,
  product_name text,
  product_image text,
  source_url text,
  total_qty bigint,
  customers_count bigint,
  variants jsonb
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    a.product_id,
    coalesce(p.name, min(a.product_id::text)) as product_name,
    p.image_url as product_image,
    p.source_url,
    sum(a.quantity)::bigint as total_qty,
    count(distinct a.customer_id)::bigint as customers_count,
    jsonb_agg(
      jsonb_build_object(
        'variant_options', a.variant_options,
        'quantity', a.quantity
      ) order by a.created_at
    ) as variants
  from public.import_sourcing_allocations a
  left join public.china_import_products p on p.id = a.product_id
  join public.china_import_orders o on o.id = a.order_id
  where a.batch_key = p_batch_key
    and a.status <> 'cancelled'
    and o.status not in ('cancelled', 'refunded')
  group by a.product_id, p.name, p.image_url, p.source_url
  order by product_name asc;
$$;

grant execute on function public.prepare_paid_sourcing(text) to service_role;
grant execute on function public.get_paid_sourcing_allocations(text) to anon, authenticated, service_role;
