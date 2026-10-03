create index if not exists idx_china_import_orders_user_created_at
  on public.china_import_orders(user_id, created_at desc);

drop policy if exists "Customers can view own import orders" on public.china_import_orders;
create policy "Customers can view own import orders"
  on public.china_import_orders
  for select
  using ((select auth.uid()) = user_id);
