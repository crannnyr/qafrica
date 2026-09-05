-- Phase 3: 1688 sourcing link + sea-freight-only flag on products.
--
-- source_url is ADMIN-ONLY. It is deliberately excluded from the public
-- `products` action's select list in the china-import edge function: it
-- exposes the supplier and the true landed cost, which is the whole margin.
-- Only `admin-products` returns it.
--
-- ship_only marks a product that cannot go by air. delivery_time already
-- exists on this table but all 277 rows are 'air' and nothing reads it, so a
-- dedicated boolean is clearer than overloading a column that is effectively
-- dead.
alter table china_import_products
  add column if not exists source_url text,
  add column if not exists ship_only  boolean not null default false;

comment on column china_import_products.source_url is
  'Admin-only 1688 (or other supplier) product URL. Never exposed to customers.';
comment on column china_import_products.ship_only is
  'True when the product can only ship by sea freight. Forces shipping_method at checkout.';

-- Partial index: the admin batch views filter on "which of these have a link
-- yet", and during backfill the un-linked set is the one being worked through.
create index if not exists idx_cip_missing_source_url
  on china_import_products (id) where source_url is null;

-- delivery_time has a CHECK allowing only 'air' or 'ship'. Having the edge
-- function also decide that value duplicates the mapping in two places, and a
-- mismatch (e.g. writing 'sea') fails the entire product save -- which is
-- exactly what happened the first time this shipped.
--
-- Make delivery_time strictly derived from ship_only instead. ship_only is the
-- flag admin actually sets; delivery_time becomes a consistent projection of
-- it that the storefront can keep reading. Any value the caller supplies is
-- overwritten, so the two can never drift apart.
create or replace function public.sync_product_delivery_time()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  new.delivery_time := case when coalesce(new.ship_only, false) then 'ship' else 'air' end;
  return new;
end;
$function$;

drop trigger if exists trg_sync_product_delivery_time on china_import_products;
create trigger trg_sync_product_delivery_time
  before insert or update on china_import_products
  for each row execute function public.sync_product_delivery_time();

update china_import_products
set delivery_time = case when ship_only then 'ship' else 'air' end
where delivery_time is distinct from (case when ship_only then 'ship' else 'air' end);
