-- Secure review links for completed China Import orders.
create table if not exists public.china_import_review_links (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.china_import_orders(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '180 days'),
  created_at timestamptz not null default now()
);
create index if not exists idx_china_import_review_links_order on public.china_import_review_links(order_id);
alter table public.china_import_review_links enable row level security;

alter table public.mock_reviews add column if not exists order_id uuid references public.china_import_orders(id) on delete set null;
create unique index if not exists idx_mock_reviews_order_product_unique
  on public.mock_reviews(order_id, product_id) where order_id is not null and product_id is not null;

insert into public.import_message_templates
  (key, label, description, subject, body_html, available_placeholders)
values (
  'fulfillment_order_complete',
  'China Import order complete',
  'Sent once when every item in a China Import order has been delivered.',
  'Your order {{order_code}} is now complete 🎉',
  '<h2 style="color:#111827;margin:0 0 8px;">Your order is now complete</h2>
   <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
     Hi {{customer_name}}, all items from order <strong>{{order_code}}</strong> have now been delivered.
   </p>
   <div style="background:#F0FDF4;border-left:4px solid #16A34A;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:20px;">
     <p style="margin:0;color:#166534;font-size:14px;line-height:1.6;">Thank you for using QAFRICA Import.</p>
   </div>
   <p style="color:#6B7280;line-height:1.6;margin:0 0 16px;">How was your experience with your products? Share your feedback to help other customers.</p>
   <a href="{{review_link}}" style="display:inline-block;background:#F97316;color:#fff;text-decoration:none;padding:13px 22px;border-radius:10px;font-size:14px;font-weight:700;">⭐ Review Your Products</a>',
  array['customer_name','order_code','review_link']
)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  subject = excluded.subject,
  body_html = excluded.body_html,
  available_placeholders = excluded.available_placeholders,
  updated_at = now();
