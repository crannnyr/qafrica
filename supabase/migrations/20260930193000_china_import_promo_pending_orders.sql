-- Keep the China Import promo snapshot on the order so an unpaid order can be
-- safely reused when the customer applies/changes a promo before payment.
-- This remains isolated from the storefront coupon system.

alter table public.china_import_orders
  add column if not exists promotion_id uuid references public.china_import_promotions(id) on delete set null,
  add column if not exists promotion_code text,
  add column if not exists promotion_discount_ngn numeric(14,2) not null default 0
    check (promotion_discount_ngn >= 0);

create index if not exists china_import_orders_pending_promo_idx
  on public.china_import_orders (user_id, payment_status, promotion_id);

-- A paid order is the point at which a promo is actually redeemed. The trigger
-- makes this idempotent through the unique redemption(order_id) index, so a
-- repeated verification cannot consume the same promotion twice.
create or replace function public.redeem_china_import_promotion_for_paid_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
begin
  if new.payment_status = 'paid'
     and coalesce(old.payment_status, '') <> 'paid'
     and new.promotion_id is not null
     and coalesce(new.promotion_discount_ngn, 0) > 0 then

    insert into public.china_import_promotion_redemptions (
      promotion_id,
      customer_id,
      order_id,
      code,
      discount_amount_ngn,
      order_subtotal_ngn
    )
    values (
      new.promotion_id,
      new.user_id,
      new.id,
      coalesce(new.promotion_code, ''),
      new.promotion_discount_ngn,
      coalesce(new.subtotal_ngn, 0)
    )
    on conflict (order_id) where order_id is not null do nothing;

    get diagnostics v_inserted = row_count;

    if v_inserted = 1 then
      update public.china_import_promotions
      set usage_count = usage_count + 1,
          updated_at = now()
      where id = new.promotion_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists china_import_order_promo_redemption on public.china_import_orders;
create trigger china_import_order_promo_redemption
after update of payment_status on public.china_import_orders
for each row
execute function public.redeem_china_import_promotion_for_paid_order();
