-- Applied to production on 2026-10-04 (already live; committed so git matches the database).
-- Step 1: full backup of import products before the category/markup migration.
create table if not exists public.china_import_products_backup_20261004 as
  select * from public.china_import_products;
alter table public.china_import_products_backup_20261004 enable row level security;
comment on table public.china_import_products_backup_20261004 is
  'Snapshot of china_import_products taken 2026-10-04 before legacy text-category products were moved to niche subcategories. Service-role only. Safe to drop once the migration is signed off.';

-- Step 2: subcategories the legacy catalogue needs but the taxonomy lacked.
insert into public.niche_subcategories (category_id, niche_id, name, sort_order, markup_percent)
select v.category_id, v.niche_id, v.name, 0, v.markup
from (values
  ('mens-clothing','fashion','T-Shirts',50),
  ('mens-clothing','fashion','Sweaters & Knitwear',50),
  ('mens-clothing','fashion','Two-Piece Sets',50),
  ('mens-clothing','fashion','Socks',50),
  ('womens-clothing','fashion','Sweaters & Knitwear',50),
  ('womens-clothing','fashion','Two-Piece Sets',50),
  ('womens-clothing','fashion','Coats',50),
  ('accessories','fashion','Eyeglasses',50),
  ('phones','electronics','Cables & Adapters',35),
  ('audio','electronics','Audio Accessories',25),
  ('appliances','electronics','Power Stations & Generators',10),
  ('beauty-tools','beauty','Skincare Devices',55),
  ('storage','home','Cleaning Tools',35),
  ('bedding','home','Bathroom Accessories',35),
  ('toys','baby','Novelty & Gifts',40)
) as v(category_id, niche_id, name, markup)
where not exists (
  select 1 from public.niche_subcategories s
  where s.category_id = v.category_id and s.niche_id = v.niche_id and lower(s.name) = lower(v.name)
);

-- Step 3: staging map (proposal only; nothing reads this yet).
create table if not exists public.china_import_category_migration_map (
  product_id uuid primary key references public.china_import_products(id) on delete cascade,
  rn integer not null,
  subcategory_id uuid not null references public.niche_subcategories(id),
  needs_review boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.china_import_category_migration_map enable row level security;
comment on table public.china_import_category_migration_map is
  'Proposed category/subcategory for each legacy import product. Staging only - applied to china_import_products after review.';
