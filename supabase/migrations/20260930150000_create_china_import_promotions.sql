-- China Import promotions are intentionally isolated from the storefront coupon system.
-- This migration creates the China Import-only promotion and redemption tables.

create table if not exists public.china_import_promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text,
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  minimum_order_ngn numeric(14,2) not null default 0 check (minimum_order_ngn >= 0),
  maximum_discount_ngn numeric(14,2) check (maximum_discount_ngn is null or maximum_discount_ngn >= 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  per_customer_limit integer check (per_customer_limit is null or per_customer_limit > 0),
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint china_import_promotions_code_format check (code = upper(trim(code))),
  constraint china_import_promotions_dates check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create unique index if not exists china_import_promotions_code_uq
  on public.china_import_promotions (code);

create index if not exists china_import_promotions_active_dates_idx
  on public.china_import_promotions (is_active, starts_at, expires_at);

create table if not exists public.china_import_promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.china_import_promotions(id) on delete restrict,
  customer_id uuid not null,
  order_id uuid,
  code text not null,
  discount_amount_ngn numeric(14,2) not null check (discount_amount_ngn >= 0),
  order_subtotal_ngn numeric(14,2) not null check (order_subtotal_ngn >= 0),
  created_at timestamptz not null default now()
);

create index if not exists china_import_promotion_redemptions_promotion_idx
  on public.china_import_promotion_redemptions (promotion_id, created_at desc);

create index if not exists china_import_promotion_redemptions_customer_idx
  on public.china_import_promotion_redemptions (customer_id, created_at desc);

create unique index if not exists china_import_promotion_redemptions_order_uq
  on public.china_import_promotion_redemptions (order_id)
  where order_id is not null;

alter table public.china_import_promotions enable row level security;
alter table public.china_import_promotion_redemptions enable row level security;

-- Promotion data is intentionally accessed through trusted China Import
-- server/admin paths. Do not expose unrestricted public reads/writes.

create or replace function public.validate_china_import_promotion(
  p_code text,
  p_customer_id uuid,
  p_order_subtotal_ngn numeric
)
returns table (
  promotion_id uuid,
  code text,
  discount_type text,
  discount_value numeric,
  discount_amount_ngn numeric,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promotion public.china_import_promotions%rowtype;
  v_customer_uses integer;
  v_discount numeric;
  v_code text := upper(trim(coalesce(p_code, '')));
begin
  if v_code = '' then
    return query select null::uuid, null::text, null::text, null::numeric, 0::numeric, 'Enter a promo code.'::text;
    return;
  end if;

  select p.* into v_promotion
  from public.china_import_promotions p
  where p.code = v_code
  limit 1;

  if not found then
    return query select null::uuid, v_code, null::text, null::numeric, 0::numeric, 'This promo code is not valid.'::text;
    return;
  end if;

  if not v_promotion.is_active then
    return query select v_promotion.id, v_promotion.code, v_promotion.discount_type, v_promotion.discount_value, 0::numeric, 'This promo code is no longer active.'::text;
    return;
  end if;

  if v_promotion.starts_at is not null and now() < v_promotion.starts_at then
    return query select v_promotion.id, v_promotion.code, v_promotion.discount_type, v_promotion.discount_value, 0::numeric, 'This promo code is not active yet.'::text;
    return;
  end if;

  if v_promotion.expires_at is not null and now() >= v_promotion.expires_at then
    return query select v_promotion.id, v_promotion.code, v_promotion.discount_type, v_promotion.discount_value, 0::numeric, 'This promo code has expired.'::text;
    return;
  end if;

  if p_order_subtotal_ngn < v_promotion.minimum_order_ngn then
    return query select v_promotion.id, v_promotion.code, v_promotion.discount_type, v_promotion.discount_value, 0::numeric,
      format('Minimum order for this code is ₦%s.', to_char(v_promotion.minimum_order_ngn, 'FM999G999G999G990D00'));
    return;
  end if;

  if v_promotion.usage_limit is not null and v_promotion.usage_count >= v_promotion.usage_limit then
    return query select v_promotion.id, v_promotion.code, v_promotion.discount_type, v_promotion.discount_value, 0::numeric, 'This promo code has reached its usage limit.'::text;
    return;
  end if;

  if p_customer_id is not null and v_promotion.per_customer_limit is not null then
    select count(*) into v_customer_uses
    from public.china_import_promotion_redemptions r
    where r.promotion_id = v_promotion.id and r.customer_id = p_customer_id;
    if v_customer_uses >= v_promotion.per_customer_limit then
      return query select v_promotion.id, v_promotion.code, v_promotion.discount_type, v_promotion.discount_value, 0::numeric, 'You have already used this promo code the maximum number of times.'::text;
      return;
    end if;
  end if;

  if v_promotion.discount_type = 'percentage' then
    v_discount := p_order_subtotal_ngn * v_promotion.discount_value / 100;
  else
    v_discount := v_promotion.discount_value;
  end if;

  v_discount := least(greatest(v_discount, 0), greatest(p_order_subtotal_ngn, 0));
  if v_promotion.maximum_discount_ngn is not null then
    v_discount := least(v_discount, v_promotion.maximum_discount_ngn);
  end if;

  return query select v_promotion.id, v_promotion.code, v_promotion.discount_type, v_promotion.discount_value,
    round(v_discount, 2), 'Promo code applied.'::text;
end;
$$;

grant execute on function public.validate_china_import_promotion(text, uuid, numeric) to service_role;
