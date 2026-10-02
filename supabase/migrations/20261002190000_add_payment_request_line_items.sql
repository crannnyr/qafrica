alter table public.import_expense_requests
  add column if not exists line_items jsonb not null default '[]'::jsonb;

update public.import_expense_requests
set line_items = jsonb_build_array(
  jsonb_build_object('purpose', purpose, 'amount', amount)
)
where line_items = '[]'::jsonb
  and nullif(trim(coalesce(purpose, '')), '') is not null;

create index if not exists import_expense_requests_line_items_gin
  on public.import_expense_requests using gin (line_items);
